import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateGoals, useGoals, useMutate } from "@/api/hooks";
import { GOAL_STATUS } from "@/lib/planning";
import { Badge, Button, Card, CardsSkeleton, Empty, ErrorText, FadeIn, ProgressBar, Screen, Segmented, T } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/money";
import { useTheme } from "@/theme/theme";


export default function Goals() {
  const t = useTheme();
  const [view, setView] = useState<"active" | "archived">("active");
  const goals = useGoals(view === "archived");
  const archive = useMutate(({ id, archived }: { id: string; archived: boolean }) => call(client.PATCH("/goals/{id}", { params: { path: { id } }, body: { archived } })), invalidateGoals, view === "active" ? "Goal archived" : "Goal restored");

  return (
    <Screen edges={[]} onRefresh={() => void goals.refetch()} refreshing={goals.isRefetching && !goals.isPlaceholderData}>
      <Button title="+ New goal" onPress={() => router.push("/goal-form")} />
      <Segmented value={view} onChange={setView} options={[{ value: "active", label: "Active" }, { value: "archived", label: "Archived" }]} />
      {goals.isPending ? <CardsSkeleton /> : goals.error ? <ErrorText error={goals.error} onRetry={() => void goals.refetch()} /> : goals.data.length === 0 ? (
        <Empty>{view === "active" ? "No goals yet. Saving for a trip, a laptop or an emergency fund? Add a goal and track it here." : "No archived goals."}</Empty>
      ) : (
        <View style={{ gap: 12, opacity: goals.isPlaceholderData ? 0.55 : 1 }}>
          {goals.data.map((g, i) => {
            const st = GOAL_STATUS[g.status];
            const color = g.status === "reached" ? t.income : g.status === "behind" || g.status === "overdue" ? t.warn : t.primary;
            return (
              <FadeIn key={g.id} index={i}>
                <Card style={{ gap: 10 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open goal ${g.name}`} onPress={() => router.push({ pathname: "/goals/[id]", params: { id: g.id } })} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <T bold size={16} numberOfLines={1} style={{ flex: 1 }}>{g.icon ? `${g.icon} ` : ""}{g.name}</T>
                      <Badge label={st.label} tone={st.tone} />
                    </View>
                    <T tone="muted" size={12}>{g.targetDate ? `By ${formatDate(g.targetDate)}` : "No target date"} · {g.source === "account" ? "tracks an account" : "manual savings"}</T>
                  </Pressable>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T bold>{formatMoney(g.savedMinor, g.currency)}</T><T tone="muted" size={14}>of {formatMoney(g.targetMinor, g.currency)}</T></View>
                  <ProgressBar pct={g.pct} color={color} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <T tone="muted" size={12}>{g.pct.toFixed(0)}%</T>
                    <T tone="muted" size={12}>{g.remainingMinor > 0 ? `${formatMoney(g.remainingMinor, g.currency)} to go` : "Done 🎉"}</T>
                  </View>
                  {g.monthlyNeededMinor !== null && <T tone="muted" size={13}>Save about <T bold size={13}>{formatMoney(g.monthlyNeededMinor, g.currency)}</T> a month to make it on time.</T>}
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    {g.source === "contributions" && !g.archived && <View style={{ flex: 1 }}><Button small variant="ghost" title="+ Add money" onPress={() => router.push({ pathname: "/goal-money", params: { id: g.id } })} /></View>}
                    <View style={{ flex: 1 }}><Button small variant="ghost" title={g.archived ? "Restore" : "Archive"} onPress={() => archive.mutate({ id: g.id, archived: !g.archived })} /></View>
                  </View>
                </Card>
              </FadeIn>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
