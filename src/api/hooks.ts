import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { call, client } from "./client";

/** Filter-driven queries (month, search, status) keep the last result on screen while the next one loads, instead of blanking. */
const keep = { placeholderData: keepPreviousData } as const;

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: async () => (await call(client.GET("/me"))).data, staleTime: 5 * 60_000 });
export const useAccounts = () => useQuery({ queryKey: ["accounts"], queryFn: async () => (await call(client.GET("/accounts"))).data, staleTime: 30_000 });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: async () => (await call(client.GET("/categories"))).data, staleTime: 60_000 });
export const useCurrencies = () => useQuery({ queryKey: ["currencies"], queryFn: async () => (await call(client.GET("/currencies"))).data, staleTime: 3600_000 });

export const useSummary = (from: string, to: string) => useQuery({ ...keep, queryKey: ["insights", "summary", from, to], queryFn: async () => (await call(client.GET("/insights/summary", { params: { query: { from, to } } }))).data, staleTime: 30_000 });
export const useByCategory = (from: string, to: string, kind: "income" | "expense" = "expense") => useQuery({ ...keep, queryKey: ["insights", "by-category", from, to, kind], queryFn: async () => (await call(client.GET("/insights/by-category", { params: { query: { from, to, kind } } }))).data, staleTime: 30_000 });
export const useDaily = (from: string, to: string) => useQuery({ ...keep, queryKey: ["insights", "daily", from, to], queryFn: async () => (await call(client.GET("/insights/daily", { params: { query: { from, to } } }))).data, staleTime: 30_000 });
export const useTrend = (year: number) => useQuery({ ...keep, queryKey: ["insights", "trend", year], queryFn: async () => (await call(client.GET("/insights/trend", { params: { query: { year } } }))).data, staleTime: 30_000 });
export const useBudgetStatus = (date?: string) => useQuery({ ...keep, queryKey: ["budgets", "status", date ?? "today"], queryFn: async () => (await call(client.GET("/budgets/status", { params: { query: { date } } }))).data, staleTime: 15_000 });

export interface TxFilter { from: string; to: string; kind?: "income" | "expense"; q?: string; tagId?: string }
export const useTransactions = (f: TxFilter) =>
  useInfiniteQuery({
    ...keep,
    queryKey: ["transactions", f],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => call(client.GET("/transactions", { params: { query: { ...f, q: f.q || undefined, tagId: f.tagId || undefined, limit: 50, cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    staleTime: 15_000,
  });
export const useTransaction = (id: string | undefined) => useQuery({ queryKey: ["transaction", id], enabled: !!id, queryFn: async () => (await call(client.GET("/transactions/{id}", { params: { path: { id: id! } } }))).data });

/** Ledger writes change balances, insights and budget progress, so refresh all of them together. */
export const invalidateLedger = (qc: QueryClient) => Promise.all(["transactions", "transaction", "accounts", "insights", "budgets"].map((k) => qc.invalidateQueries({ queryKey: [k] })));

/** `success` is shown as a toast when the write succeeds; failures always toast (root layout's MutationCache). */
export function useMutate<TVars, TOut = unknown>(fn: (v: TVars) => Promise<TOut>, invalidate: (qc: QueryClient) => Promise<unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate(qc), meta: { success } });
}

export const usePortfolio = () => useQuery({ queryKey: ["investments", "portfolio"], queryFn: async () => (await call(client.GET("/investments/portfolio"))).data, staleTime: 30_000 });
export const useHolding = (id: string | undefined) => useQuery({ queryKey: ["investments", "asset", id], enabled: !!id, queryFn: async () => (await call(client.GET("/investments/assets/{id}", { params: { path: { id: id! } } }))).data, staleTime: 15_000 });
/** Every entry across assets for the investments board (the API returns at most 500, newest first). */
export const useAllTrades = () => useQuery({ queryKey: ["investments", "trades", "all"], queryFn: async () => (await call(client.GET("/investments/trades", { params: { query: { limit: 500 } } }))).data, staleTime: 15_000 });
export const useAssetTrades = (id: string | undefined) => useQuery({ queryKey: ["investments", "trades", id], enabled: !!id, queryFn: async () => (await call(client.GET("/investments/trades", { params: { query: { assetId: id, limit: 500 } } }))).data, staleTime: 15_000 });
export const useAssetPrices = (id: string | undefined) => useQuery({ queryKey: ["investments", "prices", id], enabled: !!id, queryFn: async () => (await call(client.GET("/investments/assets/{id}/prices", { params: { path: { id: id! } } }))).data, staleTime: 30_000 });
export const invalidateInvestments = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["investments"] });

export const useRecurring = () => useQuery({ queryKey: ["recurring"], queryFn: async () => (await call(client.GET("/recurring"))).data, staleTime: 30_000 });
export const invalidateRecurring = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["recurring"] });

