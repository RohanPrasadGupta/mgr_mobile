// Shared with the web app (mgr_frontEnd/lib/import.ts): same column detection, date handling and CSV safety, so a file imports identically on both.
export interface ImportRow { date: string; account: string; category: string; note: string; currency: string; amount: number; type: string }
export type Field = "date" | "account" | "category" | "note" | "currency" | "amount" | "type";

// Header aliases, in priority order. The v1 "Money Manager" export is matched by these exact names.
const ALIASES: Record<Field, string[]> = {
  date: ["date", "datetime", "time"],
  account: ["account", "wallet"],
  category: ["category"],
  note: ["note", "notes", "memo", "description"],
  currency: ["currency", "ccy"],
  amount: ["amount"],
  type: ["income/expense", "type", "kind"],
};
export const REQUIRED: Field[] = ["date", "amount", "type"];

export function detectColumns(headers: string[]): Record<Field, string | null> {
  const norm = headers.map((h) => ({ h, k: h.trim().toLowerCase() }));
  const out = {} as Record<Field, string | null>;
  for (const f of Object.keys(ALIASES) as Field[]) out[f] = ALIASES[f].map((a) => norm.find((n) => n.k === a)?.h).find(Boolean) ?? null;
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel serials, JS dates and common text formats → "YYYY-MM-DD[ HH:mm:ss]" (read by the API in the user's timezone). */
export function cellToDate(v: unknown, dmy: boolean, ssf?: { parse_date_code: (n: number) => { y: number; m: number; d: number; H: number; M: number; S: number } | null }): string | null {
  if (typeof v === "number") {
    const d = ssf?.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)} ${pad(d.H)}:${pad(d.M)}:${pad(Math.floor(d.S))}` : null;
  }
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  if (typeof v !== "string") return null;
  const s = v.trim();
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (slash) {
    const [, a, b, y, h, mi, se] = slash;
    const day = dmy ? +a! : +b!, month = dmy ? +b! : +a!;
    return `${y}-${pad(month)}-${pad(day)}${h ? ` ${pad(+h)}:${mi}:${se ?? "00"}` : ""}`;
  }
  return s || null;
}

export function normaliseType(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (["income", "in", "+", "credit"].includes(s)) return "Income";
  if (["expense", "exp", "out", "-", "debit"].includes(s)) return "Expense";
  return String(v ?? "").trim();
}

export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  return Number(String(v ?? "").replace(/[,\s]/g, ""));
}

export function buildRows(raw: Record<string, unknown>[], map: Record<Field, string | null>, opts: { dmy: boolean; defaultCurrency: string; ssf?: Parameters<typeof cellToDate>[2] }): ImportRow[] {
  const g = (r: Record<string, unknown>, f: Field) => (map[f] ? r[map[f]!] : undefined);
  return raw.map((r) => ({
    date: cellToDate(g(r, "date"), opts.dmy, opts.ssf) ?? "",
    account: String(g(r, "account") ?? "").trim() || "Cash",
    category: String(g(r, "category") ?? "").trim(),
    note: String(g(r, "note") ?? ""),
    currency: String(g(r, "currency") ?? "").trim().toUpperCase() || opts.defaultCurrency,
    amount: toNumber(g(r, "amount")),
    type: normaliseType(g(r, "type")),
  }));
}

/** mongoexport output: a JSON array, or one JSON document per line. */
export function parseJsonDocs(text: string): unknown[] {
  const t = text.trim();
  if (t.startsWith("[")) { const v = JSON.parse(t); if (!Array.isArray(v)) throw new Error("Expected a JSON array"); return v; }
  return t.split(/\r?\n/).filter((l) => l.trim()).map((l, i) => { try { return JSON.parse(l); } catch { throw new Error(`Line ${i + 1} is not valid JSON`); } });
}

const CSV_DANGEROUS = /^[=+\-@\t\r]/;
export const csvCell = (v: string | number) => {
  let s = String(v);
  if (typeof v === "string" && CSV_DANGEROUS.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
