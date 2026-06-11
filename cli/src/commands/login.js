// Google sign-in for the CLI via OAuth 2.0 (PKCE + loopback) — like gcloud/gh.
//   exp login           browser sign-in → 7-day session token
//   exp logout          forget the saved token
//   exp whoami          show who you're signed in as

import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { settings, writeConfig, readConfig, configPath } from "../config.js";
import { loopbackLogin } from "../oauth.js";
import { api } from "../api.js";
import { CliError } from "../helpers.js";
import { c, log, nl, spinner } from "../ui.js";

export const meta = {
  name: "login",
  aliases: ["signin"],
  summary: "Sign in with Google (browser) and save a session token.",
  usage: "exp login   ·   exp logout   ·   exp whoami",
};

export async function run(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { reset: { type: "boolean" } }, // re-enter the OAuth client details
    allowPositionals: true,
  });

  const { apiBase } = settings();
  if (!apiBase)
    throw new CliError("API base URL is not set.", "Run `exp config` (or set EXPENSE_API_BASE) first.");

  const { clientId, clientSecret } = await ensureClient(values.reset);

  nl();
  log(`  ${c.cyan("Opening your browser to sign in with Google…")}`);

  let idToken;
  const sp = { stop() {} };
  try {
    idToken = await loopbackLogin({
      clientId,
      clientSecret,
      onUrl: (url) => {
        log(c.dim("  If it didn't open, visit this URL:"));
        log("  " + c.underline(url) + "\n");
      },
    });
  } catch (err) {
    throw new CliError(err.message, "Make sure this is a 'Desktop app' OAuth client.");
  }

  const s2 = spinner("Exchanging with the server…");
  let session;
  try {
    session = await api.googleAuth(idToken);
  } catch (err) {
    s2.stop();
    // The server rejects audiences it doesn't know — the most common setup miss.
    if (/audience/i.test(err.message))
      throw new CliError(
        "Server rejected this client (audience mismatch).",
        `Add this Desktop client ID to the Worker's GOOGLE_CLIENT_IDS and redeploy:\n  ${clientId}`
      );
    if (/not allowed/i.test(err.message))
      throw new CliError(err.message, "Add your email to ALLOWED_EMAILS on the Worker.");
    throw err;
  }
  s2.stop();

  writeConfig({
    token: session.token,
    email: session.email,
    tokenExpiry: Date.now() + (session.expiresIn || 7 * 24 * 3600) * 1000,
  });
  nl();
  log(`${c.green("✓")} Signed in as ${c.bold(session.email)}.`);
  log(c.dim(`  Session valid ~${Math.round((session.expiresIn || 604800) / 86400)} days. Saved to ${configPath()}`));
  nl();
}

// Logout / whoami live here too and are registered as their own commands.
export async function logout() {
  const had = readConfig().token;
  writeConfig({ token: "", email: "", tokenExpiry: 0 });
  log(had ? `${c.green("✓")} Signed out.` : c.dim("Already signed out."));
}

export async function whoami() {
  const s = settings();
  if (!s.token) {
    log(c.dim("Not signed in.") + ` Run ${c.cyan("exp login")}.`);
    return;
  }
  if (s.authKind === "google") {
    const left = s.tokenExpiry ? s.tokenExpiry - Date.now() : 0;
    const days = Math.floor(left / 86400000);
    const expiry =
      left <= 0
        ? c.red("expired — run `exp login`")
        : `${days}d ${Math.floor((left % 86400000) / 3600000)}h left`;
    log(`${c.green("●")} ${c.bold(s.email || "signed in")} ${c.dim("(Google)")}  ${c.dim(expiry)}`);
  } else {
    log(`${c.green("●")} Authenticated with a static token ${c.dim("(" + s.source + ")")}`);
  }
}

async function ensureClient(reset) {
  const s = settings();
  if (!reset && s.googleClientId && s.googleClientSecret)
    return { clientId: s.googleClientId, clientSecret: s.googleClientSecret };

  if (!process.stdin.isTTY)
    throw new CliError(
      "No OAuth client configured.",
      "Set EXPENSE_GOOGLE_CLIENT_ID and EXPENSE_GOOGLE_CLIENT_SECRET, or run `exp login` in a terminal."
    );

  nl();
  log(c.bold("  One-time: Google Desktop OAuth client"));
  log(c.dim("  Google Cloud Console → APIs & Services → Credentials →"));
  log(c.dim("  Create credentials → OAuth client ID → Application type: Desktop app."));
  log(c.dim("  Then add its Client ID to the Worker's GOOGLE_CLIENT_IDS and redeploy.\n"));

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const clientId = (await rl.question("  Desktop client ID: ")).trim();
  const clientSecret = (await rl.question("  Desktop client secret: ")).trim();
  rl.close();
  if (!clientId || !clientSecret) throw new CliError("Both client ID and secret are required.");

  writeConfig({ googleClientId: clientId, googleClientSecret: clientSecret });
  return { clientId, clientSecret };
}
