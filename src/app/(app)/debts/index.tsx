import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useDebtSummary, useDebts } from "@/api/hooks";
import { Badge, Button, Card, CardsSkeleton, Empty, ErrorText, FadeIn, ProgressBar, Screen, Segmented, Skeleton, T } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/money";
import { useTheme } from "@/theme/theme";

export default function Debts() {
  const t = useTheme();
  const [status, setStatus] = useState<"open" | "settled" | "all">("open");
  const debts = useDebts(status);
  const summary = useDebtSummary();
  return (
    <Screen edges={[]} onRefresh={() => { void debts.refetch(); void summary.refetch(); }} refreshing={debts.isRefetching && !debts.isPlaceholderData}>
      <Button title="+ Record debt" onPress={() => router.push("/debt-form")} />
      {summary.isPending ? <Skeleton height={96} /> : summary.error ? <ErrorText error={summary.error} onRetry={() => void summary.refetch()} /> : summary.data.totals.length === 0 ? (
        <Card><T tone="muted">Nothing outstanding — nobody owes you and you owe nobody. 🎉</T></Card>
      ) : summary.data.totals.map((x, i) => (
        <FadeIn key={x.currency} index={i}>
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}><T tone="muted" size={12}>Owed to you</T><T tone="income" size={18} bold>{formatMoney(x.owedToMeMinor, x.currency)}</T></View>
              <View style={{ flex: 1 }}><T tone="muted" size={12}>You owe</T><T tone="expense" size={18} bold>{formatMoney(x.iOweMinor, x.currency)}</T></View>
            </View>
            <T tone="muted" size={13}>Net <T size={13} bold tone={x.netMinor >= 0 ? "income" : "expense"}>{formatMoney(x.netMinor, x.currency, { sign: true })}</T>{summary.data.overdueCount > 0 ? <T tone="expense" size={13}>  · {summary.data.overdueCount} overdue</T> : null}</T>
          </Card>
        </FadeIn>
      ))}
      <Segmented value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "settled", label: "Settled" }, { value: "all", label: "All" }]} />
      {debts.isPending ? <CardsSkeleton /> : debts.error ? <ErrorText error={debts.error} onRetry={() => void debts.refetch()} /> : debts.data.length === 0 ? (
        <Empty>{status === "settled" ? "No settled debts yet." : "No open debts. Lent money to a friend or borrowed some? Record it to keep track of repayments."}</Empty>
      ) : (
        <View style={{ gap: 10, opacity: debts.isPlaceholderData ? 0.55 : 1 }}>
          {debts.data.map((d, i) => (
            <FadeIn key={d.id} index={i}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Debt with ${d.counterparty}`} onPress={() => router.push({ pathname: "/debts/[id]", params: { id: d.id } })}>
                <Card style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <T bold size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{d.counterparty}</T>
                    <Badge label={d.direction === "lent" ? "Owes you" : "You owe"} tone={d.direction === "lent" ? "income" : "expense"} />
                    {d.status === "overdue" && <Badge label="Overdue" tone="expense" />}
                    {d.status === "settled" && <Badge label="Settled" />}
                  </View>
                  <ProgressBar pct={(d.paidMinor / d.principalMinor) * 100} color={t.primary} height={6} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <T tone="muted" size={12} style={{ flex: 1 }}>{formatMoney(d.paidMinor, d.currency)} of {formatMoney(d.principalMinor, d.currency)} repaid · since {formatDate(d.startedOn)}{d.dueOn ? ` · due ${formatDate(d.dueOn)}` : ""}</T>
                    <View style={{ alignItems: "flex-end" }}><T tone="muted" size={11}>Outstanding</T><T bold>{formatMoney(d.outstandingMinor, d.currency)}</T></View>
                  </View>
                </Card>
              </Pressable>
            </FadeIn>
          ))}
        </View>
      )}
    </Screen>
  );
}
