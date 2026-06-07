// Monthly report generation. Triggered by the cron handler on the 1st (IST)
// for the previous month, but also reusable on demand (e.g. backfill).

import { withDb, expensesCol, reportsCol } from "./db.js";
import { monthRangeIST, toDisplayMonth } from "./dates.js";
import { computeSummary, daysInMonth } from "./summary.js";

/**
 * Build and upsert the report for a given "YYYY-MM".
 * Upsert (not insert) so re-runs for the same month are idempotent.
 * Returns the stored report document.
 */
export async function generateMonthlyReport(env, ym) {
  const { start, end } = monthRangeIST(ym);

  return withDb(env, async (db) => {
    const docs = await expensesCol(db)
      .find({ date: { $gte: start, $lt: end } })
      .sort({ date: 1, createdAt: 1 })
      .toArray();

    const summary = computeSummary(docs, daysInMonth(ym));

    const report = {
      month: ym,
      displayMonth: toDisplayMonth(ym),
      generatedAt: new Date(),
      breakdown: summary.breakdown,
      dailyTrend: summary.dailyTrend,
      grandTotal: summary.grandTotal,
      transactionCount: summary.transactionCount,
      avgPerDay: summary.avgPerDay,
      topCategory: summary.topCategory,
      topSource: summary.topSource,
    };

    await reportsCol(db).updateOne({ month: ym }, { $set: report }, { upsert: true });
    return report;
  });
}
