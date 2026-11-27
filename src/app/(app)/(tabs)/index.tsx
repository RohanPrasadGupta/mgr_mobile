import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useAccounts, useBudgetStatus, useLatestTransaction, useByCategory, useCategories, useDaily, useMe, useSummary, useTags, useTransactions, useTrend } from "@/api/hooks";
import { BarChart, ShareBar } from "@/components/charts";
import { TransactionRow } from "@/components/transaction-row";
import { Card, ErrorText, FadeIn, ListSkeleton, MonthPicker, ProgressBar, Screen, Skeleton, T } from "@/components/ui";
import { GetStarted } from "@/components/get-started";
import { budgetDate, formatMoney, monthLabel, monthRange, shiftMonth, todayLocal } from "@/lib/money";
import { useCountUp } from "@/lib/use-count-up";
import { useTheme } from "@/theme/theme";

const band = { healthy: ["Healthy savings", "income"], low: ["Low buffer", "warn"], overspending: ["Spending more than earned", "expense"], none: ["No income", "muted"] } as const;
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** A dashboard section: its own loading placeholder and retryable error, so one failed request never blanks the page. */
function Section({ title, action, state, index, children }: { title: string; action?: ReactNode; state?: { isPending: boolean; error: unknown; refetch: () => unknown; isPlaceholderData?: boolean }; index: number; children: ReactNode }) {
  return (
    <FadeIn index={index}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><T bold>{title}</T>{action}</View>
        {state?.error ? <ErrorText error={state.error} onRetry={() => void state.refetch()} /> : state?.isPending ? <Skeleton height={120} /> : <View style={{ opacity: state?.isPlaceholderData ? 0.5 : 1 }}>{children}</View>}
      </Card>
    </FadeIn>
  );
}

function Kpi({ label, minor, cur, tone, before, goodWhenUp, sign, index }: { label: string; minor?: number; cur: string; tone: "income" | "expense"; before?: number; goodWhenUp: boolean; sign?: boolean; index: number }) {
  const shown = useCountUp(minor);
  // size by the final value's length (not the rolling one) so the text doesn't jump while counting
  const text = minor === undefined ? "" : formatMoney(minor, cur, { sign });
  const delta = minor !== undefined && before !== undefined && before !== 0 ? ((minor - before) / Math.abs(before)) * 100 : null;
  const good = delta === null ? null : goodWhenUp ? delta >= 0 : delta <= 0;
  return (
    <FadeIn index={index} style={{ flexBasis: "47%", flexGrow: 1 }}>
      <Card style={{ padding: 14, gap: 2 }}>
        <T tone="muted" size={12}>{label}</T>
        {shown === undefined ? <Skeleton height={24} width="70%" style={{ marginTop: 4 }} /> : <T tone={tone} size={text.length > 15 ? 15 : text.length > 13 ? 17 : 19} bold numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`${label} ${formatMoney(minor!, cur, { sign })}`}>{formatMoney(shown, cur, { sign })}</T>}
        {delta !== null && Math.abs(delta) >= 0.5 && <T size={11} tone={good ? "income" : "expense"}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% <T tone="muted" size={11}>vs last month</T></T>}
      </Card>
    </FadeIn>
  );
}

