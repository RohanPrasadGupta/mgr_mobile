import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAccounts, useCategories, useMe, useTags, useTransactions } from "@/api/hooks";
import type { Transaction } from "@/api/types";
import { Chip, ChipRow, ErrorText, FadeIn, Field, ListSkeleton, MonthPicker, T } from "@/components/ui";
import { TransactionRow } from "@/components/transaction-row";
import { dayLabel, formatMoney, monthLabel, monthRange, shiftMonth } from "@/lib/money";
import { radius, useTheme } from "@/theme/theme";

export default function Transactions() {
  const t = useTheme();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [kind, setKind] = useState<"income" | "expense" | undefined>();
  const [tagId, setTagId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const { from, to } = monthRange(ym.year, ym.month);
  const me = useMe();
  const accounts = useAccounts();
  const cats = useCategories();
  const tags = useTags();
  const list = useTransactions({ from, to, kind, q, tagId });
  const base = me.data?.baseCurrency ?? "THB";

  const sections = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const tx of list.data?.pages.flatMap((p) => p.data) ?? []) (m.get(tx.occurredOn) ?? m.set(tx.occurredOn, []).get(tx.occurredOn)!).push(tx);
    return [...m].map(([day, data]) => ({
      day, data,
      income: data.filter((x) => x.kind === "income").reduce((s, x) => s + x.baseAmountMinor, 0),
      expense: data.filter((x) => x.kind === "expense").reduce((s, x) => s + x.baseAmountMinor, 0),
    }));
  }, [list.data]);

  const header = (
    <View style={{ gap: 12, padding: 16 }}>
      <T size={26} bold>Activity</T>
      <MonthPicker label={monthLabel(ym.year, ym.month)} onPrev={() => setYm((c) => shiftMonth(c.year, c.month, -1))} onNext={() => setYm((c) => shiftMonth(c.year, c.month, 1))} />
      <ChipRow>
        <Chip label="All" selected={!kind} onPress={() => setKind(undefined)} />
        <Chip label="Income" tone="income" selected={kind === "income"} onPress={() => setKind("income")} />
        <Chip label="Expense" tone="expense" selected={kind === "expense"} onPress={() => setKind("expense")} />
      </ChipRow>
      {(tags.data?.length ?? 0) > 0 && (
        <ChipRow>
          <Chip label="All tags" selected={!tagId} onPress={() => setTagId(undefined)} />
          {tags.data!.map((x) => <Chip key={x.id} label={`#${x.name}`} selected={tagId === x.id} onPress={() => setTagId(tagId === x.id ? undefined : x.id)} />)}
        </ChipRow>
      )}
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Note or category" autoCapitalize="none" />
      {list.error ? <ErrorText error={list.error} onRetry={() => void list.refetch()} /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(x) => x.id}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
            <T tone="muted" size={13} bold>{dayLabel(section.day)}</T>
            <T size={12} tone="muted">{section.income > 0 ? `+${formatMoney(section.income, base).replace("−", "")} ` : ""}{section.expense > 0 ? `−${formatMoney(section.expense, base)}` : ""}</T>
          </View>
        )}
        renderItem={({ item, index }) => (
          <FadeIn index={index} style={{ marginHorizontal: 16, paddingHorizontal: 12, backgroundColor: t.card }}>
            <View style={{ opacity: list.isPlaceholderData ? 0.5 : 1 }}><TransactionRow tx={item} categories={cats.data} accounts={accounts.data} tags={tags.data} baseCurrency={base} onPress={() => router.push({ pathname: "/transaction/[id]", params: { id: item.id } })} /></View>
          </FadeIn>
        )}
        ListEmptyComponent={list.isPending ? <View style={{ paddingHorizontal: 16 }}><ListSkeleton rows={7} /></View> : <T tone="muted" style={{ textAlign: "center", margin: 32 }}>{q || kind || tagId ? "No transactions match these filters." : "No transactions this month."}</T>}
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} /> : <View style={{ height: 96 }} />}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => void list.refetch()}
        keyboardShouldPersistTaps="handled"
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Add transaction" onPress={() => router.push("/transaction/new")}
        style={{ position: "absolute", right: 20, bottom: 24, width: 58, height: 58, borderRadius: radius.pill, backgroundColor: t.primary, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
        <T size={30} style={{ color: t.primaryFg, marginTop: -2 }}>+</T>
      </Pressable>
    </SafeAreaView>
  );
}
