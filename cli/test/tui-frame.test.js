// The TUI's one invariant: frame(state, W, H) returns exactly H lines, each
// exactly W visible columns — at any size, in any mode. That is what makes
// "never wraps, never shears" true. Run with: node --test
//
// Colors are forced ON so widths are measured through real ANSI sequences.
// (Must happen in a module imported before ui.js — see _force-color.js.)
import "./_force-color.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { frame, visibleExpenses } from "../src/tui/views.js";
import { width } from "../src/ui.js";

const expenses = [
  { _id: "a1b2c3d4e5f6a1b2c3d4e5f6", amount: 450, category: "Food", item: "team lunch at andhra bhavan with everyone", source: "upi", displayDate: "05-06-2026" },
  { _id: "b1b2c3d4e5f6a1b2c3d4e5f7", amount: 1250.5, category: "Groceries", item: "weekly groceries", source: "credit card", displayDate: "07-06-2026" },
  { _id: "c1b2c3d4e5f6a1b2c3d4e5f8", amount: 99, category: "Subscriptions", item: "spotify", source: "card", displayDate: "10-06-2026" },
  { _id: "d1b2c3d4e5f6a1b2c3d4e5f9", amount: 12345, category: "Shopping", item: "noise cancelling headphones — a very long item name to stress truncation", source: "emi", displayDate: "12-06-2026" },
  ...Array.from({ length: 40 }, (_, i) => ({
    _id: `e${i}b2c3d4e5f6a1b2c3d4e5${String(i).padStart(2, "0")}`,
    amount: 50 + i * 7,
    category: ["Food", "Transport", "Bills", "Health", "Other"][i % 5],
    item: `expense number ${i}`,
    source: i % 2 ? "upi" : "cash",
    displayDate: `${String((i % 28) + 1).padStart(2, "0")}-06-2026`,
  })),
];

const data = {
  from: "2026-06-01",
  to: "2026-06-30",
  expenses,
  summary: {
    grandTotal: 45210.5,
    transactionCount: expenses.length,
    avgPerDay: 1507,
    topCategory: "Food",
    topSource: "upi",
    breakdown: [
      { category: "Food", total: 18000, percentage: 40 },
      { category: "Shopping", total: 12345, percentage: 27 },
      { category: "Groceries", total: 8000, percentage: 18 },
      { category: "Transport", total: 4000, percentage: 9 },
      { category: "Other", total: 2865, percentage: 6 },
    ],
    dailyTrend: [
      { date: "05-06-2026", total: 450 },
      { date: "07-06-2026", total: 1250 },
      { date: "12-06-2026", total: 12345 },
      { date: "20-06-2026", total: 800 },
    ],
  },
};

const baseState = () => ({
  tab: "overview",
  month: "2026-06",
  data,
  loading: false,
  error: null,
  spin: 0,
  sel: 0,
  filter: "",
  sortAmount: false,
  mode: "view",
  input: { text: "", cur: 0 },
  edit: null,
  reports: {},
  message: "",
  pendingG: false,
});

const SIZES = [
  [60, 16], [70, 20], [80, 24], [90, 24], [100, 30], [120, 35], [160, 45],
  [59, 15], [240, 60], // too-small and huge
];

function assertExact(state, label) {
  for (const [W, H] of SIZES) {
    const { lines } = frame(state, W, H);
    assert.equal(lines.length, H, `${label} ${W}x${H}: line count`);
    lines.forEach((ln, i) => {
      assert.equal(width(ln), W, `${label} ${W}x${H}: row ${i} is ${width(ln)} cols, want ${W}`);
    });
  }
}

test("overview frame is exact at every size", () => {
  assertExact(baseState(), "overview");
});

test("transactions frame is exact at every size", () => {
  const s = baseState();
  s.tab = "tx";
  s.sel = 20; // mid-list, exercises windowing + scrollbar
  assertExact(s, "tx");
});

test("filtered + amount-sorted transactions", () => {
  const s = baseState();
  s.tab = "tx";
  s.filter = "food";
  s.sortAmount = true;
  assertExact(s, "filter");
  assert.ok(visibleExpenses(s).every((e) => `${e.item} ${e.category}`.toLowerCase().includes("food")));
});

