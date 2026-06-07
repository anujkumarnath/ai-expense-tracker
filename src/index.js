// expense-tracker — Cloudflare Worker entry point
// Piece 2: routing + CORS + Bearer auth + MongoDB connection wired in.
// Business handlers (/parse, /expenses, /reports) still return 501 until built.

import { json, preflight, setAllowedOrigin } from "./http.js";
import { errorJson, log } from "./errors.js";
import { requireAuth } from "./auth.js";
import { pingDb } from "./db.js";
import { isFirstOfMonthIST, previousMonthIST } from "./dates.js";
import { generateMonthlyReport } from "./report.js";
import {
  handleGoogleAuth,
  handleParse,
  handleGetExpenses,
  handleCreateExpense,
  handlePutExpense,
  handleDeleteExpense,
  handleGetReport,
  handleGenerateReport,
} from "./handlers.js";

const notImplemented = (what) =>
  json({ error: "Not implemented yet", endpoint: what }, 501);

export default {
  async fetch(request, env, ctx) {
    setAllowedOrigin(env.DASHBOARD_ORIGIN); // locks browser CORS if configured
    try {
      return await route(request, env, ctx);
    } catch (err) {
      // Clean message to the client; full detail goes to the logs.
      return errorJson(err, `${request.method} ${new URL(request.url).pathname}`);
    }
  },

  async scheduled(event, env, ctx) {
    // Cron is "0 18 * * *" UTC == 00:00 IST. The trigger fires daily; only act
    // when it is the 1st of the month in IST, then report on the previous month.
    if (!isFirstOfMonthIST()) return;
    const month = previousMonthIST();
    ctx.waitUntil(
      generateMonthlyReport(env, month)
        .then(() => console.log(`Generated report for ${month}`))
        .catch((err) => console.log(`Report generation failed for ${month}: ${String(err)}`))
    );
  },
};

async function route(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === "OPTIONS") return preflight();

    // --- public: liveness probe (contract: returns { ok: true }) ---
    if (method === "GET" && pathname === "/health") {
      if (url.searchParams.get("check") === "db") {
        try {
          await pingDb(env);
          return json({ ok: true, db: "up" });
        } catch (err) {
          return json({ ok: false, db: "down", error: String(err.message || err) }, 503);
        }
      }
      return json({ ok: true });
    }

    // --- public: exchange a Google ID token for a dashboard session ---
    if (method === "POST" && pathname === "/auth/google") return handleGoogleAuth(request, env);

    // --- everything below requires auth ---
    const unauth = await requireAuth(request, env);
    if (unauth) {
      log(`401 ${method} ${pathname}`);
      return unauth;
    }
    // Log writes only (skip GET polling noise from the dashboard).
    if (method !== "GET") log(`${method} ${pathname}`);

    if (method === "POST" && pathname === "/parse") return handleParse(request, env, ctx);
    if (method === "GET" && pathname === "/expenses") return handleGetExpenses(request, env);
    if (method === "POST" && pathname === "/expenses") return handleCreateExpense(request, env, ctx);

    if (pathname.startsWith("/expenses/")) {
      const id = pathname.slice("/expenses/".length);
      if (method === "PUT") return handlePutExpense(request, env, ctx, id);
      if (method === "DELETE") return handleDeleteExpense(request, env, id);
    }

    if (pathname.startsWith("/reports/")) {
      const month = pathname.slice("/reports/".length);
      if (method === "GET") return handleGetReport(request, env, month);
      if (method === "POST") return handleGenerateReport(request, env, month);
    }

    return json({ error: "Not found" }, 404);
}
