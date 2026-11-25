import type { Account, Category, User } from "@/api/types";

export const me: User = { id: "u1", email: "me@example.com", name: "Me", baseCurrency: "THB", timezone: "Asia/Bangkok", locale: "en", weekStart: 1, emailVerified: true };
const acct = (id: string, name: string, currency: string, balanceMinor: number): Account =>
  ({ id, userId: "u1", name, type: "bank", currency, openingBalanceMinor: 0, balanceMinor, includeInNetWorth: true, archived: false, icon: null, color: null, sort: 0, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z", deletedAt: null });
export const cash = acct("a-cash", "Cash", "THB", 100_000);
export const npr = acct("a-npr", "NPR wallet", "NPR", 0);
const cat = (id: string, name: string, kind: Category["kind"]): Category => ({ id, userId: "u1", name, kind, parentId: null, icon: null, color: null, archived: false, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null });
export const categories = [cat("c-food", "Food", "expense"), cat("c-rent", "Rent", "expense"), cat("c-salary", "Salary", "income")];
export const baseRoutes = { "GET /me": { data: me }, "GET /accounts": { data: [cash, npr] }, "GET /categories": { data: categories }, "GET /tags": { data: [] as unknown[] } };

import type { Holding, RecurringRule, Trade } from "@/api/types";
const usd = acct("a-usd", "USD card", "USD", 0);
const bank = acct("a-bank", "Bank", "THB", 50_000);
export { usd, bank };
export const asset = (o: Partial<Holding["asset"]> = {}): Holding["asset"] => ({ id: "as1", userId: "u1", symbol: "PTT", name: "PTT Co", class: "stock", currency: "THB", tracking: "units", costMethod: "wavg", archived: false, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null, ...o });
export const holding = (o: Partial<Holding> = {}, a: Partial<Holding["asset"]> = {}): Holding => ({
  asset: asset(a), quantity: 15, avgCostMinor: 15_000, remainingCostMinor: 225_000, totalBoughtMinor: 300_000, totalSoldMinor: 150_000, contributedMinor: 0, withdrawnMinor: 0, feesMinor: 0, dividendsMinor: 0,
  realisedPnlMinor: 75_000, latestPrice: { asOn: "2025-04-01", priceMinor: 25_000 }, marketValueMinor: 375_000, unrealisedPnlMinor: 150_000, returnPct: 75, xirrPct: 60.4, closed: false, tradeCount: 3, firstTradedOn: "2025-01-01", lastTradedOn: "2025-03-01", ...o,
});
export const trade = (o: Partial<Trade> = {}): Trade => ({ id: "tr1", userId: "u1", assetId: "as1", type: "buy", quantity: 10, priceMinor: 10_000, amountMinor: 100_000, feeMinor: 0, tradedOn: "2025-01-01", note: null, includeInAvg: true, clientId: null, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null, ...o });
export const rule = (o: Partial<RecurringRule> = {}): RecurringRule => ({ id: "r1", userId: "u1", accountId: "a-cash", categoryId: "c-rent", kind: "expense", amountMinor: 500_000, note: "Rent", frequency: "monthly", interval: 1, startOn: "2025-01-05", endOn: null, nextRunOn: "2026-12-05", lastRunOn: null, lastError: null, active: true, createdAt: "2025-01-01T00:00:00.000Z", deletedAt: null, nextDates: ["2026-12-05", "2027-01-05"], ...o });
