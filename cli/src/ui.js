// Tiny zero-dependency terminal toolkit: colors, money, tables, cards, bars.
// Honors NO_COLOR and non-TTY (so output pipes/greps cleanly).

const useColor =
  process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0"
    ? true
    : process.env.NO_COLOR === undefined &&
      process.env.TERM !== "dumb" &&
      process.stdout.isTTY;

const E = (open, close) => (s) =>
  useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s);

export const c = {
  reset: (s) => s,
  bold: E(1, 22),
  dim: E(2, 22),
  italic: E(3, 23),
  underline: E(4, 24),
  red: E(31, 39),
  green: E(32, 39),
  yellow: E(33, 39),
  blue: E(34, 39),
  magenta: E(35, 39),
  cyan: E(36, 39),
  gray: E(90, 39),
  white: E(97, 39),
  bgGreen: E(42, 49),
  bgBlue: E(44, 49),
};

// Width of a string ignoring ANSI escapes and counting emoji as 2 cols.
const ANSI = /\x1b\[[0-9;]*m/g;
export function width(s) {
  const plain = String(s).replace(ANSI, "");
  let w = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0);
    // Wide ranges: CJK + most emoji/symbols.
    w += cp >= 0x1100 && (cp >= 0x1f000 || cp >= 0x2600) ? 2 : 1;
  }
  return w;
}

export function pad(s, len, align = "left") {
  const gap = Math.max(0, len - width(s));
  if (align === "right") return " ".repeat(gap) + s;
  if (align === "center") {
    const l = gap >> 1;
    return " ".repeat(l) + s + " ".repeat(gap - l);
  }
  return s + " ".repeat(gap);
}

export function truncate(s, max) {
  s = String(s);
  if (width(s) <= max) return s;
  let out = "";
  let w = 0;
  for (const ch of s.replace(ANSI, "")) {
    const cw = width(ch);
    if (w + cw > max - 1) break;
    out += ch;
    w += cw;
  }
  return out + "…";
}

export const cols = () => process.stdout.columns || 80;

// Indian-grouped rupee formatting: ₹1,23,456.50 (no paise when whole).
const inr = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export function money(n) {
  const v = Number(n) || 0;
  return "₹" + inr.format(v);
}

// Compact money for tight axis labels: ₹24.7k, ₹1.2L, ₹950.
export function moneyShort(n) {
  const v = Number(n) || 0;
  if (v >= 1e7) return "₹" + (v / 1e7).toFixed(1).replace(/\.0$/, "") + "Cr";
  if (v >= 1e5) return "₹" + (v / 1e5).toFixed(1).replace(/\.0$/, "") + "L";
  if (v >= 1e3) return "₹" + (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return "₹" + Math.round(v);
}

// Stable color per category so the eye learns them.
const CAT_COLOR = {
  Food: c.yellow,
  Groceries: c.green,
  Transport: c.cyan,
  Shopping: c.magenta,
  Bills: c.red,
  Health: c.blue,
  Entertainment: c.magenta,
  Subscriptions: c.blue,
  Investment: c.green,
  Other: c.gray,
};
export const catColor = (cat) => CAT_COLOR[cat] || c.white;
export const dot = (cat) => catColor(cat)("●");

// Horizontal bar made of block glyphs.
export function bar(fraction, len = 18) {
  const full = Math.round(Math.max(0, Math.min(1, fraction)) * len);
  return "█".repeat(full) + c.dim("░".repeat(len - full));
}

// Eighth-block ramp for sub-cell precision in vertical charts.
const V8 = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

// Vertical column chart for a time series.
//   points: [{label, value}]   (label shown on the x-axis, e.g. day-of-month)
// Returns a multi-line string with a left y-axis gutter, bars, baseline, labels.
export function columnChart(points, opts = {}) {
  const {
    height = 7,
    color = c.cyan,
    peakColor = c.yellow,
    format = (v) => String(v),
    colW = 2,
  } = opts;
  if (!points.length) return c.dim("  (no data)");

  const max = Math.max(1, ...points.map((p) => p.value));
  const gutter = Math.max(width(format(max)), 3);
  let peakI = 0;
  points.forEach((p, i) => {
    if (p.value > points[peakI].value) peakI = i;
  });

  const lines = [];
  for (let r = height - 1; r >= 0; r--) {
    const lbl = r === height - 1 ? format(max) : r === 0 ? format(0) : "";
    let row = c.dim(pad(lbl, gutter, "right")) + c.dim(" │");
    for (let i = 0; i < points.length; i++) {
      const eighths = Math.round((points[i].value / max) * height * 8);
      const cell = Math.max(0, Math.min(8, eighths - r * 8));
      const g = V8[cell];
      const col = i === peakI ? peakColor : color;
      row += (cell > 0 ? col(g) : " ") + " ".repeat(colW - 1);
    }
    lines.push(row);
  }
  // Baseline.
  lines.push(" ".repeat(gutter) + c.dim(" └" + "─".repeat(points.length * colW)));
  // X-axis labels (thin out so they don't collide).
  const step = Math.max(1, Math.ceil((points.length * colW) / 16 / colW) * 1);
  let xl = " ".repeat(gutter + 2);
  for (let i = 0; i < points.length; i++) {
    xl += i % step === 0 ? c.dim(pad(String(points[i].label), colW)) : " ".repeat(colW);
  }
  lines.push(xl);
  return lines.join("\n");
}

// A single horizontal bar split into colored proportional segments (donut-equiv).
//   segments: [{value, color}]
export function stackedBar(segments, len = 48) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let used = 0;
  let out = "";
  segments.forEach((s, i) => {
    let w = i === segments.length - 1 ? len - used : Math.round((s.value / total) * len);
    w = Math.max(0, Math.min(w, len - used));
    used += w;
    if (w > 0) out += s.color("█".repeat(w));
  });
  return out;
}

