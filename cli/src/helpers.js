// Shared helpers: IST dates, query building, partial-id resolution, errors.

import { api, ApiError } from "./api.js";
import { c } from "./ui.js";

// Everything in this app is IST (UTC+5:30), matching the server.
export function istNow() {
  return new Date(Date.now() + 5.5 * 3600 * 1000);
}
export function currentMonth() {
  const d = istNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function todayYMD() {
  const d = istNow();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

export const isMonth = (s) => /^\d{4}-\d{2}$/.test(s || "");
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

// Last calendar day of a "YYYY-MM".
export function lastDayOfMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Build a per-day series over [from, to] (YYYY-MM-DD), filling gaps with 0.
// dailyTrend entries are keyed by displayDate "DD-MM-YYYY".
export function dailySeries(from, to, dailyTrend = []) {
  const map = new Map(dailyTrend.map((t) => [t.date, t.total]));
  const pts = [];
  let d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  // Safety cap so a huge custom range can't run away.
  for (let i = 0; d <= end && i < 400; i++, d = new Date(d.getTime() + 86400000)) {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const key = `${dd}-${mm}-${d.getUTCFullYear()}`;
    pts.push({ label: dd, value: map.get(key) || 0 });
  }
  return pts;
}

// Turn list-style flags into a query string + a human label for the period.
export function periodQuery(flags) {
  if (flags.from || flags.to) {
    const from = flags.from || flags.to;
    const to = flags.to || flags.from;
    if (!isDate(from) || !isDate(to))
      throw new CliError("Dates must be YYYY-MM-DD (e.g. --from 2026-06-01).");
    return { qs: `from=${from}&to=${to}`, label: `${from} → ${to}` };
  }
  const month = flags.month || currentMonth();
  if (!isMonth(month)) throw new CliError("Month must be YYYY-MM (e.g. --month 2026-05).");
  return { qs: `month=${month}`, label: month };
}

// Resolve a full ObjectId from a full id or a trailing-ref (last N hex chars).
// Searches the given period (default current month) so `exp rm 4f2a9c` works.
export async function resolveId(ref, flags = {}) {
  if (/^[a-f0-9]{24}$/i.test(ref)) return ref;
  if (!/^[a-f0-9]{4,}$/i.test(ref))
    throw new CliError(`'${ref}' is not a valid id or ref (need 4+ hex chars).`);
  const { qs } = periodQuery(flags);
  const { expenses = [] } = await api.list(qs);
  const matches = expenses.filter((e) => e._id.toLowerCase().endsWith(ref.toLowerCase()));
  if (matches.length === 0)
    throw new CliError(
      `No transaction ending in '${ref}' in this period.`,
      "Try `exp ls --month YYYY-MM` to find it, or pass the full id."
    );
  if (matches.length > 1)
    throw new CliError(
      `Ref '${ref}' is ambiguous (${matches.length} matches). Use more characters.`
    );
  return matches[0]._id;
}

export const refOf = (id) => String(id).slice(-6);

// A user-facing error that prints cleanly (no stack trace).
export class CliError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

export function die(err) {
  if (err instanceof CliError || err instanceof ApiError) {
    console.error(`${c.red("✗")} ${err.message}`);
    if (err.hint) console.error(`  ${c.dim(err.hint)}`);
  } else {
    console.error(`${c.red("✗ Unexpected error:")} ${err?.message || err}`);
  }
  process.exitCode = 1;
}
