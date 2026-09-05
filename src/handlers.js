// Request handlers. Piece 4 implements /parse; REST endpoints come in Piece 5.

import { ObjectId } from "mongodb";
import { json, text, corsHeaders } from "./http.js";
import { withDb, expensesCol, reportsCol } from "./db.js";
import { parseExpense } from "./llm.js";
import { mirrorToSheets } from "./sheets.js";
import {
  istMidnightISO,
  toDisplayDate,
  displayFromDate,
  currentMonthIST,
  isValidMonth,
  isValidDate,
  monthRangeIST,
  dayRangeIST,
  daysBetween,
  toDisplayMonth,
  todayISTymd,
} from "./dates.js";
import { computeSummary, daysInMonth } from "./summary.js";
import { generateMonthlyReport } from "./report.js";
import { CATEGORIES } from "./constants.js";
import { log, errorText } from "./errors.js";
import { verifyGoogleIdToken } from "./google.js";
import { signSession } from "./jwt.js";

const SESSION_TTL = 7 * 24 * 3600; // 7 days

// -------- POST /auth/google --------  (public: exchange Google ID token for a session)
export async function handleGoogleAuth(request, env) {
  const body = await request.json().catch(() => ({}));
  const idToken = body.idToken || body.credential;
  if (!idToken) return json({ error: "Missing idToken" }, 400);

  let user;
  try {
    user = await verifyGoogleIdToken(idToken, env);
  } catch (err) {
    const code = err.code === "forbidden" ? 403 : err.code === "config" ? 500 : 401;
    log(`google sign-in rejected: ${err.message}`);
    return json({ error: err.message || "Sign-in failed" }, code);
  }
  if (!env.SESSION_SECRET) return json({ error: "Server not configured: SESSION_SECRET missing" }, 500);

  const token = await signSession({ email: user.email, sub: user.sub }, env.SESSION_SECRET, SESSION_TTL);
  log(`google sign-in ok: ${user.email}`);
  return json({ token, email: user.email, expiresIn: SESSION_TTL });
}

/** Read the natural-language text from the request (raw text or {text:...} JSON). */
async function readText(request) {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return (body.text || body.message || "").toString();
  }
  return (await request.text()).toString();
}

/** Build a Mongo query to locate the most recent transaction matching UPDATE/DELETE. */
function buildMatchQuery(match = {}) {
  const q = {};
  if (match.category) q.category = match.category;
  if (match.date) q.date = istMidnightISO(match.date);
  if (Array.isArray(match.keywords) && match.keywords.length) {
    const escaped = match.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const rx = { $regex: escaped.join("|"), $options: "i" };
    q.$or = [{ item: rx }, { note: rx }]; // note = legacy field name
  }
  return q;
}

async function findRecentMatch(col, match) {
  const q = buildMatchQuery(match);
  return col.find(q).sort({ date: -1, createdAt: -1 }).limit(1).next();
}

const confirm = (amount, category, item) =>
  `✅ ₹${amount} → ${category} | ${item}`;

// Read the item value, falling back to the legacy `note` field on old records.
const itemOf = (doc) => doc.item ?? doc.note ?? "";

export async function handleParse(request, env, ctx) {
  try {
    return await runParse(request, env, ctx);
  } catch (err) {
    return errorText(err, "/parse");
  }
}

