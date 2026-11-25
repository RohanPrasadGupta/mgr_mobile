import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateInvestments, useAssetPrices, useAssetTrades, useHolding, useMutate } from "@/api/hooks";
import type { Body, CostMethod, Holding } from "@/api/types";
import { Button, Card, CardsSkeleton, Chip, ChipRow, Empty, ErrorText, Field, ListSkeleton, Screen, T, confirmAsync } from "@/components/ui";
import { CLASS_LABEL, TYPE_LABEL, isInflow } from "@/lib/investments";
import { formatMoney, formatPct, formatQty, formatUnitPrice, minorUnit, parseAmount, todayLocal } from "@/lib/money";

const tone = (n: number | null) => (n === null || n === 0 ? "fg" : n > 0 ? "income" : "expense");

export default function AssetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const holding = useHolding(id);
  const trades = useAssetTrades(id);
  const [error, setError] = useState<unknown>(null);
  const patch = useMutate((body: Body<"/investments/assets/{id}", "patch">) => call(client.PATCH("/investments/assets/{id}", { params: { path: { id: id! } }, body })), invalidateInvestments, "Asset updated");
  const remove = useMutate(() => call(client.DELETE("/investments/assets/{id}", { params: { path: { id: id! } } })), invalidateInvestments, "Asset deleted");

  if (holding.isPending) return <Screen><CardsSkeleton count={3} /></Screen>;
  if (holding.error || !holding.data) return <Screen><ErrorText error={holding.error ?? new Error("Asset not found")} /></Screen>;
  const h = holding.data;
  const a = h.asset;
  const units = a.tracking === "units";
  const cur = a.currency;
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); } catch (e) { setError(e); } };

  return (
    <Screen>
      <View>
        <T size={24} bold>{a.symbol}</T>
        <T tone="muted">{a.name} · {CLASS_LABEL[a.class]} · {cur}{a.archived ? " · archived" : ""}</T>
      </View>
      <Button title={units ? "+ Add trade" : "+ Add entry"} disabled={a.archived} onPress={() => router.push({ pathname: "/trade", params: { assetId: a.id } })} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {(units ? [
          ["Units held", h.closed ? "0 (closed)" : formatQty(h.quantity)],
          [a.costMethod === "manual" ? "Avg price (selected)" : "Avg cost / unit", h.avgCostMinor === null ? "—" : formatUnitPrice(h.avgCostMinor, cur)],
          ["Cost of holding", formatMoney(h.remainingCostMinor, cur)],
          ["Market value", h.marketValueMinor === null ? "Set a price" : formatMoney(h.marketValueMinor, cur)],
          ["Unrealised P/L", h.unrealisedPnlMinor === null ? "—" : formatMoney(h.unrealisedPnlMinor, cur, { sign: true }), tone(h.unrealisedPnlMinor)],
          ["Realised P/L", formatMoney(h.realisedPnlMinor, cur, { sign: true }), tone(h.realisedPnlMinor)],
          ["Return", `${formatPct(h.returnPct, true)}  ·  XIRR ${formatPct(h.xirrPct, true)}`, tone(h.returnPct)],
          ["Dividends · fees", `${formatMoney(h.dividendsMinor, cur)} · ${formatMoney(h.feesMinor, cur)}`],
        ] : [
          ["Contributed", formatMoney(h.contributedMinor, cur)],
          ["Withdrawn", formatMoney(h.withdrawnMinor, cur)],
          ["Net invested", formatMoney(h.remainingCostMinor, cur)],
          ["Current value", h.marketValueMinor === null ? "Set a value" : formatMoney(h.marketValueMinor, cur)],
          ["Gain / loss", h.unrealisedPnlMinor === null ? "—" : formatMoney(h.unrealisedPnlMinor, cur, { sign: true }), tone(h.unrealisedPnlMinor)],
          ["Return", `${formatPct(h.returnPct, true)}  ·  XIRR ${formatPct(h.xirrPct, true)}`, tone(h.returnPct)],
          ["Dividends / interest", formatMoney(h.dividendsMinor, cur)],
          ["Fees", formatMoney(h.feesMinor, cur)],
        ]).map(([label, value, tn]) => (
          <Card key={label} style={{ flexBasis: "47%", flexGrow: 1, padding: 12 }}><T tone="muted" size={12}>{label}</T><T bold tone={(tn as "fg" | "income" | "expense") ?? "fg"}>{value}</T></Card>
        ))}
      </View>

      <PriceCard h={h} />

      <Card style={{ gap: 4 }}>
        <T bold>{units ? "Trades" : "Contributions & withdrawals"}</T>
        {trades.isPending ? <ListSkeleton rows={3} /> : trades.data?.length === 0 ? <T tone="muted">Nothing recorded yet.</T> : trades.data?.map((tr) => (
          <Pressable key={tr.id} accessibilityRole="button" accessibilityLabel={`${TYPE_LABEL[tr.type]} ${tr.tradedOn}`} onPress={() => router.push({ pathname: "/trade", params: { assetId: a.id, tradeId: tr.id } })} style={({ pressed }) => ({ flexDirection: "row", gap: 10, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
            <T tone="muted" size={12} style={{ width: 78 }}>{tr.tradedOn}</T>
            <View style={{ flex: 1 }}>
              <T bold>{TYPE_LABEL[tr.type]}{tr.quantity !== null ? <T tone="muted" size={13}> · {formatQty(tr.quantity)}{tr.priceMinor !== null ? ` × ${formatUnitPrice(tr.priceMinor, cur)}` : ""}</T> : null}</T>
              {(tr.note || tr.feeMinor) ? <T tone="muted" size={12} numberOfLines={1}>{[tr.note, tr.feeMinor ? `fee ${formatMoney(tr.feeMinor, cur)}` : null].filter(Boolean).join(" · ")}</T> : null}
            </View>
            <T bold tone={tr.type === "bonus" ? "muted" : isInflow(tr.type) ? "income" : "fg"}>{tr.type === "bonus" ? "free" : `${isInflow(tr.type) ? "+" : "−"}${formatMoney(tr.amountMinor, cur)}`}</T>
          </Pressable>
        ))}
      </Card>

      <Card style={{ gap: 12 }}>
        {units && (
          <View style={{ gap: 6 }}>
            <T tone="muted" size={13} bold>Cost method</T>
            <ChipRow>{([["wavg", "Weighted average"], ["fifo", "FIFO"], ["manual", "Selected buys"]] as [CostMethod, string][]).map(([v, l]) => <Chip key={v} label={l} selected={a.costMethod === v} onPress={() => act(() => patch.mutateAsync({ costMethod: v }))} />)}</ChipRow>
          </View>
        )}
        <ErrorText error={error} />
        <View style={{ flexDirection: "row", gap: 16 }}>
          <T tone="muted" size={13} style={{ textDecorationLine: "underline" }} onPress={() => act(() => patch.mutateAsync({ archived: !a.archived }))}>{a.archived ? "Unarchive" : "Archive"}</T>
          <T tone="muted" size={13} style={{ textDecorationLine: "underline" }} onPress={async () => { if (await confirmAsync(`Delete ${a.symbol}?`, "Assets with trades can only be archived.")) await act(async () => { await remove.mutateAsync(undefined as never); goBack(); }); }}>Delete asset</T>
        </View>
      </Card>
    </Screen>
  );
}

function PriceCard({ h }: { h: Holding }) {
  const a = h.asset;
  const units = a.tracking === "units";
  const prices = useAssetPrices(a.id);
  const [price, setPrice] = useState("");
  const [error, setError] = useState<unknown>(null);
  const save = useMutate((body: Body<"/investments/assets/{id}/prices", "post">) => call(client.POST("/investments/assets/{id}/prices", { params: { path: { id: a.id } }, body })), invalidateInvestments, "Price saved");

  async function submit() {
    setError(null);
    const v = parseAmount(price);
    if (!(v > 0)) return setError(new Error("Enter a value greater than 0"));
    try { await save.mutateAsync({ asOn: todayLocal(), priceMinor: Number((v * 10 ** minorUnit(a.currency)).toFixed(6)) }); setPrice(""); } catch (e) { setError(e); }
  }
  return (
    <Card style={{ gap: 10 }}>
      <T bold>{units ? "Current price" : "Current total value"}</T>
      <T tone="muted" size={13}>{h.latestPrice ? `${units ? formatUnitPrice(h.latestPrice.priceMinor, a.currency) : formatMoney(h.latestPrice.priceMinor, a.currency)} as of ${h.latestPrice.asOn}` : "Not set — enter it to see market value and P/L."}{prices.data && prices.data.length > 1 ? ` · ${prices.data.length} price points` : ""}</T>
      <Field label={units ? `New price per unit (${a.currency}) — today` : `New total value (${a.currency}) — today`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <ErrorText error={error} />
      <Button title="Update" variant="ghost" onPress={submit} loading={save.isPending} />
    </Card>
  );
}
