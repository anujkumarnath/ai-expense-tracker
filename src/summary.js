// Aggregation shared by GET /expenses (live summary) and the monthly report.

import { displayFromDate } from "./dates.js";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// "DD-MM-YYYY" -> sortable number YYYYMMDD
const sortable = (dmy) => {
  const [d, m, y] = dmy.split("-");
  return Number(`${y}${m}${d}`);
};

/** Calendar days in a "YYYY-MM". */
export function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Compute the full summary for a set of expense docs over `dayCount` days.
 * Returns numeric fields only; callers add any labels (month/range).
 */
export function computeSummary(expenses, dayCount = 1) {
  const grandTotal = round2(expenses.reduce((s, e) => s + (e.amount || 0), 0));
  const transactionCount = expenses.length;
  const avgPerDay = round2(grandTotal / Math.max(1, dayCount));

  // by category
  const catMap = new Map();
  for (const e of expenses) {
    const c = e.category || "Other";
    const cur = catMap.get(c) || { total: 0, count: 0 };
    cur.total += e.amount || 0;
    cur.count += 1;
    catMap.set(c, cur);
  }
  const breakdown = [...catMap.entries()]
    .map(([category, v]) => ({
      category,
      total: round2(v.total),
      count: v.count,
      percentage: grandTotal > 0 ? round2((v.total / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // by source (only need the leader)
  const srcMap = new Map();
  for (const e of expenses) {
    const s = e.source || "Other";
    srcMap.set(s, (srcMap.get(s) || 0) + (e.amount || 0));
  }
  const topSource = [...srcMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const topCategory = breakdown[0]?.category || "—";

  // daily trend
  const dayMap = new Map();
  for (const e of expenses) {
    const d = e.displayDate || displayFromDate(e.date);
    dayMap.set(d, (dayMap.get(d) || 0) + (e.amount || 0));
  }
  const dailyTrend = [...dayMap.entries()]
    .map(([date, total]) => ({ date, total: round2(total) }))
    .sort((a, b) => sortable(a.date) - sortable(b.date));

  return {
    grandTotal,
    transactionCount,
    avgPerDay,
    topCategory,
    topSource,
    breakdown,
    dailyTrend,
  };
}
