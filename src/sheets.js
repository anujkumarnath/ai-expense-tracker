// Passive mirror/backup to an existing Google Apps Script web app.
// Best-effort only: failures here must never break the primary Mongo write,
// so the caller runs this via ctx.waitUntil and we swallow errors (after log).

/**
 * @param {object} payload  flat object matching apps-script/Code.gs columns
 * @param {object} env      must contain SHEETS_WEBHOOK_URL
 */
export async function mirrorToSheets(payload, env) {
  if (!env.SHEETS_WEBHOOK_URL) return; // mirror is optional
  try {
    const res = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // secret must match the Apps Script's SHARED_SECRET script property
      body: JSON.stringify({ ...payload, secret: env.SHEETS_SHARED_SECRET }),
      redirect: "follow", // Apps Script 302-redirects to googleusercontent
    });
    if (!res.ok) {
      console.log(`Sheets mirror non-OK: ${res.status}`);
    }
  } catch (err) {
    console.log(`Sheets mirror failed: ${String(err)}`);
  }
}
