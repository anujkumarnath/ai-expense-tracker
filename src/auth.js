// Static Bearer token auth. Every protected endpoint calls requireAuth first.

import { json } from "./http.js";

/**
 * Returns null if the request is authorized, otherwise a 401 Response.
 * Usage:  const unauth = requireAuth(request, env); if (unauth) return unauth;
 */
export function requireAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!env.AUTH_TOKEN || token !== env.AUTH_TOKEN) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}