test("empty month and empty filter results", () => {
  const s = baseState();
  s.data = { ...data, expenses: [], summary: { grandTotal: 0, transactionCount: 0, avgPerDay: 0, breakdown: [], dailyTrend: [] } };
  assertExact(s, "empty-overview");
  s.tab = "tx";
  assertExact(s, "empty-tx");
  s.data = data;
  s.filter = "zzzznomatch";
  assertExact(s, "no-match");
});

test("input modes place a cursor on the status row", () => {
  const s = baseState();
  s.mode = "add";
  s.input = { text: "coffee 120 at blue tokai", cur: 10 };
  assertExact(s, "add");
  const { cursor } = frame(s, 100, 30);
  assert.equal(cursor.row, 29);
  assert.equal(cursor.col, 4 + 10 + 1);
  s.mode = "search";
  assertExact(s, "search");
});

test("edit modal overlays exactly and positions its cursor", () => {
  const s = baseState();
  s.tab = "tx";
  s.mode = "edit";
  s.edit = {
    id: expenses[0]._id,
    ref: "d4e5f6",
    active: 2,
    fields: [
      { key: "amount", label: "Amount", text: "450", cur: 3 },
      { key: "category", label: "Category", text: "Food", cur: 4 },
      { key: "item", label: "Item", text: "team lunch", cur: 10 },
      { key: "source", label: "Source", text: "upi", cur: 3 },
    ],
  };
  assertExact(s, "edit");
  const { cursor } = frame(s, 100, 30);
  assert.ok(cursor && cursor.row > 1 && cursor.col > 1);
});

test("decimal percentages/amounts keep category rows colored (live-API shape)", () => {
  // Regression: the API sends e.g. percentage 47.7 and amount 3330.69; the
  // wider text used to overflow the row, and truncate() stripped its colors.
  const s = baseState();
  s.data = {
    ...data,
    summary: {
      ...data.summary,
      breakdown: [
        { category: "Investment", total: 33600, percentage: 47.7 },
        { category: "Subscriptions", total: 3330.69, percentage: 4.7 },
        { category: "Shopping", total: 2084.7, percentage: 2.9 },
      ],
    },
  };
  assertExact(s, "decimals");
  const { lines } = frame(s, 100, 30);
  const row = lines.find((l) => l.includes("Subscriptions") && l.includes("█"));
  assert.ok(row, "category row renders the full label");
  assert.match(row, /\x1b\[38;5;\d+m[^\x1b]*█/, "bar keeps its 256-color code");
});

test("truncate preserves ANSI codes when clipping", async () => {
  const { truncate } = await import("../src/ui.js");
  const colored = "\x1b[38;5;214m" + "█".repeat(20) + "\x1b[39m end";
  const cut = truncate(colored, 10);
  assert.equal(width(cut), 10);
  assert.ok(cut.includes("\x1b[38;5;214m"), "open code kept");
  assert.ok(cut.includes("\x1b[39m"), "close code kept");
});

test("reports tab: stored doc, not-found, fetching and error states", () => {
  const doc = {
    month: "2026-06",
    displayMonth: "June 2026",
    generatedAt: "2026-06-12T05:30:00.000Z",
    grandTotal: 45210.5,
    transactionCount: 44,
    avgPerDay: 1507.02,
    topCategory: "Food",
    topSource: "upi",
    breakdown: data.summary.breakdown,
    dailyTrend: data.summary.dailyTrend,
  };
  const s = baseState();
  s.tab = "report";
  s.reports = { "2026-06": { doc } };
  assertExact(s, "report-doc");
  const { lines } = frame(s, 100, 30);
  assert.ok(lines.some((l) => l.includes("Report generated")), "shows the generated stamp");

  s.reports = { "2026-06": { notFound: true } };
  assertExact(s, "report-missing");
  assert.ok(
    frame(s, 100, 30).lines.some((l) => l.includes("No report for June 2026")),
    "prompts to generate"
  );

  s.reports = {};
  assertExact(s, "report-fetching");

  s.reports = { "2026-06": { error: "boom" } };
  assertExact(s, "report-error");
});

test("help overlay, confirm, loading and error frames", () => {
  const s = baseState();
  s.mode = "help";
  assertExact(s, "help");

  const cf = baseState();
  cf.tab = "tx";
  cf.mode = "confirm";
  assertExact(cf, "confirm");

  const ld = baseState();
  ld.data = null;
  ld.loading = true;
  assertExact(ld, "loading");

  const er = baseState();
  er.data = null;
  er.error = "Request timed out after 20s";
  assertExact(er, "error");
});
