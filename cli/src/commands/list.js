import { parseArgs } from "node:util";
import { api } from "../api.js";
import { spinner, nl } from "../ui.js";
import { periodQuery, dailySeries } from "../helpers.js";
import {
  renderSummary,
  renderBreakdown,
  renderExpenses,
  renderDonut,
  renderTrend,
} from "../render.js";

export const meta = {
  name: "list",
  aliases: ["ls"],
  summary: "List transactions for a period, with a summary and breakdown.",
  usage: "exp ls [--month YYYY-MM | --from YYYY-MM-DD --to YYYY-MM-DD] [--all] [--bare]",
};

export async function run(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      month: { type: "string", short: "m" },
      from: { type: "string", short: "f" },
      to: { type: "string", short: "t" },
      all: { type: "boolean", short: "a" }, // show every row (no truncation)
      bare: { type: "boolean", short: "b" }, // table only (pipe-friendly)
      chart: { type: "boolean", short: "g" }, // add the visual charts
    },
    allowPositionals: true,
  });

  const { qs, label } = periodQuery(values);
  const sp = spinner("Fetching…");
  let data;
  try {
    data = await api.list(qs);
  } finally {
    sp.stop();
  }

  if (values.bare) {
    renderExpenses(data.expenses);
    return;
  }

  nl();
  renderSummary(data, label);
  if (values.chart) {
    renderDonut(data.summary || {});
    renderTrend(dailySeries(data.from, data.to, (data.summary || {}).dailyTrend));
  } else {
    renderBreakdown(data.summary || {});
  }
  renderExpenses(data.expenses, { limit: values.all ? undefined : 12 });
  nl();
}
