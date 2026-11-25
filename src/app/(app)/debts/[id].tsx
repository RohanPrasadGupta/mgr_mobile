import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateDebts, useDebt, useMutate } from "@/api/hooks";
import { Badge, Button, Card, CardsSkeleton, Empty, ErrorText, FadeIn, ProgressBar, Screen, T, confirmAsync } from "@/components/ui";
import { goBack } from "@/lib/nav";
import { formatDate, formatMoney } from "@/lib/money";
import { useTheme } from "@/theme/theme";

export default function DebtDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useDebt(id);
  const delPayment = useMutate((pid: string) => call(client.DELETE("/debts/{id}/payments/{paymentId}", { params: { path: { id, paymentId: pid } } })), invalidateDebts, "Repayment deleted");
  const delDebt = useMutate(() => call(client.DELETE("/debts/{id}", { params: { path: { id } } })), invalidateDebts, "Debt deleted");
  const d = q.data?.debt;
  async function removeDebt() {
    if (!d || !(await confirmAsync("Delete debt?", `Delete the debt with ${d.counterparty} and its repayment history?`))) return;
    try { await delDebt.mutateAsync(undefined as never); goBack(); } catch { /* toast shown */ }
  }
  return (
    <Screen edges={[]} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: d?.counterparty ?? "Debt" }} />
      {q.isPending ? <CardsSkeleton count={2} /> : q.error ? <ErrorText error={q.error} onRetry={() => void q.refetch()} /> : d && (
        <>
          <FadeIn>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <Badge label={d.direction === "lent" ? "Owes you" : "You owe"} tone={d.direction === "lent" ? "income" : "expense"} />
                {d.status === "overdue" && <Badge label="Overdue" tone="expense" />}
                {d.status === "settled" && <Badge label="Settled" />}
              </View>
              <T tone="muted" size={13}>Outstanding</T>
              <T size={24} bold>{formatMoney(d.outstandingMinor, d.currency)}</T>
              <ProgressBar pct={(d.paidMinor / d.principalMinor) * 100} color={t.primary} height={10} />
              <T tone="muted" size={13}>{formatMoney(d.paidMinor, d.currency)} of {formatMoney(d.principalMinor, d.currency)} repaid · since {formatDate(d.startedOn)}{d.dueOn ? ` · due ${formatDate(d.dueOn)}` : ""}</T>
              {d.note ? <T tone="muted" size={13}>{d.note}</T> : null}
            </Card>
          </FadeIn>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {d.status !== "settled" && <View style={{ flex: 1 }}><Button title="Repayment" onPress={() => router.push({ pathname: "/debt-payment", params: { id } })} /></View>}
            <View style={{ flex: 1 }}><Button variant="ghost" title="Edit" onPress={() => router.push({ pathname: "/debt-form", params: { id } })} /></View>
          </View>
          <T bold>Repayments</T>
          {q.data!.payments.length === 0 ? <Empty>No repayments yet.</Empty> : (
            <Card style={{ paddingVertical: 4 }}>
              {q.data!.payments.map((p, i) => (
                <FadeIn key={p.id} index={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
                  <View style={{ flex: 1 }}><T>{formatDate(p.paidOn)}</T>{p.note ? <T tone="muted" size={12} numberOfLines={1}>{p.note}</T> : null}</View>
                  <T bold>{formatMoney(p.amountMinor, d.currency)}</T>
                  <T tone="muted" accessibilityRole="button" accessibilityLabel="Delete repayment" onPress={async () => { if (await confirmAsync("Delete this repayment?", "The outstanding amount will go back up.")) delPayment.mutate(p.id); }}>✕</T>
                </FadeIn>
              ))}
            </Card>
          )}
          <Button variant="danger" title="Delete debt" onPress={removeDebt} loading={delDebt.isPending} />
        </>
      )}
    </Screen>
  );
}