async function runParse(request, env, ctx) {
  const input = await readText(request);
  log(`/parse in: "${input.slice(0, 80)}"`);
  const parsed = await parseExpense(input, env);
  log(`/parse intent=${parsed.intent}`);

  const now = new Date();

  return withDb(env, async (db) => {
  const col = expensesCol(db);

  // -------- ADD / SPLIT --------
  if (parsed.intent === "ADD" || parsed.intent === "SPLIT") {
    const doc = {
      date: istMidnightISO(parsed.date),
      displayDate: toDisplayDate(parsed.date),
      amount: parsed.amount,
      category: parsed.category,
      item: parsed.item,
      source: parsed.source,
      currency: "INR",
      createdAt: now,
      updatedAt: now,
    };
    if (parsed.splitInfo) doc.splitInfo = parsed.splitInfo;

    const result = await col.insertOne(doc);
    log(`added ${result.insertedId} ₹${doc.amount} ${doc.category}`);

    ctx.waitUntil(
      mirrorToSheets(
        {
          _id: String(result.insertedId),
          type: "ADD",
          date: doc.displayDate,
          amount: doc.amount,
          category: doc.category,
          item: doc.item,
          source: doc.source,
          currency: "INR",
          totalBill: doc.splitInfo?.totalBill,
          splitWith: doc.splitInfo?.splitWith,
        },
        env
      )
    );

    return text(confirm(doc.amount, doc.category, doc.item));
  }

  // -------- UPDATE --------
  if (parsed.intent === "UPDATE") {
    const existing = await findRecentMatch(col, parsed.match);
    if (!existing) {
      return text("⚠️ No matching transaction found to update.", 404);
    }
    const set = { ...parsed.patch, updatedAt: now };
    await col.updateOne({ _id: existing._id }, { $set: set });
    const updated = { ...existing, ...parsed.patch };
    log(`updated ${existing._id} ${JSON.stringify(parsed.patch)}`);

    ctx.waitUntil(
      mirrorToSheets(
        {
          _id: String(existing._id),
          type: "UPDATE",
          date: updated.displayDate,
          amount: updated.amount,
          category: updated.category,
          item: itemOf(updated),
          source: updated.source,
          currency: "INR",
          totalBill: updated.splitInfo?.totalBill,
          splitWith: updated.splitInfo?.splitWith,
        },
        env
      )
    );

    return text(`✅ Updated ₹${updated.amount} → ${updated.category} | ${itemOf(updated)}`);
  }

  // -------- DELETE --------
  if (parsed.intent === "DELETE") {
    const existing = await findRecentMatch(col, parsed.match);
    if (!existing) {
      return text("⚠️ No matching transaction found to delete.", 404);
    }
    await col.deleteOne({ _id: existing._id });
    log(`deleted ${existing._id}`);
    return text(`🗑️ Deleted ₹${existing.amount} → ${existing.category} | ${itemOf(existing)}`);
  }

  return json({ error: "Unhandled intent" }, 400);
  });
}

/** Shape an expense doc for the client (ObjectId -> string). */
function serialize(doc) {
  const { _id, ...rest } = doc;
  return { _id: String(_id), ...rest };
}

// -------- GET /expenses --------
// Two modes:
//   ?month=YYYY-MM                  (whole month, default = current IST month)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  (inclusive custom range)
export async function handleGetExpenses(request, env) {
  const url = new URL(request.url);
  const qFrom = url.searchParams.get("from");
  const qTo = url.searchParams.get("to");
  const qMonth = url.searchParams.get("month");

  let from, to, start, end, days, month = null, displayMonth = null;

  if (qFrom || qTo) {
    if (!isValidDate(qFrom) || !isValidDate(qTo)) {
      return json({ error: "Invalid from/to, expected YYYY-MM-DD" }, 400);
    }
    if (qFrom > qTo) return json({ error: "'from' must be on or before 'to'" }, 400);
    from = qFrom;
    to = qTo;
    ({ start, end } = dayRangeIST(from, to));
    days = daysBetween(from, to);
  } else {
    month = qMonth || currentMonthIST();
    if (!isValidMonth(month)) return json({ error: "Invalid month, expected YYYY-MM" }, 400);
    displayMonth = toDisplayMonth(month);
    ({ start, end } = monthRangeIST(month));
    days = daysInMonth(month);
    from = `${month}-01`;
    to = `${month}-${String(days).padStart(2, "0")}`;
  }

  return withDb(env, async (db) => {
    const docs = await expensesCol(db)
      .find({ date: { $gte: start, $lt: end } })
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    return json({
      month,
      displayMonth,
      from,
      to,
      days,
      range: { start: displayFromDate(start), end: displayFromDate(new Date(end.getTime() - 1)) },
      summary: computeSummary(docs, days),
      expenses: docs.map(serialize),
    });
  });
}

// -------- POST /expenses --------  (manual create, no AI)
export async function handleCreateExpense(request, env, ctx) {
  const body = await request.json().catch(() => ({}));

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) return json({ error: "Invalid amount" }, 400);
  if (body.category !== undefined && !CATEGORIES.includes(body.category)) {
    return json({ error: `Invalid category. Allowed: ${CATEGORIES.join(", ")}` }, 400);
  }
  const ymd = isValidDate(body.date) ? body.date : todayISTymd();
  const now = new Date();

  const doc = {
    date: istMidnightISO(ymd),
    displayDate: toDisplayDate(ymd),
    amount,
    category: body.category || "Other",
    item: String(body.item || "").trim(),
    source: body.source ? String(body.source).trim() : "Other",
    currency: "INR",
    createdAt: now,
    updatedAt: now,
  };
  if (body.splitInfo && typeof body.splitInfo === "object") doc.splitInfo = body.splitInfo;

  const insertedId = await withDb(env, async (db) => {
    const result = await expensesCol(db).insertOne(doc);
    return result.insertedId;
  });
  log(`created ${insertedId} ₹${amount} ${doc.category}`);

  ctx.waitUntil(
    mirrorToSheets(
      {
        _id: String(insertedId),
        type: "ADD",
        date: doc.displayDate,
        amount: doc.amount,
        category: doc.category,
        item: doc.item,
        source: doc.source,
        currency: "INR",
        totalBill: doc.splitInfo?.totalBill,
        splitWith: doc.splitInfo?.splitWith,
      },
      env
    )
  );

  return json({ ok: true, expense: serialize({ ...doc, _id: insertedId }) }, 201);
}

