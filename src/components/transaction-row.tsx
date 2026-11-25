import { Pressable, View } from "react-native";
import type { Account, Category, Tag, Transaction } from "@/api/types";
import { formatMoney } from "@/lib/money";
import { useTheme } from "@/theme/theme";
import { T } from "./ui";

export function TransactionRow({ tx, categories, accounts, tags, baseCurrency, onPress }: { tx: Transaction; categories?: Category[]; accounts?: Account[]; tags?: Tag[]; baseCurrency: string; onPress?: () => void }) {
  const t = useTheme();
  const cat = categories?.find((c) => c.id === tx.categoryId);
  const acct = accounts?.find((a) => a.id === tx.accountId);
  const transfer = tx.kind === "transfer_in" || tx.kind === "transfer_out";
  const positive = tx.kind === "income" || tx.kind === "transfer_in";
  const txTags = (tx.tagIds ?? []).map((id) => tags?.find((x) => x.id === id)).filter((x): x is Tag => !!x);
  const title = transfer ? (tx.kind === "transfer_out" ? "Transfer out" : "Transfer in") : (cat?.name ?? "Uncategorised");
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title} ${formatMoney(tx.amountMinor, tx.currency)}`} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.soft, alignItems: "center", justifyContent: "center" }}>
        <T size={18}>{transfer ? "⇄" : (cat?.icon ?? "•")}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T bold numberOfLines={1}>{title}</T>
        <T tone="muted" size={12} numberOfLines={1}>{[tx.note, acct?.name].filter(Boolean).join(" · ")}</T>
        {(txTags.length > 0 || tx.attachmentCount > 0) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
            {txTags.map((x) => <View key={x.id} style={{ borderRadius: 99, backgroundColor: `${t.primary}1f`, paddingHorizontal: 6, paddingVertical: 1 }}><T tone="primary" size={10} bold>#{x.name}</T></View>)}
            {tx.attachmentCount > 0 && <T tone="muted" size={11} accessibilityLabel={`${tx.attachmentCount} receipt${tx.attachmentCount === 1 ? "" : "s"}`}>📎{tx.attachmentCount}</T>}
          </View>
        )}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <T bold tone={transfer ? "fg" : positive ? "income" : "expense"}>{positive ? "+" : "−"}{formatMoney(tx.amountMinor, tx.currency).replace(/^[−+]/, "")}</T>
        {tx.currency !== baseCurrency && <T tone="muted" size={12}>≈ {formatMoney(tx.baseAmountMinor, baseCurrency)}</T>}
      </View>
    </Pressable>
  );
}
