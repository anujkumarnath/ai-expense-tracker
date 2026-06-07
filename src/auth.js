// Bearer auth. Accepts EITHER:
//  - the static AUTH_TOKEN (Tasker, curl, scripts), or
//  - a Worker session token from Google sign-in (dashboard) — see jwt.js / google.js.

import { json } from "./http.js";
import { verifySession } from "./jwt.js";

/**
 * Returns null if authorized, otherwise a 401 Response.
 * Usage:  const unauth = await requireAuth(request, env); if (unauth) return unauth;
 */
export async function requireAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: "Unauthorized" }, 401);

  // Static token (non-browser callers).
  if (env.AUTH_TOKEN && token === env.AUTH_TOKEN) return null;

  // Dashboard session token (issued after Google sign-in).
  if (env.SESSION_SECRET) {
    const payload = await verifySession(token, env.SESSION_SECRET);
    if (payload) return null;
  }

  return json({ error: "Unauthorized" }, 401);
}
