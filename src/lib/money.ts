// Money is integer minor units + ISO currency code. Formatting avoids Intl.NumberFormat currency styles on purpose:
// Hermes' Intl support differs per platform/version, and a crash while rendering a balance is not acceptable.
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND"]);
export const minorUnit = (c: string) => (ZERO_DECIMAL.has(c) ? 0 : 2);
export const toMinor = (major: number, c: string) => Math.round(major * 10 ** minorUnit(c));
export const toMajor = (minor: number, c: string) => minor / 10 ** minorUnit(c);

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function formatMoney(minor: number, currency: string, opts: { sign?: boolean } = {}) {
  const v = toMajor(minor, currency);
  const [int, frac] = Math.abs(v).toFixed(minorUnit(currency)).split(".");
  const body = `${currency} ${group(int!)}${frac ? `.${frac}` : ""}`;
  return `${v < 0 ? "−" : opts.sign && v > 0 ? "+" : ""}${body}`;
}

/** Parses what a user types into an amount field ("1,234.5", "12.50"); NaN when it is not a number. */
export function parseAmount(text: string): number {
  const t = text.replace(/,/g, "").trim();
  return /^\d*\.?\d+$|^\d+\.$/.test(t) ? Number(t) : NaN;
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;
export function monthRange(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}
export function shiftMonth(year: number, month: number, delta: number) {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}
/** Date to ask budget status for: undefined = "today" (API decides) for the current month, else that month's last day. */
export function budgetDate(year: number, month: number, now = new Date()) {
  return year === now.getFullYear() && month === now.getMonth() + 1 ? undefined : monthRange(year, month).to;
}

export const todayLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Tue, 24 Nov" for a YYYY-MM-DD string. */
export function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS[m - 1]!.slice(0, 3)}`;
}

/** Per-unit prices can be fractional minor units (crypto, gold): show up to 4 decimals, trimming trailing zeros past the currency's own. */
export function formatUnitPrice(minor: number, currency: string) {
  const major = Math.abs(toMajor(minor, currency));
  const [int, frac = ""] = major.toFixed(4).split(".");
  const trimmed = frac.replace(/0+$/, "").padEnd(minorUnit(currency), "0");
  return `${minor < 0 ? "−" : ""}${currency} ${group(int!)}${trimmed ? `.${trimmed}` : ""}`;
}
export const formatQty = (q: number) => { const [i, f] = q.toFixed(8).split("."); return `${group(i!)}${f!.replace(/0+$/, "") ? `.${f!.replace(/0+$/, "")}` : ""}`; };
export const formatPct = (p: number | null, sign = false) => (p === null ? "—" : `${sign && p > 0 ? "+" : ""}${p.toFixed(1)}%`);

/** True for a real calendar date written YYYY-MM-DD (rejects 2025-02-31). */
export function isDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
/** "24 Nov 2026" for a YYYY-MM-DD string. */
export function formatDate(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
}
