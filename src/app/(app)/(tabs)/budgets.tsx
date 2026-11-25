import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { call, client } from "@/api/client";
import { useBudgetStatus, useMutate } from "@/api/hooks";
import { Button, FadeIn, Card, CardsSkeleton, Empty, ErrorText, MonthPicker, ProgressBar, Screen, T, confirmAsync } from "@/components/ui";
import { budgetDate, formatMoney, monthLabel, shiftMonth } from "@/lib/money";
import { useTheme } from "@/theme/theme";

const stateText = { ok: "On track", warning: "Close to limit", over: "Over budget" } as const;
const PERIOD = { month: "Monthly", week: "Weekly", custom: "Custom range" } as const;

export default function Budgets() {
  const t = useTheme();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const status = useBudgetStatus(budgetDate(ym.year, ym.month, now));
  const remove = useMutate((id: string) => call(client.DELETE("/budgets/{id}", { params: { path: { id } } })), (qc) => qc.invalidateQueries({ queryKey: ["budgets"] }), "Budget deleted");
  const base = status.data?.baseCurrency ?? "THB";
  const [error, setError] = useState<unknown>(null);

  return (
    <Screen onRefresh={() => void status.refetch()} refreshing={status.isRefetching}>
      <T size={26} bold>Budgets</T>
      <MonthPicker label={monthLabel(ym.year, ym.month)} onPrev={() => setYm((c) => shiftMonth(c.year, c.month, -1))} onNext={() => setYm((c) => shiftMonth(c.year, c.month, 1))} />
      <Button title="+ Add budget" onPress={() => router.push("/budget-new")} />
      <ErrorText error={status.error ?? error} />
      {status.isPending ? <CardsSkeleton count={3} /> : status.data?.items.length === 0 ? <Empty>No budgets active this month.</Empty> : status.data?.items.map((b, i) => {
        const color = b.state === "ok" ? t.income : b.state === "warning" ? t.warn : t.expense;
        return (
          <FadeIn key={b.id} index={i}><Card style={{ gap: 10, opacity: status.isPlaceholderData ? 0.55 : 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}><T bold numberOfLines={1}>{b.categoryName ?? "All expenses"}</T><T tone="muted" size={12}>{PERIOD[b.period]} · {b.window.from} → {b.window.to}</T></View>
              <T size={12} bold style={{ color }}>{stateText[b.state]}</T>
            </View>
            <ProgressBar pct={b.pct} color={color} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T size={14}>{formatMoney(b.spentMinor, base)} <T tone="muted" size={14}>of {formatMoney(b.amountMinor, base)}</T></T>
              <T size={14} tone={b.remainingMinor < 0 ? "expense" : "muted"}>{b.remainingMinor < 0 ? `${formatMoney(-b.remainingMinor, base)} over` : `${formatMoney(b.remainingMinor, base)} left`} · {b.pct.toFixed(0)}%</T>
            </View>
            <Pressable accessibilityRole="button" onPress={async () => { if (await confirmAsync("Delete budget?", `The ${b.categoryName ?? "overall"} budget will be removed.`)) { setError(null); remove.mutate(b.id); } }}>
              <T tone="muted" size={13} style={{ textDecorationLine: "underline" }}>Delete</T>
            </Pressable>
          </Card></FadeIn>
        );
      })}
    </Screen>
  );
}
