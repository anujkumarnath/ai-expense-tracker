// Shared rendering of summaries, breakdowns and expense tables.

import {
  c,
  money,
  moneyShort,
  card,
  table,
  bar,
  dot,
  catColor,
  columnChart,
  stackedBar,
  pad,
  width,
  cols,
  nl,
  log,
} from "./ui.js";
import { refOf } from "./helpers.js";

// Big headline card: total + the key stats for a period.
export function renderSummary(data, periodLabel) {
  const s = data.summary || {};
  const label = data.displayMonth || periodLabel || data.month || "";
  const lines = [
    c.bold(c.green(money(s.grandTotal))) + c.dim("  spent"),
    "",
    `${c.dim("Transactions")}  ${pad(String(s.transactionCount ?? 0), 6)}` +
      `${c.dim("Avg / day")}  ${money(s.avgPerDay)}`,
    `${c.dim("Top category")}  ${dot(s.topCategory)} ${s.topCategory || "—"}`,
    `${c.dim("Top source  ")}  ${s.topSource || "—"}`,
  ];
  log(card(`  ${label}`, lines, { color: c.green, width: 46 }));
}

// Category breakdown as labelled bars (share of total).
export function renderBreakdown(summary) {
  const rows = summary.breakdown || [];
  if (!rows.length) return;
  const top = rows[0]?.total || 1;
  const labelW = Math.max(...rows.map((r) => width(r.category)));
  nl();
  log(c.dim("  Where it went"));
  for (const r of rows) {
    const col = catColor(r.category);
    log(
      "  " +
        col("●") +
        " " +
        pad(r.category, labelW) +
        "  " +
        col(bar(r.total / top, 16)) +
        "  " +
        pad(money(r.total), 11, "right") +
        "  " +
        c.dim(`${r.percentage}%`)
    );
  }
}

// Category share as a stacked bar + legend — the terminal "donut".
export function renderDonut(summary, { width: w } = {}) {
  const rows = summary.breakdown || [];
  if (!rows.length) return;
  const barW = Math.min(w || 50, cols() - 6);
  const segs = rows.map((r) => ({ value: r.total, color: catColor(r.category) }));
  nl();
  log(c.dim("  Category share"));
  log("  " + stackedBar(segs, barW));
  nl();
  // Two-column legend so it stays compact.
  const labelW = Math.max(...rows.map((r) => width(r.category)));
  const cells = rows.map(
    (r) =>
      catColor(r.category)("●") +
      " " +
      pad(r.category, labelW) +
      " " +
      c.dim(pad(`${r.percentage}%`, 6, "right")) +
      " " +
      pad(money(r.total), 11, "right")
  );
  const half = Math.ceil(cells.length / 2);
  for (let i = 0; i < half; i++) {
    const left = cells[i] || "";
    const right = cells[i + half] || "";
    log("  " + pad(left, labelW + 22) + "   " + right);
  }
}

// Daily spend as a vertical column chart over the whole period.
export function renderTrend(points, { height = 7 } = {}) {
  if (!points.length) return;
  // Trim to what fits the terminal (keep the most recent days).
  const maxCols = Math.floor((cols() - 8) / 2);
  let shown = points;
  let trimmed = 0;
  if (points.length > maxCols) {
    trimmed = points.length - maxCols;
    shown = points.slice(-maxCols);
  }
  nl();
  log(c.dim("  Daily spend") + (trimmed ? c.dim(`  (last ${shown.length} days)`) : ""));
  log(columnChart(shown, { height, format: moneyShort }));
  const peak = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);
  if (peak.value > 0) log(c.dim(`  peak ${money(peak.value)} on day ${peak.label}`));
}

// The transactions themselves.
export function renderExpenses(expenses, { limit } = {}) {
  let rows = expenses;
  let more = 0;
  if (limit && expenses.length > limit) {
    rows = expenses.slice(0, limit);
    more = expenses.length - limit;
  }
  if (!rows.length) {
    nl();
    log(c.dim("  No transactions in this period."));
    return;
  }
  nl();
  log(
    table(
      [
        { key: "ref", label: "REF", color: c.dim },
        { key: "displayDate", label: "DATE", color: c.gray },
        { key: "amount", label: "AMOUNT", align: "right", format: money, color: c.bold },
        { key: "category", label: "CATEGORY", format: (v) => `${catCell(v)}` },
        { key: "item", label: "ITEM", flex: true },
        { key: "source", label: "SOURCE", color: c.dim, flex: true },
      ],
      rows.map((e) => ({
        ref: refOf(e._id),
        displayDate: e.displayDate || e.date,
        amount: e.amount,
        category: e.category,
        item: e.item ?? e.note ?? "",
        source: e.source || "—",
      }))
    )
  );
  if (more) log(c.dim(`  … and ${more} more — narrow with --from/--to or see all with --all`));
}

function catCell(v) {
  return catColor(v)("● ") + v;
}

// Compact one-line confirmation used after a mutation.
export function ok(msg) {
  log(`${c.green("✓")} ${msg}`);
}
