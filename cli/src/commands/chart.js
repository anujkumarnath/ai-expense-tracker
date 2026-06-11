// Visual dashboard in the terminal: category share (donut-equivalent) + daily
// spend column chart, for a month or custom range.
//   exp chart                 this month
//   exp chart -m 2026-05
//   exp chart --from 2026-06-01 --to 2026-06-07
//   exp chart --trend         only the daily chart
//   exp chart --cat           only the category breakdown

import { parseArgs } from "node:util";
import { api } from "../api.js";
import { spinner, nl, log, c } from "../ui.js";
import { periodQuery, dailySeries } from "../helpers.js";
import { renderSummary, renderDonut, renderTrend } from "../render.js";

export const meta = {
  name: "chart",
  aliases: ["graph", "g", "viz"],
  summary: "Visualise spending: category share + daily-trend charts.",
  usage: "exp chart [-m YYYY-MM | --from … --to …] [--trend] [--cat] [--height N]",
};

export async function run(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      month: { type: "string", short: "m" },
      from: { type: "string", short: "f" },
      to: { type: "string", short: "t" },
      trend: { type: "boolean" },
      cat: { type: "boolean" },
      height: { type: "string", short: "h" },
    },
    allowPositionals: true,
  });

  const { qs, label } = periodQuery(values);
  const sp = spinner("Crunching numbers…");
  let data;
  try {
    data = await api.list(qs);
  } finally {
    sp.stop();
  }

  const summary = data.summary || {};
  if (!summary.transactionCount) {
    nl();
    log(c.dim("  No spending in this period — nothing to chart."));
    nl();
    return;
  }

  // --trend and --cat are opt-ins; with neither, show both.
  const showCat = values.cat || !values.trend;
  const showTrend = values.trend || !values.cat;
  const height = Math.max(4, Math.min(16, Number(values.height) || 7));

  nl();
  renderSummary(data, label);
  if (showCat) renderDonut(summary);
  if (showTrend) {
    const series = dailySeries(data.from, data.to, summary.dailyTrend);
    renderTrend(series, { height });
  }
  nl();
}
