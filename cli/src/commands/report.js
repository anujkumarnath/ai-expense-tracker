// Monthly report: fetch the stored report, or (re)generate it on demand.
//   exp report            (current month)
//   exp report 2026-05
//   exp report 2026-05 --gen   (generate / regenerate)

import { parseArgs } from "node:util";
import { api, ApiError } from "../api.js";
import {
  CliError,
  isMonth,
  currentMonth,
  dailySeries,
  lastDayOfMonth,
} from "../helpers.js";
import { c, spinner, nl, log } from "../ui.js";
import { renderSummary, renderDonut, renderTrend } from "../render.js";

export const meta = {
  name: "report",
  aliases: ["rep"],
  summary: "Show or generate the monthly report.",
  usage: "exp report [YYYY-MM] [--gen]",
};

export async function run(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { gen: { type: "boolean", short: "g" } },
    allowPositionals: true,
  });

  const month = positionals[0] || currentMonth();
  if (!isMonth(month)) throw new CliError("Month must be YYYY-MM.", meta.usage);

  const sp = spinner(values.gen ? "Generating…" : "Fetching report…");
  let report;
  try {
    report = values.gen ? await api.genReport(month) : await api.getReport(month);
  } catch (err) {
    sp.stop();
    if (err instanceof ApiError && err.status === 404) {
      throw new CliError(
        `No report for ${month} yet.`,
        `Generate it with:  exp report ${month} --gen`
      );
    }
    throw err;
  }
  sp.stop();

  // Adapt the flat report doc into the summary shape the renderers expect.
  const summary = {
    grandTotal: report.grandTotal,
    transactionCount: report.transactionCount,
    avgPerDay: report.avgPerDay,
    topCategory: report.topCategory,
    topSource: report.topSource,
    breakdown: report.breakdown || [],
  };

  nl();
  if (values.gen) log(`${c.green("✓")} ${c.dim("Report (re)generated.")}\n`);
  renderSummary({ summary, displayMonth: report.displayMonth }, month);
  renderDonut(summary);

  // Full-month daily-spend column chart (gaps filled with 0).
  const from = `${month}-01`;
  const to = `${month}-${String(lastDayOfMonth(month)).padStart(2, "0")}`;
  renderTrend(dailySeries(from, to, report.dailyTrend), { height: 7 });

  nl();
  log(c.dim(`  generated ${new Date(report.generatedAt).toLocaleString()}`));
  nl();
}
