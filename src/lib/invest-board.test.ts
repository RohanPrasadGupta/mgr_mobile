import type { Holding, Trade } from "@/api/types";
import { assetIndex, capitalChange, classesOf, currenciesOf, lastMonths, monthlyCapital, recent, totalsByClass, yearlyCapital } from "./invest-board";

const asset = (id: string, cls: string, currency: string, tracking = "units") => ({ id, userId: "u", symbol: id.toUpperCase(), name: id, class: cls, currency, tracking, costMethod: "wavg", archived: false, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null });
const h = (a: ReturnType<typeof asset>, o: Partial<Holding> = {}) => ({
  asset: a, quantity: 1, avgCostMinor: null, remainingCostMinor: 0, totalBoughtMinor: 0, totalSoldMinor: 0, contributedMinor: 0, withdrawnMinor: 0, feesMinor: 0, dividendsMinor: 0, realisedPnlMinor: 0,
  latestPrice: null, marketValueMinor: null, unrealisedPnlMinor: null, returnPct: null, xirrPct: null, closed: false, tradeCount: 0, firstTradedOn: null, lastTradedOn: null, lastBuyPriceMinor: null, lastSellPriceMinor: null, ...o,
}) as Holding;
let n = 0;
const t = (assetId: string, type: Trade["type"], tradedOn: string, amountMinor: number, feeMinor = 0) => ({ id: `t${++n}`, userId: "u", assetId, type, quantity: null, priceMinor: null, amountMinor, feeMinor, tradedOn, note: null, includeInAvg: true, clientId: null, createdAt: `2025-01-01T00:00:${String(n).padStart(2, "0")}.000Z` }) as Trade;

const holdings = [
  h(asset("nabil", "stock", "NPR"), { remainingCostMinor: 1000, totalBoughtMinor: 3000, realisedPnlMinor: 200, tradeCount: 3 }),
  h(asset("ptt", "stock", "THB"), { remainingCostMinor: 500, totalBoughtMinor: 500, tradeCount: 1, closed: true }),
  h(asset("sip", "fund", "NPR", "value"), { remainingCostMinor: 900, contributedMinor: 900, tradeCount: 2 }),
];

describe("investments board", () => {
  it("lists the classes held in board order", () => {
    expect(classesOf([holdings[2]!, holdings[0]!])).toEqual(["stock", "fund"]);
  });
  it("totals per class keep currencies apart", () => {
    const [stock, fund] = totalsByClass(holdings);
    expect(stock).toMatchObject({ cls: "stock", capital: { NPR: 1000, THB: 500 }, putIn: { NPR: 3000, THB: 500 }, entries: 4, holdings: 2, open: 1 });
    expect(fund).toMatchObject({ cls: "fund", capital: { NPR: 900 }, putIn: { NPR: 900 } });
  });
  it("counts buys and contributions in, sells and withdrawals out (net of fees), dividends not at all", () => {
    expect(capitalChange({ type: "buy", amountMinor: 100, feeMinor: 5 })).toBe(105);
    expect(capitalChange({ type: "sell", amountMinor: 100, feeMinor: 5 })).toBe(-95);
    expect(capitalChange({ type: "dividend", amountMinor: 100, feeMinor: 0 })).toBe(0);
  });
  it("sums capital per month and per year in one currency only", () => {
    const idx = assetIndex(holdings);
    const trades = [t("nabil", "buy", "2026-10-03", 1000), t("nabil", "sell", "2026-11-01", 400), t("sip", "contribution", "2026-11-05", 300), t("ptt", "buy", "2026-11-05", 999), t("nabil", "buy", "2024-02-01", 50)];
    const months = lastMonths("2026-11-26", 3);
    expect(months).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(monthlyCapital(trades, idx, "NPR", months)).toEqual({ stock: [0, 1000, -400], fund: [0, 0, 300] });
    expect(yearlyCapital(trades, idx, "stock", "NPR")).toEqual({ years: ["2024", "2026"], values: [50, 600] });
    expect(currenciesOf(trades, idx)).toEqual(["NPR", "THB"]);
    expect(recent(trades, 2).map((x) => x.tradedOn)).toEqual(["2026-11-05", "2026-11-05"]);
    expect(recent(trades, 5, "fund", idx).map((x) => x.assetId)).toEqual(["sip"]);
  });
  it("lastMonths crosses year boundaries", () => {
    expect(lastMonths("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