type Tx = import("./types").Transaction;
export interface TransferPair { groupId: string; out: Tx; in: Tx | null }
async function allOfKind(kind: "transfer_out" | "transfer_in", from: string, to: string) {
  const rows: Tx[] = [];
  let cursor: string | undefined;
  do {
    const page = await call(client.GET("/transactions", { params: { query: { kind, from, to, limit: 200, cursor } } }));
    rows.push(...page.data);
    cursor = page.meta.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}
/** Each transfer is two ledger rows sharing a transferGroupId; present them as one. */
export const useTransfers = (from: string, to: string) =>
  useQuery({
    ...keep,
    queryKey: ["transactions", "transfers", from, to],
    staleTime: 15_000,
    queryFn: async (): Promise<TransferPair[]> => {
      const [outs, ins] = await Promise.all([allOfKind("transfer_out", from, to), allOfKind("transfer_in", from, to)]);
      const inBy = new Map(ins.map((t) => [t.transferGroupId, t]));
      return outs.filter((t) => t.transferGroupId).map((t) => ({ groupId: t.transferGroupId!, out: t, in: inBy.get(t.transferGroupId) ?? null }));
    },
  });

// ── tags / attachments ──
export const useTags = () => useQuery({ queryKey: ["tags"], queryFn: async () => (await call(client.GET("/tags"))).data, staleTime: 60_000 });
export const invalidateTags = (qc: QueryClient) => Promise.all([qc.invalidateQueries({ queryKey: ["tags"] }), qc.invalidateQueries({ queryKey: ["transactions"] })]);
export const useAttachments = (transactionId?: string) =>
  useQuery({ queryKey: ["attachments", transactionId], enabled: !!transactionId, queryFn: async () => (await call(client.GET("/transactions/{id}/attachments", { params: { path: { id: transactionId! } } }))).data });

// ── goals / debts / notes / reports ──
export const useGoals = (archived = false) => useQuery({ ...keep, queryKey: ["goals", { archived }], queryFn: async () => (await call(client.GET("/goals", { params: { query: { archived: archived ? "true" : "false" } } }))).data, staleTime: 30_000 });
export const useGoal = (id?: string) => useQuery({ queryKey: ["goals", "detail", id], enabled: !!id, queryFn: async () => (await call(client.GET("/goals/{id}", { params: { path: { id: id! } } }))).data });
export const invalidateGoals = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["goals"] });
export const useDebts = (status: "open" | "settled" | "all") => useQuery({ ...keep, queryKey: ["debts", { status }], queryFn: async () => (await call(client.GET("/debts", { params: { query: { status } } }))).data, staleTime: 30_000 });
export const useDebtSummary = () => useQuery({ queryKey: ["debts", "summary"], queryFn: async () => (await call(client.GET("/debts/summary"))).data, staleTime: 30_000 });
export const useDebt = (id?: string) => useQuery({ queryKey: ["debts", "detail", id], enabled: !!id, queryFn: async () => (await call(client.GET("/debts/{id}", { params: { path: { id: id! } } }))).data });
export const invalidateDebts = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["debts"] });
export const useNotes = (q: string) => useQuery({ ...keep, queryKey: ["notes", { q }], queryFn: async () => (await call(client.GET("/notes", { params: { query: q ? { q } : {} } }))).data, staleTime: 30_000 });
export const invalidateNotes = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ["notes"] });
export const useReport = (period: "month" | "year", year: number, month?: number) =>
  useQuery({ ...keep, queryKey: ["reports", { period, year, month }], queryFn: async () => (await call(client.GET("/reports", { params: { query: { period, year, ...(period === "month" ? { month } : {}) } } }))).data, staleTime: 30_000 });

/** The stored daily rate the API will use for `from`→`to` on `date` (null when none is stored). */
export const useFxQuote = (from?: string, to?: string, date?: string) =>
  useQuery({
    queryKey: ["fx", from, to, date],
    enabled: !!from && !!to && from !== to,
    staleTime: 3600_000,
    retry: false,
    queryFn: async () => {
      const res = await client.GET("/fx", { params: { query: { from: from!, to: to!, date } } });
      if (res.response.status === 404) return null; // no stored rate for this pair
      return (await call(Promise.resolve(res))).data;
    },
  });

/** Newest transaction overall (null for a brand-new user). */
export const useLatestTransaction = () =>
  useQuery({ queryKey: ["transactions", "latest"], staleTime: 60_000, queryFn: async () => (await call(client.GET("/transactions", { params: { query: { limit: 1 } } }))).data[0] ?? null });

/** Portfolio value and invested amount at each month end (replayed from trades + manual prices, base currency). */
export const usePortfolioHistory = (months: number) =>
  useQuery({ ...keep, queryKey: ["investments", "history", months], staleTime: 60_000, queryFn: async () => (await call(client.GET("/investments/portfolio/history", { params: { query: { months } } }))).data });
