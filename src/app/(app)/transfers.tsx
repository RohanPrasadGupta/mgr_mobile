import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useAccounts, useTransfers } from "@/api/hooks";
import { Button, Card, Empty, ErrorText, ListSkeleton, MonthPicker, Screen, T } from "@/components/ui";
import { dayLabel, formatMoney, monthLabel, monthRange, shiftMonth } from "@/lib/money";

export default function Transfers() {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { from, to } = monthRange(ym.year, ym.month);
  const q = useTransfers(from, to);
  const accounts = useAccounts();
  const name = (id: string) => accounts.data?.find((a) => a.id === id)?.name ?? "Account";
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <T tone="muted" size={13}>Moving money between your own accounts. Transfers change balances but never count as income or expense.</T>
      <MonthPicker label={monthLabel(ym.year, ym.month)} onPrev={() => setYm((c) => shiftMonth(c.year, c.month, -1))} onNext={() => setYm((c) => shiftMonth(c.year, c.month, 1))} />
      <Button title="+ New transfer" onPress={() => router.push("/transfer-new")} />
      <ErrorText error={q.error} />
      {q.isPending ? <ListSkeleton rows={4} /> : q.data?.length === 0 ? <Empty>No transfers this month.</Empty> : (
        <Card style={{ paddingVertical: 4 }}>
          {q.data?.map((p) => (
            <Pressable key={p.groupId} accessibilityRole="button" accessibilityLabel={`Transfer ${name(p.out.accountId)} to ${p.in ? name(p.in.accountId) : "?"}`} onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: p.out.id } })} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
              <View style={{ flex: 1 }}>
                <T bold numberOfLines={1}>{name(p.out.accountId)} → {p.in ? name(p.in.accountId) : "?"}</T>
                <T tone="muted" size={12} numberOfLines={1}>{dayLabel(p.out.occurredOn)}{p.out.note ? ` · ${p.out.note}` : ""}</T>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <T bold>{formatMoney(p.out.amountMinor, p.out.currency)}</T>
                {p.in && p.in.currency !== p.out.currency ? <T tone="muted" size={12}>→ {formatMoney(p.in.amountMinor, p.in.currency)}</T> : null}
              </View>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
