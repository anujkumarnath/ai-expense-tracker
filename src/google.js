// Verify a Google Identity Services ID token and enforce the email allowlist.
// Uses Google's tokeninfo endpoint (Google validates the signature); we then
// check audience, issuer, verification, expiry, and ALLOWED_EMAILS. This runs
// only at login (≈ once per session), so the extra round-trip is fine.

export async function verifyGoogleIdToken(idToken, env) {
  // Accept the dashboard's web client plus any extra clients (e.g. the CLI's
  // Desktop OAuth client) listed in GOOGLE_CLIENT_IDS (comma-separated).
  const allowedAud = [env.GOOGLE_CLIENT_ID, ...String(env.GOOGLE_CLIENT_IDS || "").split(",")]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  if (allowedAud.length === 0) throw new Error("GOOGLE_CLIENT_ID is not set");
  if (!idToken) throw new Error("Missing Google token");

  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Invalid Google token");
  const info = await res.json();

  const iss = info.iss || "";
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") throw new Error("Bad token issuer");
  if (!allowedAud.includes(info.aud)) throw new Error("Token audience mismatch");
  if (String(info.email_verified) !== "true") throw new Error("Google email not verified");
  if (Number(info.exp) * 1000 < Date.now()) throw new Error("Google token expired");

  const email = String(info.email || "").toLowerCase();
  const allowed = String(env.ALLOWED_EMAILS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  if (allowed.length === 0) {
    const e = new Error("Server not configured: ALLOWED_EMAILS is empty");
    e.code = "config";
    throw e;
  }
  if (!allowed.includes(email)) {
    const e = new Error("This Google account is not allowed.");
    e.code = "forbidden";
    throw e;
  }

  return { email: info.email, sub: info.sub, name: info.name };
}
