// Google OAuth 2.0 for installed apps: PKCE + loopback redirect.
// No redirect-URI registration is needed for Desktop clients — Google accepts
// any http://127.0.0.1:<port> automatically.

import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "openid email profile";

const b64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function pkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

const isWSL = () => {
  if (process.platform !== "linux") return false;
  try {
    return /microsoft/i.test(readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
};

// Best-effort browser open. Always succeeds silently; caller also prints the URL.
export function openBrowser(url) {
  let candidates;
  if (process.platform === "darwin") candidates = [["open", [url]]];
  else if (process.platform === "win32") candidates = [["cmd", ["/c", "start", "", url]]];
  else if (isWSL())
    candidates = [
      ["wslview", [url]],
      ["powershell.exe", ["-NoProfile", "Start-Process", `"${url}"`]],
      ["xdg-open", [url]],
    ];
  else candidates = [["xdg-open", [url]], ["sensible-browser", [url]], ["gio", ["open", url]]];

  // Try candidates in order; fall through to the next only if one isn't found.
  // (spawn reports ENOENT asynchronously via the 'error' event, so we can't just
  // return after the first attempt — that was skipping the working opener.)
  const queue = [...candidates];
  const tryNext = () => {
    const next = queue.shift();
    if (!next) return;
    let child;
    try {
      child = spawn(next[0], next[1], { stdio: "ignore", detached: true });
    } catch {
      return tryNext();
    }
    child.once("error", tryNext); // not installed → next candidate
    child.once("spawn", () => child.unref()); // launched → detach, stop trying
  };
  tryNext();
}

// Run the whole loopback flow. Returns a Google id_token.
// onUrl(url) is called with the consent URL so the caller can display it.
export async function loopbackLogin({ clientId, clientSecret, onUrl, timeoutMs = 180000 }) {
  const { verifier, challenge } = pkce();
  const state = b64url(crypto.randomBytes(16));

  // Start the loopback server on an ephemeral port first, so we know the redirect.
  const { port, waitForCode, close } = await startServer(state);
  const redirectUri = `http://127.0.0.1:${port}`;

  const authUrl =
    AUTH_URL +
    "?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      access_type: "online",
      prompt: "select_account",
    }).toString();

  onUrl?.(authUrl);
  openBrowser(authUrl);

  let code;
  try {
    code = await waitForCode(timeoutMs);
  } finally {
    close();
  }

  // Exchange the authorization code for tokens (PKCE proves we started the flow).
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`Google token exchange failed: ${detail}`);
  }
  return data.id_token;
}

const PAGE = (title, body) =>
  `<!doctype html><meta charset=utf-8><title>${title}</title>` +
  `<style>html{font:16px system-ui;background:#0b0f14;color:#e6edf3;height:100%}` +
  `body{display:grid;place-items:center;height:100%;margin:0}` +
  `.c{text-align:center;padding:2rem 3rem;border:1px solid #1f2730;border-radius:14px;background:#0f1620}` +
  `h1{font-size:1.4rem;margin:.2rem 0}p{color:#9aa7b4;margin:.3rem 0}</style>` +
  `<div class=c>${body}</div>`;

function startServer(expectedState) {
  return new Promise((resolve) => {
    let resolveCode, rejectCode;
    const codePromise = new Promise((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    // Track open sockets so we can forcibly destroy them on teardown; otherwise
    // a browser keep-alive connection keeps the event loop (and CLI) alive.
    const sockets = new Set();

    const server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname !== "/") {
        res.writeHead(404).end();
        return;
      }
      const err = u.searchParams.get("error");
      const code = u.searchParams.get("code");
      const state = u.searchParams.get("state");

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Connection", "close"); // don't let the browser keep the socket (and the CLI) alive
      if (err) {
        res.writeHead(400).end(PAGE("Sign-in failed", `<h1>❌ Sign-in failed</h1><p>${err}</p>`));
        rejectCode(new Error(`Authorization denied: ${err}`));
      } else if (!code || state !== expectedState) {
        res.writeHead(400).end(PAGE("Sign-in failed", `<h1>❌ Invalid response</h1><p>State mismatch.</p>`));
        rejectCode(new Error("State mismatch — possible CSRF; aborting."));
      } else {
        res.writeHead(200).end(
          PAGE(
            "Signed in",
            `<h1>✅ Signed in</h1><p>You can close this tab and return to the terminal.</p>`
          )
        );
        resolveCode(code);
      }
    });

    server.on("connection", (s) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });

    // Stop listening and destroy any lingering sockets so the process can exit.
    const close = () => {
      server.close();
      server.closeAllConnections?.();
      for (const s of sockets) s.destroy();
    };

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      // Clear the timeout as soon as the code settles — an uncleared timer would
      // keep the event loop (and the CLI) alive for the full timeout after login.
      const waitForCode = (timeoutMs) =>
        new Promise((res, rej) => {
          const t = setTimeout(
            () => rej(new Error("Timed out waiting for the browser sign-in.")),
            timeoutMs
          );
          codePromise.then(
            (code) => (clearTimeout(t), res(code)),
            (err) => (clearTimeout(t), rej(err))
          );
        });
      resolve({ port, waitForCode, close });
    });
  });
}
