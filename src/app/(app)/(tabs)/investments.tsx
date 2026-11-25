import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { usePortfolio } from "@/api/hooks";
import type { AssetClass, Holding } from "@/api/types";
import { Button, Card, CardsSkeleton, Empty, ErrorText, ProgressBar, Screen, T } from "@/components/ui";
import { CLASS_LABEL } from "@/lib/investments";
import { PortfolioChart } from "@/components/portfolio-chart";
import { formatMoney, formatPct, formatQty } from "@/lib/money";
import { useTheme } from "@/theme/theme";

const tone = (n: number | null) => (n === null || n === 0 ? "fg" : n > 0 ? "income" : "expense");

export default function Investments() {
  const t = useTheme();
  const qc = useQueryClient();
  const q = usePortfolio();
  const p = q.data;
  const base = p?.baseCurrency ?? "THB";

  return (
    <Screen onRefresh={() => void qc.invalidateQueries({ queryKey: ["investments"] })} refreshing={q.isRefetching}>
      <T size={26} bold>Investments</T>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><Button title="+ Add asset" onPress={() => router.push("/asset-new")} /></View>
        <View style={{ flex: 1 }}><Button title="SIP calculator" variant="ghost" onPress={() => router.push("/sip")} /></View>
      </View>
      <ErrorText error={q.error} />
      {q.isPending ? <CardsSkeleton count={3} /> : p && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Stat label="Portfolio value" value={formatMoney(p.marketValueMinor, base)} />
            <Stat label="Invested (cost)" value={formatMoney(p.investedMinor, base)} />
            <Stat label="Unrealised P/L" value={formatMoney(p.unrealisedPnlMinor, base, { sign: true })} tone={tone(p.unrealisedPnlMinor)} />
            <Stat label="Realised P/L" value={formatMoney(p.realisedPnlMinor, base, { sign: true })} tone={tone(p.realisedPnlMinor)} />
          </View>
          <T tone="muted" size={12}>Annualised return (XIRR): <T size={12} bold tone={tone(p.xirrPct)}>{formatPct(p.xirrPct, true)}</T>{p.approximate ? " · converted at today's FX rate" : ""}{!p.pricedAll ? "; holdings without a price are counted at cost" : ""}</T>
          {p.excluded.length > 0 && <Card><T tone="warn" size={13}>Not included in the totals: {p.excluded.map((e) => `${e.symbol} (${e.reason})`).join(", ")}.</T></Card>}
          {p.holdings.length === 0 ? <Empty>No investments yet. Add an asset (a stock, crypto, a SIP or pension fund…) then record trades or contributions.</Empty> : (
            <>
              <PortfolioChart />
              <Card style={{ paddingVertical: 4 }}>
                {p.holdings.map((h, i) => <HoldingRow key={h.asset.id} h={h} first={i === 0} />)}
              </Card>
              <Card style={{ gap: 10 }}>
                <T bold>Allocation</T>
                {p.allocation.map((a) => (
                  <View key={a.class} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T>{CLASS_LABEL[a.class as AssetClass]}</T><T tone="muted" size={13}>{formatMoney(a.valueMinor, base)} · {a.pct.toFixed(0)}%</T></View>
                    <ProgressBar pct={a.pct} color={t.primary} />
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, tone: tn = "fg" }: { label: string; value: string; tone?: "fg" | "income" | "expense" }) {
  return <Card style={{ flexBasis: "47%", flexGrow: 1 }}><T tone="muted" size={12}>{label}</T><T bold size={18} tone={tn}>{value}</T></Card>;
}

function HoldingRow({ h, first }: { h: Holding; first: boolean }) {
  const t = useTheme();
  const a = h.asset;
  const value = h.marketValueMinor ?? h.remainingCostMinor;
  const pl = h.unrealisedPnlMinor ?? h.realisedPnlMinor;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${a.symbol} ${a.name}`} onPress={() => router.push({ pathname: "/investments/[id]", params: { id: a.id } })}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1, borderTopWidth: first ? 0 : 1, borderTopColor: t.border })}>
      <View style={{ flex: 1 }}>
        <T bold numberOfLines={1}>{a.symbol} <T tone="muted" size={13}>· {a.name}</T></T>
        <T tone="muted" size={12}>{CLASS_LABEL[a.class]} · {a.currency}{a.tracking === "units" && !h.closed ? ` · ${formatQty(h.quantity)} units` : ""}{h.closed ? " · closed" : ""}{h.marketValueMinor === null && h.tradeCount > 0 ? " · no price set" : ""}</T>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <T bold>{formatMoney(value, a.currency)}</T>
        <T size={12} tone={tone(pl)}>{h.unrealisedPnlMinor !== null ? `${formatMoney(h.unrealisedPnlMinor, a.currency, { sign: true })} · ${formatPct(h.returnPct, true)}` : h.realisedPnlMinor ? `${formatMoney(h.realisedPnlMinor, a.currency, { sign: true })} realised` : "—"}</T>
      </View>
    </Pressable>
  );
}
