// Layout primitives for the TUI. Every helper returns strings of an *exact*
// visible width, so frames compose without ever wrapping or shearing.

import { c, pad, truncate, width } from "../ui.js";

const ANSI_RE = /\x1b\[[0-9;]*m/g;
export const strip = (s) => String(s).replace(ANSI_RE, "");

// Pad/clip a (possibly ANSI-colored) string to exactly `w` visible columns.
export const fit = (s, w) => pad(truncate(String(s ?? ""), w), w);

// Join blocks side-by-side; each block is { lines, w }. Missing rows → blanks.
export function joinH(blocks, gap = 2) {
  const h = Math.max(...blocks.map((b) => b.lines.length));
  const out = [];
  for (let r = 0; r < h; r++) {
    out.push(blocks.map((b) => fit(b.lines[r] ?? "", b.w)).join(" ".repeat(gap)));
  }
  return out;
}

// A full-width colored band (header/footer). Inner fg colors survive because
// they reset to 39/22, not the band's 49.
export const band = (content, w, bg) => bg(fit(content, w));

// Cut a *plain* (no ANSI) string to the visible-column range [from, to),
// padding ragged wide-char edges with spaces and right-padding short lines.
export function sliceCols(plain, from, to) {
  let out = "";
  let col = 0;
  for (const ch of plain) {
    const cw = width(ch);
    const a = col;
    const b = col + cw;
    col = b;
    if (b <= from) continue;
    if (a >= to) break;
    out += a >= from && b <= to ? ch : " ".repeat(Math.min(b, to) - Math.max(a, from));
  }
  const have = width(out);
  if (have < to - from) out += " ".repeat(to - from - have);
  return out;
}

// A bordered, rounded panel of exactly `w` × `h`. Body lines get one column
// of inner padding each side. `scrollbar` ({ start, shown, total }) renders a
// thumb inside the right border.
export function panel({ title = "", right = "", body = [], w, h, color = c.gray, scrollbar = null }) {
  const cw = w - 4;
  const rTxt = right ? truncate(right, Math.max(0, w - 8)) : "";
  const wr = rTxt ? width(rTxt) + 2 : 0;
  const tTxt = title ? truncate(title, Math.max(0, w - 6 - wr)) : "";
  const wt = tTxt ? width(tTxt) + 2 : 0;
  const dashes = Math.max(0, w - 4 - wt - wr);

  const out = [
    color("╭─") +
      (tTxt ? " " + c.bold(tTxt) + " " : "") +
      color("─".repeat(dashes)) +
      (rTxt ? " " + c.dim(rTxt) + " " : "") +
      color("─╮"),
  ];

  const rows = h - 2;
  let thumbTop = -1;
  let thumbLen = 0;
  if (scrollbar && scrollbar.total > scrollbar.shown) {
    thumbLen = Math.max(1, Math.round((scrollbar.shown / scrollbar.total) * rows));
    thumbTop = Math.min(
      rows - thumbLen,
      Math.round((scrollbar.start / scrollbar.total) * rows)
    );
  }
  for (let i = 0; i < rows; i++) {
    const edge =
      thumbTop >= 0 && i >= thumbTop && i < thumbTop + thumbLen
        ? c.cyan("█")
        : color("│");
    out.push(color("│") + " " + fit(body[i] ?? "", cw) + " " + edge);
  }
  out.push(color("╰" + "─".repeat(w - 2) + "╯"));
  return out;
}

// A rounded stat tile, 5 lines tall, exactly `w` wide.
export function tile(title, value, sub, color, w) {
  const inner = w - 4;
  return [
    color("╭" + "─".repeat(w - 2) + "╮"),
    color("│ ") + c.dim(fit(title.toUpperCase(), inner)) + color(" │"),
    color("│ ") + c.bold(color(fit(value, inner))) + color(" │"),
    color("│ ") + c.dim(fit(sub, inner)) + color(" │"),
    color("╰" + "─".repeat(w - 2) + "╯"),
  ];
}

// Composite a modal `box` over `base` lines: the backdrop is flattened to dim
// plain text (a focus effect), then the box rows are spliced in by column.
export function overlay(base, box, top, left, W) {
  const bw = Math.max(...box.map(width));
  const out = base.map((ln) => c.dim(sliceCols(strip(ln), 0, W)));
  box.forEach((bl, i) => {
    const r = top + i;
    if (r < 0 || r >= out.length) return;
    const p = strip(base[r]);
    out[r] =
      c.dim(sliceCols(p, 0, left)) + fit(bl, bw) + c.dim(sliceCols(p, left + bw, W));
  });
  return out;
}