export default function Dashboard() {
  const t = useTheme();
  const qc = useQueryClient();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const touched = useRef(false); // once the user picks a month we stop auto-selecting
  const { from, to } = monthRange(ym.year, ym.month);
  const prev = shiftMonth(ym.year, ym.month, -1);
  const prevRange = monthRange(prev.year, prev.month);
  const me = useMe();
  const cur = me.data?.baseCurrency ?? "THB";
  const summary = useSummary(from, to);
  const prevSummary = useSummary(prevRange.from, prevRange.to);
  const expenseCats = useByCategory(from, to, "expense");
  const incomeCats = useByCategory(from, to, "income");
  const daily = useDaily(from, to);
  const trend = useTrend(ym.year);
  const budgets = useBudgetStatus(budgetDate(ym.year, ym.month, now));
  const accounts = useAccounts();
  const cats = useCategories();
  const tags = useTags();
  const recent = useTransactions({ from, to });
  const latest = useLatestTransaction();
  const s = summary.isPlaceholderData ? undefined : summary.data;
  const fmt = (v: number) => formatMoney(v, cur);

  // A returning user whose current month is still empty lands on their latest month with data instead of a blank page.
  useEffect(() => {
    if (touched.current || !latest.data || !s || s.transactionCount !== 0) return;
    const [y, m] = latest.data.occurredOn.split("-").map(Number) as [number, number];
    if (y !== ym.year || m !== ym.month) setYm({ year: y, month: m });
  }, [latest.data, s, ym.year, ym.month]);
  const go = (d: number) => { touched.current = true; setYm((c) => shiftMonth(c.year, c.month, d)); };
  const [bandText, bandTone] = band[s?.savingsBand ?? "none"];
  const overspent = (s?.savingsRatePct ?? 0) < 0;
  const today = todayLocal();
  const days = daily.data?.days ?? [];

  return (
    <Screen onRefresh={() => void qc.invalidateQueries()} refreshing={summary.isRefetching && !summary.isPlaceholderData}>
      <T size={26} bold>Dashboard</T>
      <GetStarted />
      <MonthPicker label={monthLabel(ym.year, ym.month)} onPrev={() => go(-1)} onNext={() => go(1)} />
      {summary.error ? <ErrorText error={summary.error} onRetry={() => void qc.invalidateQueries()} /> : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Kpi index={0} label="Income" minor={s?.incomeMinor} cur={cur} tone="income" before={prevSummary.data?.incomeMinor} goodWhenUp />
          <Kpi index={1} label="Expense" minor={s?.expenseMinor} cur={cur} tone="expense" before={prevSummary.data?.expenseMinor} goodWhenUp={false} />
          <Kpi index={2} label="Net" minor={s?.netMinor} cur={cur} tone={s && s.netMinor < 0 ? "expense" : "income"} before={prevSummary.data?.netMinor} goodWhenUp sign />
          <FadeIn index={3} style={{ flexBasis: "47%", flexGrow: 1 }}>
            <Card style={{ padding: 14, gap: 6 }}>
              <T tone="muted" size={12}>Savings rate</T>
              {!s ? <Skeleton height={24} width="50%" /> : <T size={19} bold tone={overspent ? "expense" : "fg"}>{s.savingsRatePct == null ? "—" : `${s.savingsRatePct.toFixed(0)}%`}</T>}
              <View>
                {/* Below zero there is no point on a 0–100 bar: fill it in red so overspending doesn't look like an empty, broken bar. */}
                <ProgressBar pct={overspent ? 100 : Math.max(0, s?.savingsRatePct ?? 0)} color={t[bandTone === "muted" ? "muted" : bandTone]} height={6} />
                <View style={{ position: "absolute", left: "20%", top: -2, width: 2, height: 10, backgroundColor: t.muted }} accessibilityLabel="20 percent healthy marker" />
              </View>
              <T tone={bandTone} size={11} bold>{bandText}</T>
            </Card>
          </FadeIn>
        </View>
      )}

      <Section index={4} title={`Income vs expense · ${ym.year}`} state={trend}>
        {trend.data && <BarChart labels={MONTHS} format={fmt} highlight={undefined} series={[{ name: "Income", values: trend.data.incomeMinor, color: t.income }, { name: "Expense", values: trend.data.expenseMinor, color: t.expense }]} />}
      </Section>
      <Section index={5} title="Spending per day" state={daily}>
        <BarChart labels={days.map((d) => String(Number(d.date.slice(8))))} format={fmt} height={110} highlight={days.findIndex((d) => d.date === today)} series={[{ name: "Spent", values: days.map((d) => d.expenseMinor), color: t.expense }]} />
      </Section>
      <Section index={6} title="Where the money went" state={expenseCats}>
        <ShareBar format={fmt} slices={(expenseCats.data?.items ?? []).map((i) => ({ label: i.name, value: i.totalMinor }))} />
      </Section>
      <Section index={7} title="Income sources" state={incomeCats}>
        <ShareBar format={fmt} slices={(incomeCats.data?.items ?? []).map((i) => ({ label: i.name, value: i.totalMinor }))} />
      </Section>
      <Section index={8} title="Budgets" state={budgets} action={<T tone="primary" size={13} onPress={() => router.navigate("/budgets")}>Manage</T>}>
        {(budgets.data?.items.length ?? 0) === 0 ? <T tone="muted">No budgets this month.</T> : (
          <View style={{ gap: 12 }}>
            {budgets.data!.items.slice(0, 5).map((b) => (
              <View key={b.id} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T numberOfLines={1} style={{ flex: 1 }}>{b.categoryName ?? "All expenses"}</T><T tone="muted" size={13}>{b.pct.toFixed(0)}%</T></View>
                <ProgressBar pct={b.pct} color={b.state === "over" ? t.expense : b.state === "warning" ? t.warn : t.income} height={6} />
              </View>
            ))}
          </View>
        )}
      </Section>
      <Section index={9} title="Recent" action={<T tone="primary" size={13} onPress={() => router.navigate("/transactions")}>View all</T>}>
        {recent.isPending ? <ListSkeleton rows={3} /> : (recent.data?.pages[0]?.data.length ?? 0) === 0 ? <T tone="muted">Nothing recorded this month.</T> :
          recent.data!.pages[0]!.data.slice(0, 5).map((tx) => <TransactionRow key={tx.id} tx={tx} categories={cats.data} accounts={accounts.data} tags={tags.data} baseCurrency={cur} onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: tx.id } })} />)}
      </Section>
      <Section index={10} title="Accounts" state={accounts} action={<T tone="primary" size={13} onPress={() => router.push("/accounts")}>Manage</T>}>
        {(() => {
          const list = (accounts.data ?? []).filter((a) => !a.archived);
          const max = Math.max(1, ...list.map((a) => Math.abs(a.balanceMinor)));
          return list.length === 0 ? <T tone="muted">No accounts yet.</T> : (
            <View style={{ gap: 12 }}>
              {list.map((a) => (
                <View key={a.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T numberOfLines={1} style={{ flex: 1 }}>{a.name}</T><T tone={a.balanceMinor < 0 ? "expense" : "fg"} bold>{formatMoney(a.balanceMinor, a.currency)}</T></View>
                  <ProgressBar pct={Math.max(2, (Math.abs(a.balanceMinor) / max) * 100)} color={a.balanceMinor < 0 ? t.expense : t.primary} height={5} />
                </View>
              ))}
            </View>
          );
        })()}
      </Section>
    </Screen>
  );
}
