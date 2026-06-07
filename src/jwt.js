// Minimal HS256 JWT for Worker-issued dashboard sessions (signed with SESSION_SECRET).
// Used only for our own session tokens — Google's ID token is verified separately.

const enc = new TextEncoder();

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlStr = (str) => b64url(enc.encode(str));

function b64urlToStr(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return atob(s + "=".repeat(pad));
}

const hmacKey = (secret) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** Sign a session token. ttlSec = lifetime in seconds. */
export async function signSession(payload, secret, ttlSec) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlStr(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const data = `${header}.${body}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

/** Verify a session token; returns the payload if valid & unexpired, else null. */
export async function verifySession(token, secret) {
  if (!token || token.split(".").length !== 3) return null;
  const [h, p, s] = token.split(".");
  const expected = b64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(`${h}.${p}`)));
  if (expected !== s) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlToStr(p));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
