// Shared HTTP helpers: JSON responses + CORS (dashboard on Pages is a
// different origin from the Worker, so every response needs CORS headers).
//
// The allowed browser origin is configured at runtime from the DASHBOARD_ORIGIN
// var (set via `wrangler secret put DASHBOARD_ORIGIN` or a Cloudflare dashboard
// variable) so no hosted URL is hardcoded in the repo. Defaults to "*" if unset.
// Non-browser callers (Tasker, curl, "OK Google") ignore CORS entirely — their
// auth boundary is the Bearer token.

let allowedOrigin = "*";

/** Call once per request with env.DASHBOARD_ORIGIN before building responses. */
export function setAllowedOrigin(origin) {
  allowedOrigin = origin || "*";
}

const corsHeaders = () => ({
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(), ...headers },
  });

export const text = (body, status = 200, headers = {}) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...corsHeaders(), ...headers },
  });

// Preflight response for browser CORS.
export const preflight = () => new Response(null, { status: 204, headers: corsHeaders() });
