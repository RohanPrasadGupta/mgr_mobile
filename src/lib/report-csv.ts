import type { Report } from "@/api/types";
import { toMajor } from "./money";

/** RFC 4180 CSV with spreadsheet-formula neutralising (a text cell starting with = + - @ is prefixed with '). Same layout as the web export. */
export function reportCsv(r: Report): string {
  // Plain numbers (including negatives like -5.00) stay numbers; any other text starting with a formula character is neutralised.
  const cell = (v: string | number) => { let s = String(v); if (typeof v === "string" && !/^-?\d+(\.\d+)?$/.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const m = (minor: number) => toMajor(minor, r.baseCurrency).toFixed(2);
  const cat = (rows: Report["expenseByCategory"]) => rows.map((c) => [c.name, m(c.totalMinor), c.pct.toFixed(1), m(c.previousMinor), c.changePct === null ? "" : c.changePct.toFixed(1)]);
  const rows: (string | number)[][] = [
    ["MoneyMgr report", r.label], ["Period", `${r.from} to ${r.to}`], ["Currency", r.baseCurrency], [],
    ["", "This period", "Previous period"], ["Income", m(r.incomeMinor), m(r.previous.incomeMinor)], ["Expense", m(r.expenseMinor), m(r.previous.expenseMinor)], ["Net", m(r.netMinor), m(r.previous.netMinor)], [],
    ["Expense category", "Amount", "Share %", "Previous", "Change %"], ...cat(r.expenseByCategory), [],
    ["Income category", "Amount", "Share %", "Previous", "Change %"], ...cat(r.incomeByCategory), [],
    [r.period === "year" ? "Month" : "Day", "Income", "Expense"], ...r.series.map((s) => [s.from, m(s.incomeMinor), m(s.expenseMinor)]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
