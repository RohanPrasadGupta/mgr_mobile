import { useState } from "react";
import { Share, View } from "react-native";
import { useReport } from "@/api/hooks";
import type { Report } from "@/api/types";
import { BarChart, ShareBar } from "@/components/charts";
import { Button, Card, CardsSkeleton, Empty, ErrorText, FadeIn, MonthPicker, ProgressBar, Screen, Segmented, T } from "@/components/ui";
import { formatDate, formatMoney, monthLabel, shiftMonth } from "@/lib/money";
import { reportCsv } from "@/lib/report-csv";
import { toast } from "@/lib/toast";
import { useTheme } from "@/theme/theme";

const change = (now: number, before: number) => (before ? ((now - before) / Math.abs(before)) * 100 : null);

function Delta({ now, before, goodWhenUp }: { now: number; before: number; goodWhenUp: boolean }) {
  const d = change(now, before);
  if (d === null || Math.abs(d) < 0.5) return <T tone="muted" size={11}>no change</T>;
  return <T size={11} tone={(goodWhenUp ? d > 0 : d < 0) ? "income" : "expense"}>{d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(0)}% vs previous</T>;
}

export default function Reports() {
  const now = new Date();
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const report = useReport(period, ym.year, ym.month);
  const r = report.data;
  async function share() {
    if (!r) return;
    try { await Share.share({ title: `MoneyMgr report ${r.label}`, message: reportCsv(r) }); } catch { toast.error("Couldn't open the share sheet"); }
  }
  return (
    <Screen edges={[]} onRefresh={() => void report.refetch()} refreshing={report.isRefetching && !report.isPlaceholderData}>
      <Segmented value={period} onChange={setPeriod} options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
      {period === "month"
        ? <MonthPicker label={monthLabel(ym.year, ym.month)} onPrev={() => setYm((c) => shiftMonth(c.year, c.month, -1))} onNext={() => setYm((c) => shiftMonth(c.year, c.month, 1))} />
        : <MonthPicker label={String(ym.year)} prevLabel="Previous year" nextLabel="Next year" onPrev={() => setYm((c) => ({ ...c, year: c.year - 1 }))} onNext={() => setYm((c) => ({ ...c, year: c.year + 1 }))} />}
      {report.isPending ? <CardsSkeleton count={4} /> : report.error ? <ErrorText error={report.error} onRetry={() => void report.refetch()} /> : r && (
        <View style={{ gap: 16, opacity: report.isPlaceholderData ? 0.55 : 1 }}>
          <Body r={r} />
          <Button variant="ghost" title="Share as CSV" onPress={share} />
        </View>
      )}
    </Screen>
  );
}

