import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateLedger, invalidateRecurring, useAccounts, useCategories, useMutate, useRecurring } from "@/api/hooks";
import { Button, Card, CardsSkeleton, Empty, ErrorText, Screen, T, confirmAsync } from "@/components/ui";
import { freqLabel } from "@/lib/investments";
import { formatMoney } from "@/lib/money";

const refresh = (qc: import("@tanstack/react-query").QueryClient) => Promise.all([invalidateRecurring(qc), invalidateLedger(qc)]);

export default function Recurring() {
  const rules = useRecurring();
  const accounts = useAccounts();
  const cats = useCategories();
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const patch = useMutate(({ id, active }: { id: string; active: boolean }) => call(client.PATCH("/recurring/{id}", { params: { path: { id } }, body: { active } })), refresh, "Rule updated");
  const remove = useMutate((id: string) => call(client.DELETE("/recurring/{id}", { params: { path: { id } } })), refresh, "Rule deleted");
  const runDue = useMutate(() => call(client.POST("/recurring/run-due")), refresh);
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); } catch (e) { setError(e); } };
  const sorted = [...(rules.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.nextRunOn.localeCompare(b.nextRunOn));

  async function runNow() {
    setReport(null); setError(null);
    try {
      const r = (await runDue.mutateAsync(undefined as never)).data;
      setReport(r.posted > 0 ? `Posted ${r.posted} transaction${r.posted === 1 ? "" : "s"}.` : r.errors.length ? `${r.errors.length} rule(s) could not run — see the error on each rule.` : "Nothing is due right now.");
    } catch (e) { setError(e); }
  }

  return (
    <Screen onRefresh={() => void rules.refetch()} refreshing={rules.isRefetching}>
      <T tone="muted" size={13}>Rules post automatically every 15 minutes while the server is running. Missed dates are never duplicated.</T>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><Button title="+ Add rule" onPress={() => router.push("/recurring-form")} /></View>
        <View style={{ flex: 1 }}><Button title="Run due now" variant="ghost" onPress={runNow} loading={runDue.isPending} /></View>
      </View>
      {report ? <Card><T accessibilityRole="alert">{report}</T></Card> : null}
      <ErrorText error={rules.error ?? error} />
      {rules.isPending ? <CardsSkeleton count={3} /> : sorted.length === 0 ? <Empty>No recurring rules. Add rent, salary or subscriptions so they record themselves.</Empty> : sorted.map((r) => {
        const cat = cats.data?.find((c) => c.id === r.categoryId);
        const acct = accounts.data?.find((a) => a.id === r.accountId);
        return (
          <Card key={r.id} style={{ gap: 6, opacity: r.active ? 1 : 0.7 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <T bold numberOfLines={1}>{r.note || cat?.name || (r.kind === "income" ? "Income" : "Expense")}</T>
                <T tone="muted" size={12}>{freqLabel(r.frequency, r.interval)} · {acct?.name ?? "Account"}</T>
              </View>
              <T bold tone={r.kind === "income" ? "income" : "expense"}>{r.kind === "income" ? "+" : "−"}{formatMoney(r.amountMinor, acct?.currency ?? "THB").replace(/^[−+]/, "")}</T>
            </View>
            <T tone="muted" size={12}>{r.active ? `Next: ${r.nextDates.join(" · ") || r.nextRunOn}` : "Paused or finished"}{r.endOn ? ` · ends ${r.endOn}` : ""}</T>
            {r.lastError ? <T tone="expense" size={12} accessibilityRole="alert">Last run failed: {r.lastError}</T> : null}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
              <T tone="muted" size={13} style={{ textDecorationLine: "underline" }} onPress={() => act(() => patch.mutateAsync({ id: r.id, active: !r.active }))}>{r.active ? "Pause" : "Resume"}</T>
              <T tone="muted" size={13} style={{ textDecorationLine: "underline" }} onPress={() => router.push({ pathname: "/recurring-form", params: { id: r.id } })}>Edit</T>
              <Pressable accessibilityRole="button" onPress={async () => { if (await confirmAsync("Delete this rule?", "Transactions it already posted are kept.")) await act(() => remove.mutateAsync(r.id)); }}><T tone="muted" size={13} style={{ textDecorationLine: "underline" }}>Delete</T></Pressable>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
