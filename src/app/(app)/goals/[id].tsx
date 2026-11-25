import { router, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateGoals, useGoal, useMutate } from "@/api/hooks";
import { Badge, Button, Card, CardsSkeleton, Empty, ErrorText, FadeIn, ProgressBar, Screen, T, confirmAsync } from "@/components/ui";
import { goBack } from "@/lib/nav";
import { formatDate, formatMoney } from "@/lib/money";
import { useTheme } from "@/theme/theme";
import { GOAL_STATUS } from "@/lib/planning";

export default function GoalDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useGoal(id);
  const delEntry = useMutate((cid: string) => call(client.DELETE("/goals/{id}/contributions/{contributionId}", { params: { path: { id, contributionId: cid } } })), invalidateGoals, "Entry deleted");
  const delGoal = useMutate(() => call(client.DELETE("/goals/{id}", { params: { path: { id } } })), invalidateGoals, "Goal deleted");
  const g = q.data?.goal;

  async function removeGoal() {
    if (!g || !(await confirmAsync("Delete goal?", `Delete "${g.name}" and its saved-money history? Linked accounts are not affected.`))) return;
    try { await delGoal.mutateAsync(undefined as never); goBack(); } catch { /* toast shown */ }
  }
  return (
    <Screen edges={[]} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: g?.name ?? "Goal" }} />
      {q.isPending ? <CardsSkeleton count={2} /> : q.error ? <ErrorText error={q.error} onRetry={() => void q.refetch()} /> : g && (
        <>
          <FadeIn>
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T size={20} bold>{g.icon ? `${g.icon} ` : ""}{g.name}</T><Badge label={GOAL_STATUS[g.status].label} tone={GOAL_STATUS[g.status].tone} /></View>
              <T>{formatMoney(g.savedMinor, g.currency)} <T tone="muted">of {formatMoney(g.targetMinor, g.currency)} · {g.pct.toFixed(0)}%</T></T>
              <ProgressBar pct={g.pct} color={g.status === "reached" ? t.income : t.primary} height={10} />
              {g.targetDate ? <T tone="muted" size={13}>Target date {formatDate(g.targetDate)}</T> : null}
              {g.note ? <T tone="muted" size={13}>{g.note}</T> : null}
            </Card>
          </FadeIn>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {g.source === "contributions" && !g.archived && <View style={{ flex: 1 }}><Button title="+ Add money" onPress={() => router.push({ pathname: "/goal-money", params: { id } })} /></View>}
            <View style={{ flex: 1 }}><Button variant="ghost" title="Edit" onPress={() => router.push({ pathname: "/goal-form", params: { id } })} /></View>
          </View>
          {g.source === "account" ? <Empty>This goal follows an account’s balance, so there is no manual history.</Empty>
            : q.data!.contributions.length === 0 ? <Empty>No money added yet.</Empty> : (
              <Card style={{ paddingVertical: 4 }}>
                {q.data!.contributions.map((c, i) => (
                  <FadeIn key={c.id} index={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
                    <View style={{ flex: 1 }}><T>{formatDate(c.occurredOn)}</T>{c.note ? <T tone="muted" size={12} numberOfLines={1}>{c.note}</T> : null}</View>
                    <T bold tone={c.amountMinor < 0 ? "expense" : "income"}>{c.amountMinor > 0 ? "+" : "−"}{formatMoney(Math.abs(c.amountMinor), g.currency)}</T>
                    <T tone="muted" accessibilityRole="button" accessibilityLabel="Delete entry" onPress={async () => { if (await confirmAsync("Delete this entry?", "The goal's saved amount will be recalculated.")) delEntry.mutate(c.id); }}>✕</T>
                  </FadeIn>
                ))}
              </Card>
            )}
          <Button variant="danger" title="Delete goal" onPress={removeGoal} loading={delGoal.isPending} />
        </>
      )}
    </Screen>
  );
}