// A rounded card. `lines` are pre-formatted; `title` is optional.
export function card(title, lines, { color = c.cyan, width: w } = {}) {
  const inner = Math.max(
    title ? width(title) + 2 : 0,
    ...lines.map(width),
    w ? w - 4 : 0
  );
  const top = color("╭" + "─".repeat(inner + 2) + "╮");
  const bot = color("╰" + "─".repeat(inner + 2) + "╯");
  const out = [top];
  if (title) {
    out.push(color("│ ") + c.bold(pad(title, inner)) + color(" │"));
    out.push(color("│ ") + c.dim("─".repeat(inner)) + color(" │"));
  }
  for (const ln of lines) out.push(color("│ ") + pad(ln, inner) + color(" │"));
  out.push(bot);
  return out.join("\n");
}

// Render a table. columns: [{key,label,align,color,max}], rows: objects.
export function table(columns, rows) {
  const widths = columns.map((col) =>
    Math.max(
      width(col.label),
      ...rows.map((r) => width(fmtCell(r[col.key], col, false)))
    )
  );
  // Shrink flexible columns to fit terminal width.
  const sep = 2;
  let total = widths.reduce((a, b) => a + b, 0) + sep * (columns.length - 1);
  const budget = cols() - 1;
  if (total > budget) {
    const overflow = total - budget;
    const flexIdx = columns
      .map((col, i) => (col.flex ? i : -1))
      .filter((i) => i >= 0);
    let left = overflow;
    for (const i of flexIdx) {
      const cut = Math.min(left, Math.max(8, widths[i] - 8) - 0);
      const shrink = Math.min(widths[i] - 6, Math.ceil(overflow / flexIdx.length));
      widths[i] = Math.max(6, widths[i] - shrink);
      left -= shrink;
      if (left <= 0) break;
    }
  }

  const header = columns
    .map((col, i) => c.dim(c.bold(pad(col.label, widths[i], col.align))))
    .join("  ");
  const lines = [header];
  for (const r of rows) {
    lines.push(
      columns
        .map((col, i) => pad(fmtCell(r[col.key], col, true, widths[i]), widths[i], col.align))
        .join("  ")
    );
  }
  return lines.join("\n");
}

function fmtCell(val, col, color, w) {
  let s = col.format ? col.format(val) : val == null ? "" : String(val);
  if (w != null) s = truncate(s, w);
  if (color && col.color) s = col.color(s);
  return s;
}

export const log = (...a) => console.log(...a);
export const nl = () => console.log("");

// Minimal spinner for network waits (TTY only).
export function spinner(label) {
  if (!process.stdout.isTTY) return { stop() {} };
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  process.stdout.write("\x1b[?25l");
  const t = setInterval(() => {
    process.stdout.write(`\r${c.cyan(frames[i++ % frames.length])} ${c.dim(label)}`);
  }, 80);
  return {
    stop(clear = true) {
      clearInterval(t);
      if (clear) process.stdout.write("\r\x1b[K");
      process.stdout.write("\x1b[?25h");
    },
  };
}
