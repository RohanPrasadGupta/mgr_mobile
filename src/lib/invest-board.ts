/**
 * Figures for the investments board (Overview + one tab per asset class), computed from the portfolio holdings and
 * the trade list. Amounts are never added across currencies: anything summed is kept per currency.
 */
import type { AssetClass, Holding, Trade } from "@/api/types";
import { CLASS_ORDER } from "./investments";

/** Money in minor units, kept apart per currency: { NPR: 13685600, THB: 463000 }. */
export type PerCurrency = Record<string, number>;
const add = (m: PerCurrency, cur: string, v: number) => { m[cur] = (m[cur] ?? 0) + v; };

/** Classes the user holds (or held), in board order. */
export const classesOf = (holdings: Holding[]): AssetClass[] => CLASS_ORDER.filter((c) => holdings.some((h) => h.asset.class === c));

export interface ClassTotals {
  cls: AssetClass;
  /** what is still invested (cost of what's held / net contributions) */
  capital: PerCurrency;
  /** everything ever put in (all buys / all contributions) */
  putIn: PerCurrency;
  realised: PerCurrency;
  value: PerCurrency;
  entries: number;
  holdings: number;
  open: number;
}

export function totalsByClass(holdings: Holding[]): ClassTotals[] {
  return classesOf(holdings).map((cls) => {
    const t: ClassTotals = { cls, capital: {}, putIn: {}, realised: {}, value: {}, entries: 0, holdings: 0, open: 0 };
    for (const h of holdings.filter((x) => x.asset.class === cls)) {
      const cur = h.asset.currency;
      const units = h.asset.tracking === "units";
      add(t.capital, cur, h.remainingCostMinor);
      add(t.putIn, cur, units ? h.totalBoughtMinor : h.contributedMinor);
      add(t.realised, cur, h.realisedPnlMinor);
      add(t.value, cur, h.marketValueMinor ?? h.remainingCostMinor);
      t.entries += h.tradeCount;
      t.holdings += 1;
      if (!h.closed) t.open += 1;
    }
    return t;
  });
}

/** Money a trade adds to (positive) or takes out of (negative) the investment; dividends and bonus shares don't. */
export function capitalChange(t: Pick<Trade, "type" | "amountMinor" | "feeMinor">): number {
  switch (t.type) {
    case "buy": case "contribution": return t.amountMinor + t.feeMinor;
    case "sell": case "withdrawal": return -(t.amountMinor - t.feeMinor);
    default: return 0;
  }
}

const ym = (d: string) => d.slice(0, 7);
/** The last `n` months ending with `today`'s month, as "YYYY-MM". */
export function lastMonths(today: string, n = 12): string[] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
}

interface AssetInfo { cls: AssetClass; currency: string; symbol: string; name: string }
export const assetIndex = (holdings: Holding[]) => new Map<string, AssetInfo>(holdings.map((h) => [h.asset.id, { cls: h.asset.class, currency: h.asset.currency, symbol: h.asset.symbol, name: h.asset.name }]));

/** Net capital added per month and class, in one currency (other currencies are left out, never converted). */
export function monthlyCapital(trades: Trade[], assets: Map<string, AssetInfo>, currency: string, months: string[]): Partial<Record<AssetClass, number[]>> {
  const idx = new Map(months.map((m, i) => [m, i]));
  const out: Partial<Record<AssetClass, number[]>> = {};
  for (const t of trades) {
    const a = assets.get(t.assetId);
    const i = idx.get(ym(t.tradedOn));
    if (!a || a.currency !== currency || i === undefined) continue;
    const v = capitalChange(t);
    if (!v) continue;
    (out[a.cls] ??= months.map(() => 0))[i]! += v;
  }
  return out;
}

/** Net capital added per calendar year for one class, in one currency. */
export function yearlyCapital(trades: Trade[], assets: Map<string, AssetInfo>, cls: AssetClass, currency: string): { years: string[]; values: number[] } {
  const by = new Map<string, number>();
  for (const t of trades) {
    const a = assets.get(t.assetId);
    if (!a || a.cls !== cls || a.currency !== currency) continue;
    const v = capitalChange(t);
    if (v) by.set(t.tradedOn.slice(0, 4), (by.get(t.tradedOn.slice(0, 4)) ?? 0) + v);
  }
  const years = [...by.keys()].sort();
  return { years, values: years.map((y) => by.get(y)!) };
}

/** Currencies used by trades (most entries first) — the choices for a per-currency chart. */
export function currenciesOf(trades: Trade[], assets: Map<string, AssetInfo>, cls?: AssetClass): string[] {
  const n = new Map<string, number>();
  for (const t of trades) { const a = assets.get(t.assetId); if (a && (!cls || a.cls === cls)) n.set(a.currency, (n.get(a.currency) ?? 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

/** Newest entries first (by date, then by when they were recorded). */
export function recent(trades: Trade[], n = 8, cls?: AssetClass, assets?: Map<string, AssetInfo>): Trade[] {
  return trades
    .filter((t) => !cls || assets?.get(t.assetId)?.cls === cls)
    .sort((a, b) => b.tradedOn.localeCompare(a.tradedOn) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, n);
}