// -------- PUT /expenses/:id --------
export async function handlePutExpense(request, env, ctx, id) {
  if (!ObjectId.isValid(id)) return json({ error: "Invalid id" }, 400);

  const body = await request.json().catch(() => ({}));
  const patch = {};
  if (body.amount !== undefined) {
    const amt = Number(body.amount);
    if (!Number.isFinite(amt) || amt < 0) return json({ error: "Invalid amount" }, 400);
    patch.amount = amt;
  }
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return json({ error: "Invalid category" }, 400);
    patch.category = body.category;
  }
  if (body.source !== undefined) {
    const s = String(body.source).trim();
    if (!s) return json({ error: "Source cannot be empty" }, 400);
    patch.source = s; // free-form: any card/wallet name allowed
  }
  if (body.item !== undefined) patch.item = String(body.item);
  if (Object.keys(patch).length === 0) return json({ error: "No editable fields provided" }, 400);

  patch.updatedAt = new Date();
  const _id = new ObjectId(id);
  const updated = await withDb(env, async (db) => {
    const col = expensesCol(db);
    const res = await col.updateOne({ _id }, { $set: patch });
    if (res.matchedCount === 0) return null;
    return col.findOne({ _id });
  });
  if (!updated) return json({ error: "Not found" }, 404);
  // Dashboard edits are UPDATEs -> mirror to Sheets (spec: mirror every ADD/UPDATE)
  ctx.waitUntil(
    mirrorToSheets(
      {
        _id: id,
        type: "UPDATE",
        date: updated.displayDate,
        amount: updated.amount,
        category: updated.category,
        item: itemOf(updated),
        source: updated.source,
        currency: "INR",
        totalBill: updated.splitInfo?.totalBill,
        splitWith: updated.splitInfo?.splitWith,
      },
      env
    )
  );

  return json({ ok: true, expense: serialize(updated) });
}

// -------- DELETE /expenses/:id --------
export async function handleDeleteExpense(request, env, id) {
  if (!ObjectId.isValid(id)) return json({ error: "Invalid id" }, 400);
  const deletedCount = await withDb(env, async (db) =>
    (await expensesCol(db).deleteOne({ _id: new ObjectId(id) })).deletedCount
  );
  if (deletedCount === 0) return json({ error: "Not found" }, 404);
  return json({ ok: true });
}

// -------- GET /reports/:month --------
export async function handleGetReport(request, env, month) {
  if (!isValidMonth(month)) return json({ error: "Invalid month, expected YYYY-MM" }, 400);
  const report = await withDb(env, async (db) => reportsCol(db).findOne({ month }));
  if (!report) return json({ error: "Report not generated yet for this month" }, 404);
  const { _id, ...rest } = report;
  return json(rest);
}

// -------- POST /reports/:month --------  (on-demand generate/regenerate)
export async function handleGenerateReport(request, env, month) {
  if (!isValidMonth(month)) return json({ error: "Invalid month, expected YYYY-MM" }, 400);
  const report = await generateMonthlyReport(env, month);
  return json(report);
}

// -------- GET /app/download --------  (auth already checked in index.js —
// this is what actually gates the APK; run_worker_first in wrangler.toml
// means Cloudflare never serves it directly, only through this route)
export async function handleAppDownload(request, env) {
  const assetUrl = new URL("/expense-tracker.apk", request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (!asset.ok) return json({ error: "Download not available" }, 404);

  const headers = new Headers(asset.headers);
  headers.set("Content-Type", "application/vnd.android.package-archive");
  headers.set("Content-Disposition", 'attachment; filename="expense-tracker.apk"');
  // The dashboard fetches this cross-origin with a custom Authorization
  // header — without CORS headers here (json()/text() add these
  // automatically, this hand-built Response didn't), the browser blocks
  // the response from ever reaching the page's JS.
  for (const [key, value] of Object.entries(corsHeaders())) headers.set(key, value);
  return new Response(asset.body, { status: asset.status, headers });
}
