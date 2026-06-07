// All date logic is IST (UTC+5:30), computed with an explicit offset so it
// never depends on the server timezone.
//
// Storage rule:  date field = the instant of 00:00 IST on the given day.
// Display rule:  DD-MM-YYYY.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Wall-clock parts in IST for an instant (default: now). */
export function istParts(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth() + 1, // 1-12
    day: ist.getUTCDate(),
    hours: ist.getUTCHours(),
    minutes: ist.getUTCMinutes(),
    weekday: ist.getUTCDay(),
  };
}

/** "YYYY-MM-DD" for the given instant in IST (default: today). */
export function todayISTymd(date = new Date()) {
  const p = istParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "YYYY-MM" for the given instant in IST (default: current month). */
export function currentMonthIST(date = new Date()) {
  const p = istParts(date);
  return `${p.year}-${pad(p.month)}`;
}

/** "YYYY-MM-DD" -> Date at 00:00 IST that day (stored as ISODate). */
export function istMidnightISO(ymd) {
  return new Date(`${ymd}T00:00:00.000+05:30`);
}

/** "YYYY-MM-DD" -> "DD-MM-YYYY". */
export function toDisplayDate(ymd) {
  const [y, m, d] = ymd.split("-");
  return `${d}-${m}-${y}`;
}

/** ISODate/Date -> "DD-MM-YYYY" using its IST calendar day. */
export function displayFromDate(date) {
  const p = istParts(date instanceof Date ? date : new Date(date));
  return `${pad(p.day)}-${pad(p.month)}-${p.year}`;
}

/** True if the instant falls on the 1st of the month in IST. */
export function isFirstOfMonthIST(date = new Date()) {
  return istParts(date).day === 1;
}

/** Previous month "YYYY-MM" relative to the instant, in IST. */
export function previousMonthIST(date = new Date()) {
  const p = istParts(date);
  let y = p.year;
  let m = p.month - 1;
  if (m === 0) { m = 12; y -= 1; }
  return `${y}-${pad(m)}`;
}

/** "YYYY-MM" -> "MMM YYYY" (e.g. "2026-05" -> "May 2026"). */
export function toDisplayMonth(ym) {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Half-open IST-midnight instant range [start, end) for a "YYYY-MM". */
export function monthRangeIST(ym) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(`${ym}-01T00:00:00.000+05:30`);
  let ny = y;
  let nm = m + 1;
  if (nm === 13) { nm = 1; ny += 1; }
  const end = new Date(`${ny}-${pad(nm)}-01T00:00:00.000+05:30`);
  return { start, end };
}

/** Validate "YYYY-MM" shape. */
export function isValidMonth(ym) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym || "");
}

/** Validate "YYYY-MM-DD" shape. */
export function isValidDate(ymd) {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd || "");
}

/** Half-open IST-midnight range [start, end) covering the inclusive days from..to. */
export function dayRangeIST(from, to) {
  const start = istMidnightISO(from);
  const end = new Date(istMidnightISO(to).getTime() + 24 * 3600 * 1000); // to + 1 day
  return { start, end };
}

/** Inclusive day count between two "YYYY-MM-DD" (IST). */
export function daysBetween(from, to) {
  const ms = istMidnightISO(to).getTime() - istMidnightISO(from).getTime();
  return Math.round(ms / (24 * 3600 * 1000)) + 1;
}