function Body({ r }: { r: Report }) {
  const t = useTheme();
  const fmt = (v: number) => formatMoney(v, r.baseCurrency);
  if (r.transactionCount === 0 && r.previous.incomeMinor === 0 && r.previous.expenseMinor === 0) return <Empty>No income or expenses in {r.label}.</Empty>;
  const tile = (label: string, value: string, tone: "income" | "expense" | "fg", delta: React.ReactNode, i: number) => (
    <FadeIn index={i} style={{ flexBasis: "47%", flexGrow: 1 }}><Card style={{ gap: 2, padding: 12 }}><T tone="muted" size={12}>{label}</T><T tone={tone} size={18} bold numberOfLines={1}>{value}</T>{delta}</Card></FadeIn>
  );
  return (
    <>
      <T tone="muted" size={13}>{formatDate(r.from)} – {formatDate(r.to)} · {r.transactionCount} transactions</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tile("Income", fmt(r.incomeMinor), "income", <Delta now={r.incomeMinor} before={r.previous.incomeMinor} goodWhenUp />, 0)}
        {tile("Expense", fmt(r.expenseMinor), "expense", <Delta now={r.expenseMinor} before={r.previous.expenseMinor} goodWhenUp={false} />, 1)}
        {tile("Net", formatMoney(r.netMinor, r.baseCurrency, { sign: true }), r.netMinor < 0 ? "expense" : "income", <Delta now={r.netMinor} before={r.previous.netMinor} goodWhenUp />, 2)}
        {tile("Savings rate", r.savingsRatePct === null ? "—" : `${r.savingsRatePct.toFixed(0)}%`, "fg", <T tone="muted" size={11}>{fmt(r.avgDailyExpenseMinor)} spent per day</T>, 3)}
      </View>
      <Card style={{ gap: 8 }}>
        <T bold>{r.period === "year" ? "Month by month" : "Day by day"}</T>
        <BarChart labels={r.series.map((s) => s.label)} format={fmt} series={[{ name: "Income", values: r.series.map((s) => s.incomeMinor), color: t.income }, { name: "Expense", values: r.series.map((s) => s.expenseMinor), color: t.expense }]} />
      </Card>
      <Card style={{ gap: 10 }}><T bold>Spending by category</T><ShareBar format={fmt} slices={r.expenseByCategory.map((c) => ({ label: c.name, value: c.totalMinor }))} /></Card>
      <CategoryList title="Expenses vs previous" rows={r.expenseByCategory} fmt={fmt} upIsBad />
      <CategoryList title="Income vs previous" rows={r.incomeByCategory} fmt={fmt} />
      <Card style={{ gap: 4 }}>
        <T bold>Biggest expenses</T>
        {r.topExpenses.length === 0 ? <T tone="muted">No expenses.</T> : r.topExpenses.map((x, i) => (
          <View key={x.id} style={{ flexDirection: "row", gap: 8, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
            <T tone="muted" size={12}>{i + 1}.</T>
            <View style={{ flex: 1 }}><T bold numberOfLines={1}>{x.categoryName ?? "Uncategorised"}</T><T tone="muted" size={12} numberOfLines={1}>{[formatDate(x.occurredOn), x.note, x.accountName].filter(Boolean).join(" · ")}</T></View>
            <T tone="expense" bold>{formatMoney(x.amountMinor, x.currency)}</T>
          </View>
        ))}
      </Card>
      {r.budgets.length > 0 && (
        <Card style={{ gap: 10 }}>
          <T bold>Budgets</T>
          {r.budgets.map((b) => (
            <View key={b.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T numberOfLines={1} style={{ flex: 1 }}>{b.categoryName ?? "All expenses"}</T><T size={13} tone={b.state === "over" ? "expense" : b.state === "warning" ? "warn" : "muted"}>{fmt(b.spentMinor)} / {fmt(b.amountMinor)}</T></View>
              <ProgressBar pct={b.pct} color={b.state === "over" ? t.expense : b.state === "warning" ? t.warn : t.income} height={6} />
            </View>
          ))}
        </Card>
      )}
      {r.byAccount.length > 0 && (
        <Card style={{ gap: 6 }}>
          <T bold>By account</T>
          {r.byAccount.map((a) => (
            <View key={a.accountId} style={{ flexDirection: "row", gap: 8 }}>
              <T style={{ flex: 1 }} numberOfLines={1}>{a.name}</T>
              <T tone="income" size={13}>+{formatMoney(a.incomeMinor, a.currency)}</T>
              <T tone="expense" size={13}>−{formatMoney(a.expenseMinor, a.currency)}</T>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function CategoryList({ title, rows, fmt, upIsBad }: { title: string; rows: Report["expenseByCategory"]; fmt: (v: number) => string; upIsBad?: boolean }) {
  const t = useTheme();
  if (!rows.length) return null;
  return (
    <Card style={{ gap: 4 }}>
      <T bold>{title}</T>
      {rows.map((c, i) => (
        <View key={c.categoryId ?? c.name} style={{ flexDirection: "row", gap: 8, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
          <T style={{ flex: 1 }} numberOfLines={1}>{c.name}</T>
          <T size={13}>{fmt(c.totalMinor)}</T>
          <T size={13} style={{ minWidth: 48, textAlign: "right" }} tone={c.changePct === null ? "muted" : (c.changePct > 0) === !!upIsBad ? "expense" : "income"}>
            {c.changePct === null ? (c.totalMinor > 0 ? "new" : "—") : `${c.changePct > 0 ? "+" : ""}${c.changePct.toFixed(0)}%`}
          </T>
        </View>
      ))}
    </Card>
  );
}
