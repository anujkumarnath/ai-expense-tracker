// Pure frame composition: frame(state, W, H) → { lines, cursor }.
//
// Every line is exactly W visible columns — nothing ever wraps, nothing ever
// shears. The runtime (index.js) owns state and keys; this file only renders.

import {
  c, money, moneyShort, bar, columnChart, stackedBar, catColor, pad, width, truncate,
} from "../ui.js";
import { currentMonth, dailySeries, lastDayOfMonth, refOf, todayYMD } from "../helpers.js";
import { fit, joinH, band, panel, tile, overlay } from "./widgets.js";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const monthLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const shiftMonth = (ym, delta) => {
  let [y, m] = ym.split("-").map(Number);
  m += delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
};

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// "05-06-2026" → "05 Jun" (compact, fixed 6 columns).
function fmtDay(e) {
  const m = /^(\d{2})-(\d{2})/.exec(e.displayDate || "");
  if (m) return `${m[1]} ${MONTHS[Number(m[2]) - 1].slice(0, 3)}`;
  return String(e.date || "").slice(5, 11);
}

// The transaction list the user actually sees: filter, then optional sort.
export function visibleExpenses(state) {
  let list = state.data?.expenses ? [...state.data.expenses] : [];
  const q = state.filter.trim().toLowerCase();
  if (q) {
    list = list.filter((e) =>
      [e.item, e.note, e.category, e.source, String(e.amount), refOf(e._id)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  if (state.sortAmount) list.sort((a, b) => b.amount - a.amount);
  return list;
}

// How many transaction rows fit on screen — the runtime uses this for
// half-page (ctrl-d/u) and page (PgUp/PgDn) movement.
export const txPageSize = (H) => Math.max(1, H - 4 - 3);

// ── Chrome: header band, status line, footer band ───────────────────────────

function header(state, W) {
  const s = state.data?.summary || {};
  const spin = state.loading ? " " + c.yellow(SPIN[state.spin % SPIN.length]) : "  ";
  const tab = (label, active) =>
    active ? c.bold(c.cyan(c.underline(label))) : c.dim(label);
  const tabs = (ov, tx, rp) =>
    tab(ov, state.tab === "overview") + c.dim("  ·  ") +
    tab(tx, state.tab === "tx") + c.dim("  ·  ") +
    tab(rp, state.tab === "report");
  const right =
    `${c.dim("‹")} ${c.bold(c.white(monthLabel(state.month)))} ${c.dim("›")}   ` +
    c.bold(c.green(money(s.grandTotal || 0))) +
    spin;
  // Shed the brand, then shorten the tab labels, as the terminal narrows.
  let left = ` 💸 ${c.bold("Expense")}   ` + tabs("Overview", "Transactions", "Reports");
  if (width(left) + width(right) + 2 > W) left = " " + tabs("Overview", "Transactions", "Reports");
  if (width(left) + width(right) + 2 > W) left = " " + tabs("Stats", "Txns", "Rep");
  const gap = Math.max(1, W - width(left) - width(right) - 1);
  return band(left + " ".repeat(gap) + right + " ", W, c.bgHeader);
}

function statusLine(state, W) {
  const { mode, input } = state;
  if (mode === "add") return fit("  " + c.green("›") + " " + input.text, W);
  if (mode === "search") return fit("  " + c.cyan("/") + " " + input.text, W);
  if (mode === "confirm") {
    const e = visibleExpenses(state)[state.sel];
    const what = e ? `${money(e.amount)} · ${e.item ?? e.note ?? ""}` : "";
    return fit("  " + c.yellow(`Delete ${what}? `) + c.bold("y") + c.dim("/n"), W);
  }
  if (state.message) return fit("  " + state.message, W);
  // Idle on the transactions tab: spell out the selected row (the table may
  // truncate the item), so the eye never has to guess.
  if (state.tab === "tx") {
    const e = visibleExpenses(state)[state.sel];
    if (e) {
      return fit(
        "  " +
          c.dim(
            `${refOf(e._id)} · ${fmtDay(e)} · ${money(e.amount)} · ` +
              `${e.item ?? e.note ?? "—"} (${e.category || "Other"}` +
              `${e.source ? " via " + e.source : ""})`
          ),
        W
      );
    }
  }
  return fit("", W);
}

function footer(state, W) {
  const key = (k, l) => c.bold(c.cyan(k)) + " " + c.dim(l);
  const sep = c.dim("  ·  ");
  let hints;
  switch (state.mode) {
    case "add":
      hints = c.dim('plain English — "coffee 120 at blue tokai"   ') +
        key("enter", "save") + sep + key("esc", "cancel");
      break;
    case "search":
      hints = key("enter", "apply") + sep + key("esc", "clear");
      break;
    case "confirm":
      hints = key("y", "delete") + sep + key("n", "keep");
      break;
    case "edit":
      hints = key("tab/↑↓", "field") + sep + key("enter", "save") + sep + key("esc", "cancel");
      break;
    case "help":
      hints = key("any key", "close");
      break;
    default: {
      // Ordered by importance; trailing hints are shed to fit the width.
      const all =
        state.tab === "tx"
          ? [key("j k", "move"), key("h l", "month"), key("a", "add"), key("e", "edit"),
             key("d", "delete"), key("/", "filter"), key("?", "help"), key("q", "quit"),
             key("s", "sort"), key("t", "today"), key("r", "refresh")]
          : state.tab === "report"
            ? [key("g", "generate"), key("h l", "month"), key("tab", "switch"), key("?", "help"),
               key("q", "quit"), key("t", "today"), key("r", "refresh")]
            : [key("tab", "switch"), key("h l", "month"), key("a", "add"), key("?", "help"),
               key("q", "quit"), key("j k", "browse"), key("t", "today"), key("r", "refresh")];
      // Prefer the airy separator; tighten it before dropping hints.
      const fitN = (s2) => {
        let n = all.length;
        while (n > 3 && width("  " + all.slice(0, n).join(s2)) > W - 1) n--;
        return n;
      };
      const nw = fitN(sep);
      if (nw === all.length) hints = all.join(sep);
      else {
        const tight = c.dim(" · ");
        hints = all.slice(0, Math.max(nw, fitN(tight))).join(tight);
      }
    }
  }
  return band("  " + hints, W, c.bgGray);
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function statTiles(s, iW) {
  const gap = 2;
  const four = iW >= 76;
  const n = four ? 4 : 2;
  const total = iW - gap * (n - 1);
  const base = Math.floor(total / n);
  const rem = total - base * n;
  const ws = Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));

  const defs = [
    ["Spent", money(s.grandTotal || 0), "this month", c.green],
    ["Transactions", String(s.transactionCount ?? 0), "logged", c.cyan],
    ["Avg / day", money(s.avgPerDay || 0), "burn rate", c.blue],
    ["Top category", s.topCategory || "—", s.topSource ? `via ${s.topSource}` : " ", catColor(s.topCategory)],
  ];
  const tiles = defs.map(([t, v, sub, col], i) => tile(t, v, sub, col, ws[i % n]));

  if (four) return joinH(tiles.map((lines, i) => ({ lines, w: ws[i] })), gap);
  return [
    ...joinH([{ lines: tiles[0], w: ws[0] }, { lines: tiles[1], w: ws[1] }], gap),
    ...joinH([{ lines: tiles[2], w: ws[0] }, { lines: tiles[3], w: ws[1] }], gap),
  ];
}

function categoryBody(s, cw, rows) {
  const cats = (s.breakdown || []).slice(0, Math.max(1, rows - 1));
  if (!cats.length) return ["", c.dim("Nothing logged yet.")];
  const amtW = Math.max(...cats.map((r) => width(money(r.total))));
  // The API sends decimal percentages (e.g. 47.7) — display them rounded,
  // and measure the column instead of assuming "100%" is the widest.
  const pct = (r) => `${Math.round(r.percentage)}%`;
  const pctW = Math.max(...cats.map((r) => width(pct(r))));
  const avail = Math.max(10, cw - (2 + 2 + 2 + amtW + 1 + pctW));
  // Category names get their full length; the bar absorbs what's left.
  const maxCat = Math.max(...cats.map((r) => width(r.category)));
  const labelW = Math.max(6, Math.min(maxCat, avail - 6));
  const barW = Math.max(4, avail - labelW);
  const top = cats[0]?.total || 1;
  const out = [""];
  for (const r of cats) {
    const col = catColor(r.category);
    out.push(
      col("●") + " " + fit(r.category, labelW) + "  " +
        col(bar(r.total / top, barW)) + "  " +
        pad(money(r.total), amtW, "right") + " " +
        c.dim(pad(pct(r), pctW, "right"))
    );
  }
  return out;
}

function trendBody(month, dailyTrend, cw, rows) {
  const from = `${month}-01`;
  let to = `${month}-${String(lastDayOfMonth(month)).padStart(2, "0")}`;
  // The current month ends today — future days are always empty space.
  const today = todayYMD();
  if (month === currentMonth() && today < to && today >= from) to = today;
  const series = dailySeries(from, to, dailyTrend);
  if (!series.some((p) => p.value > 0)) return ["", c.dim("No daily activity.")];
  const chartH = Math.max(3, rows - 3); // minus top padding + baseline + x-labels
  const gutter = Math.max(3, width(moneyShort(Math.max(...series.map((p) => p.value)))));
  const room = cw - gutter - 3;
  // Prefer roomy 2-wide columns; squeeze to 1-wide before cutting days off.
  const colW = series.length * 2 <= room ? 2 : 1;
  const maxCols = Math.max(5, Math.floor(room / colW));
  const shown = series.length > maxCols ? series.slice(-maxCols) : series;
  return ["", ...columnChart(shown, { height: chartH, colW, format: moneyShort }).split("\n")];
}

function shareLines(s, iW) {
  const cats = s.breakdown || [];
  if (!cats.length) return [];
  const segs = cats.map((r) => ({ value: r.total, color: catColor(r.category) }));
  // Legend: whole entries only — drop the tail with a "+N more" rather than
  // cutting a category name in half.
  const entries = cats.map(
    (r) => catColor(r.category)("●") + c.dim(` ${r.category} ${Math.round(r.percentage)}%`)
  );
  let legend = "";
  let used = 0;
  for (let i = 0; i < entries.length; i++) {
    const sep = i ? "   " : "";
    const more = entries.length - i - 1;
    const reserve = more ? 9 : 0; // room for a potential "  +N more"
    if (used + width(sep + entries[i]) + reserve > iW - 2 && i) {
      legend += c.dim(`   +${entries.length - i} more`);
      break;
    }
    legend += sep + entries[i];
    used += width(sep + entries[i]);
  }
  return [fit("  " + stackedBar(segs, iW - 2), iW + 4), fit("  " + legend, iW + 4)];
}

function recentBody(state, cw, rows) {
  const list = state.data?.expenses || [];
  if (!list.length) return [c.dim("Nothing yet — press 'a' to log your first expense.")];
  const amtW = 9;
  const catW = catColW(list.slice(0, rows));
  const itemW = Math.max(8, cw - (6 + 2 + amtW + 2 + catW + 2));
  return list.slice(0, rows).map((e) => {
    const cat = e.category || "Other";
    return (
      c.gray(fmtDay(e)) + "  " +
      c.bold(pad(money(e.amount), amtW, "right")) + "  " +
      fit(catColor(cat)("● ") + truncate(cat, catW - 2), catW) + "  " +
      fit(e.item ?? e.note ?? "", itemW)
    );
  });
}

// Stat tiles + category/trend panels + share bar, fitted into `budgetH` rows.
// Works for the live summary and for stored report docs (same field shape).
// With `expand` the charts absorb spare rows; otherwise the leftover is
// returned for the caller (the overview hangs its Recent panel there).
function summaryBlock(s, month, W, budgetH, { expand = true } = {}) {
  const iW = W - 4;
  const M = "  ";
  const out = [];

  const share = shareLines(s, iW);
  const shareH = share.length ? share.length + 1 : 0;

  // Stat tiles — or a one-line summary when they would starve the charts.
  const tiles = statTiles(s, iW);
  if (budgetH >= tiles.length + 1 + 7 + shareH) {
    for (const ln of tiles) out.push(M + ln);
  } else {
    out.push(
      M + " " +
        c.dim("Spent ") + c.bold(c.green(money(s.grandTotal || 0))) +
        c.dim(` · ${s.transactionCount ?? 0} txns · avg `) + money(s.avgPerDay || 0) +
        c.dim("/day · top ") + catColor(s.topCategory)(s.topCategory || "—")
    );
  }
  out.push("");

  let remaining = budgetH - out.length - shareH;
  const sideBySide = iW >= 88;
  let chartH = Math.max(7, Math.min(12, remaining));
  let leftover = 0;
  if (!expand && remaining - chartH >= 7) {
    leftover = remaining - chartH;
  } else {
    chartH = Math.min(14, Math.max(5, remaining));
  }

  if (sideBySide) {
    const Lw = Math.max(34, Math.min(54, Math.floor((iW - 2) * 0.48)));
    const Rw = iW - 2 - Lw;
    const left = panel({
      title: "Categories", w: Lw, h: chartH,
      body: categoryBody(s, Lw - 4, chartH - 2),
    });
    const rightP = panel({
      title: "Daily spend", w: Rw, h: chartH,
      body: trendBody(month, s.dailyTrend, Rw - 4, chartH - 2),
    });
    for (const ln of joinH([{ lines: left, w: Lw }, { lines: rightP, w: Rw }], 2)) {
      out.push(M + ln);
    }
  } else {
    // Narrow: categories first; the trend only if it still fits comfortably.
    const catH = Math.min(10, chartH);
    for (const ln of panel({
      title: "Categories", w: iW, h: catH, body: categoryBody(s, iW - 4, catH - 2),
    })) out.push(M + ln);
    const rest = chartH - catH;
    if (rest >= 7) {
      for (const ln of panel({
        title: "Daily spend", w: iW, h: rest,
        body: trendBody(month, s.dailyTrend, iW - 4, rest - 2),
      })) out.push(M + ln);
    }
  }

  if (share.length) {
    out.push("");
    for (const ln of share) out.push(ln);
  }
  return { lines: out, leftover };
}

function overviewBody(state, W, bodyH) {
  const iW = W - 4;
  const M = "  ";
  const s = state.data?.summary || {};
  const { lines, leftover } = summaryBlock(s, state.month, W, bodyH, { expand: false });

  if (leftover >= 7) {
    lines.push("");
    for (const ln of panel({
      title: "Recent", right: "tab → all", w: iW, h: leftover - 1,
      body: recentBody(state, iW - 4, leftover - 3),
    })) lines.push(M + ln);
  }
  return lines;
}

// ── Transactions tab ─────────────────────────────────────────────────────────

// Widest category name in a list (+2 for the dot), so names never truncate.
const catColW = (list) =>
  Math.min(
    18,
    Math.max(10, 2 + Math.max(0, ...list.map((e) => width(e.category || "Other"))))
  );

// Widest source in a list — the item column is flex, so give sources room.
const srcColW = (list) =>
  Math.min(24, Math.max(8, ...list.map((e) => width(e.source || "—"))));

// Responsive column plan for a content width `cw`.
function txColumns(cw, catW, srcW = 10) {
  const all = [
    { id: "date", label: "DATE", w: 6 },
    { id: "amt", label: "AMOUNT", w: 10, right: true },
    { id: "cat", label: "CATEGORY", w: catW },
    { id: "item", label: "ITEM", w: 0, flex: true },
    { id: "src", label: "SOURCE", w: srcW },
    { id: "ref", label: "REF", w: 6 },
  ];
  const MARKER = 2;
  const GAP = 2;
  const need = (cols) =>
    MARKER + cols.reduce((a, c2) => a + (c2.flex ? 10 : c2.w), 0) + GAP * (cols.length - 1);
  let cols = all;
  if (need(cols) > cw) cols = all.filter((c2) => c2.id !== "ref");
  if (need(cols) > cw) cols = cols.filter((c2) => c2.id !== "src");
  if (need(cols) > cw) cols = cols.filter((c2) => c2.id !== "cat");
  const fixed = MARKER + cols.reduce((a, c2) => a + (c2.flex ? 0 : c2.w), 0) + GAP * (cols.length - 1);
  for (const c2 of cols) if (c2.flex) c2.w = Math.max(8, cw - fixed);
  return cols;
}

function txCells(e, cols, plain) {
  const cat = e.category || "Other";
  const cells = [];
  for (const col of cols) {
    let s;
    switch (col.id) {
      case "date": s = plain ? fmtDay(e) : c.gray(fmtDay(e)); break;
      case "amt": s = plain ? pad(money(e.amount), col.w, "right") : c.bold(pad(money(e.amount), col.w, "right")); break;
      case "cat": s = plain
        ? fit("● " + truncate(cat, col.w - 2), col.w)
        : fit(catColor(cat)("● ") + truncate(cat, col.w - 2), col.w);
        break;
      case "item": s = fit(e.item ?? e.note ?? "", col.w); break;
      case "src": s = plain ? fit(e.source || "—", col.w) : c.dim(fit(e.source || "—", col.w)); break;
      case "ref": s = plain ? refOf(e._id) : c.dim(refOf(e._id)); break;
    }
    cells.push(pad(s, col.w, col.right ? "right" : "left"));
  }
  return cells.join("  ");
}

function txBody(state, W, bodyH) {
  const iW = W - 4;
  const cw = iW - 4;
  const list = visibleExpenses(state);
  const all = state.data?.expenses || [];
  const sum = list.reduce((a, e) => a + (Number(e.amount) || 0), 0);

  const right =
    (state.filter ? `/${state.filter} · ${list.length}/${all.length}` : `${all.length} txns`) +
    ` · ${money(sum)}` +
    (state.sortAmount ? " · by amount" : "");

  const rows = bodyH - 2;
  const body = [];
  if (!list.length) {
    const msg = state.filter
      ? `No matches for "/${state.filter}" — esc clears the filter.`
      : "No transactions this month — press 'a' to add one.";
    for (let i = 0; i < (rows >> 1) - 1; i++) body.push("");
    body.push(pad(c.dim(msg), cw, "center"));
  } else {
    const cols = txColumns(cw, catColW(list), srcColW(list));
    body.push(
      "  " + c.dim(c.bold(cols.map((col) => pad(col.label, col.w, col.right ? "right" : "left")).join("  ")))
    );
    const cap = Math.max(1, rows - 1);
    let start = Math.max(0, Math.min(state.sel - (cap >> 1), list.length - cap));
    const slice = list.slice(start, start + cap);
    slice.forEach((e, i) => {
      const selected = start + i === state.sel;
      if (selected) {
        body.push(c.cyan("▌") + c.reverse(" " + fit(txCells(e, cols, true), cw - 2)));
      } else {
        body.push("  " + txCells(e, cols, false));
      }
    });
    var scrollbar = list.length > cap ? { start, shown: cap, total: list.length } : null;
  }

  return panel({
    title: `Transactions — ${monthLabel(state.month)}`,
    right, w: iW, h: bodyH, body, scrollbar,
  }).map((ln) => "  " + ln);
}

// ── Reports tab ──────────────────────────────────────────────────────────────

function reportBody(state, W, bodyH) {
  const cached = state.reports?.[state.month];
  const mid = Math.max(2, (bodyH >> 1) - 2);
  const centered = (...rows) => {
    const out = Array.from({ length: mid }, () => "");
    for (const r of rows) out.push(pad(r, W, "center"));
    return out;
  };

  if (!cached) {
    return centered(c.dim(`${SPIN[state.spin % SPIN.length]} Fetching report for ${monthLabel(state.month)}…`));
  }
  if (cached.notFound) {
    return centered(
      c.dim(`No report for ${monthLabel(state.month)} yet.`),
      "",
      c.dim("press ") + c.bold(c.cyan("g")) + c.dim(" to generate it")
    );
  }
  if (cached.error) {
    return centered(c.red("✗ ") + cached.error, "", c.dim("g regenerate · r retry"));
  }

  const doc = cached.doc;
  const { lines } = summaryBlock(doc, state.month, W, bodyH - 2);
  lines.push("");
  lines.push(
    "  " +
      c.dim(`Report generated ${new Date(doc.generatedAt).toLocaleString()} — `) +
      c.bold(c.cyan("g")) + c.dim(" regenerate")
  );
  return lines;
}

// ── Modals ───────────────────────────────────────────────────────────────────

const EDIT_LABEL_W = 9;

function editBox(state, W, H) {
  const ed = state.edit;
  const mw = Math.min(58, W - 8);
  const vw = mw - 4 - EDIT_LABEL_W - 2;
  const body = [""];
  ed.fields.forEach((f, i) => {
    const active = i === ed.active;
    const label = pad(f.label, EDIT_LABEL_W);
    body.push(
      (active ? c.bold(c.cyan(label)) : c.dim(label)) + "  " +
        fit(active ? f.text : c.white(f.text), vw)
    );
  });
  body.push("");
  const box = panel({
    title: `Edit · ${ed.ref}`, right: "enter save · esc cancel",
    w: mw, h: body.length + 2, body, color: c.cyan,
  });
  const top = Math.max(1, (H - box.length) >> 1);
  const left = (W - mw) >> 1;
  const f = ed.fields[ed.active];
  const cursor = {
    row: top + 2 + ed.active + 1, // border + leading blank + field index, 1-based
    col: left + 2 + EDIT_LABEL_W + 2 + width(f.text.slice(0, f.cur)) + 1,
  };
  return { box, top, left, cursor };
}

function helpBox(W, H) {
  const rows = [
    ["tab · 1 2 3", "switch view (overview / transactions / reports)"],
    ["h l · ← →", "previous / next month"],
    ["j k · ↑ ↓", "move selection"],
    ["gg · G", "first / last row"],
    ["ctrl-d/u · pgdn/pgup", "jump half page / page"],
    ["/", "filter transactions (esc clears)"],
    ["s", "sort by amount / date"],
    ["a · n · o", "add an expense in plain English"],
    ["e · enter", "edit the selected transaction"],
    ["d · x", "delete the selected transaction"],
    ["g", "generate / regenerate (reports tab)"],
    ["t", "jump to the current month"],
    ["r", "refresh"],
    ["q", "quit"],
  ];
  const kw = Math.max(...rows.map(([k]) => width(k)));
  const mw = Math.min(66, W - 8);
  const body = ["", ...rows.map(([k, d]) => "  " + c.cyan(pad(k, kw)) + "  " + c.dim(d)), ""];
  const box = panel({ title: "Keys", w: mw, h: body.length + 2, body, color: c.cyan });
  const top = Math.max(1, (H - box.length) >> 1);
  return { box, top, left: (W - mw) >> 1 };
}

// ── The frame ────────────────────────────────────────────────────────────────

export function frame(state, W, H) {
  if (W < 60 || H < 16) {
    const lines = Array.from({ length: H }, () => fit("", W));
    lines[H >> 1] = fit(pad(c.dim(`Terminal too small (need 60×16, have ${W}×${H})`), W, "center"), W);
    return { lines, cursor: null };
  }

  const bodyH = H - 4;
  const lines = [header(state, W), fit("", W)];

  let body;
  if (state.error && !state.data) {
    body = [
      "", "",
      pad(c.red("✗ ") + state.error, W, "center"),
      "",
      pad(c.dim("r retry · q quit"), W, "center"),
    ];
  } else if (!state.data) {
    body = [
      "", "", "",
      pad(c.dim(`${SPIN[state.spin % SPIN.length]} Loading ${monthLabel(state.month)}…`), W, "center"),
    ];
  } else {
    body =
      state.tab === "tx" ? txBody(state, W, bodyH)
      : state.tab === "report" ? reportBody(state, W, bodyH)
      : overviewBody(state, W, bodyH);
  }
  while (body.length < bodyH) body.push("");
  body.length = bodyH;
  for (const ln of body) lines.push(fit(ln, W));

  lines.push(statusLine(state, W));
  lines.push(footer(state, W));

  let cursor = null;
  if (state.mode === "add" || state.mode === "search") {
    cursor = { row: H - 1, col: 4 + width(state.input.text.slice(0, state.input.cur)) + 1 };
  }

  let out = lines;
  if (state.mode === "edit" && state.edit) {
    const m = editBox(state, W, H);
    out = overlay(lines, m.box, m.top, m.left, W);
    cursor = m.cursor;
  } else if (state.mode === "help") {
    const m = helpBox(W, H);
    out = overlay(lines, m.box, m.top, m.left, W);
  }
  return { lines: out, cursor };
}
