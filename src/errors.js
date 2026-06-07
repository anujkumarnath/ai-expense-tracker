// Central error handling + logging.
// - classifyError: turns any thrown error into { status, message } in plain English.
// - errorJson / errorText: build the client response AND log the raw detail.
// Raw stacks go to the logs (wrangler tail), never to the client.

import { json, text } from "./http.js";

export const log = (...args) => console.log("[et]", ...args);

export function classifyError(err) {
  const msg = String((err && err.message) || err);
  const name = err && err.name;

  // Missing secrets / config
  if (/is not set/i.test(msg)) return { status: 500, message: `Server not configured — ${msg}.` };

  // LLM (Groq)
  if (/api error 429|rate limit/i.test(msg))
    return { status: 429, message: "AI service is rate-limited. Wait a few seconds and try again." };
  if (/api error 4\d\d/i.test(msg))
    return { status: 502, message: "AI service rejected the request — check GROQ_API_KEY." };
  if (/api error 5\d\d/i.test(msg))
    return { status: 502, message: "AI service is temporarily unavailable. Try again shortly." };
  if (/no content|valid amount|unknown intent|no fields to patch/i.test(msg))
    return { status: 422, message: 'Couldn\'t understand that. Try e.g. "spent 200 on lunch via UPI".' };
  if (/empty input/i.test(msg)) return { status: 400, message: "No text received." };

  // MongoDB
  if (name === "MongoServerError" && /not allowed to do action|unauthorized/i.test(msg))
    return { status: 500, message: "Database permission error — the DB user needs the 'readWrite' role on 'expense_tracker' in Atlas." };
  if (/authentication failed|bad auth|password/i.test(msg))
    return { status: 500, message: "Database login failed — check the username/password in MONGODB_URI." };
  if (name === "MongoNetworkError" || /enotfound|econnrefused|server selection|timed out|topology|connect/i.test(msg))
    return { status: 503, message: "Can't reach the database — check MONGODB_URI and Atlas Network Access (0.0.0.0/0)." };

  return { status: 500, message: "Unexpected error. Run `npx wrangler tail` to see details." };
}

/** JSON error for REST endpoints. Logs raw detail server-side. */
export function errorJson(err, where) {
  console.error(`[et] ${where}:`, (err && err.stack) || String(err));
  const { status, message } = classifyError(err);
  return json({ ok: false, error: message }, status);
}

/** Plain-text error for /parse (clean Tasker toast). Logs raw detail server-side. */
export function errorText(err, where) {
  console.error(`[et] ${where}:`, (err && err.stack) || String(err));
  const { status, message } = classifyError(err);
  return text(`⚠️ ${message}`, status);
}
