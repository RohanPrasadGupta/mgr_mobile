import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { useState } from "react";
import { Switch, View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateInvestments, useAssetPrices, useAssetTrades, useHolding, useMutate } from "@/api/hooks";
import type { Body, CostMethod, Holding, Trade } from "@/api/types";
import { Button, Card, CardsSkeleton, Chip, ChipRow, ErrorText, Field, ListSkeleton, Screen, T, confirmAsync } from "@/components/ui";
import { CurrencyPicker } from "@/components/currency-picker";
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
  // The trade id is the mutation's argument, so the request always targets the row whose Delete was pressed.
  const removeTrade = useMutate((tradeId: string) => call(client.DELETE("/investments/trades/{id}", { params: { path: { id: tradeId } } })), invalidateInvestments, "Entry deleted");
  const [deleting, setDeleting] = useState<string | null>(null);
  const toggleAvg = useMutate(({ tradeId, on }: { tradeId: string; on: boolean }) => call(client.PATCH("/investments/trades/{id}", { params: { path: { id: tradeId } }, body: { includeInAvg: on } })), invalidateInvestments);

  if (holding.isPending) return <Screen><CardsSkeleton count={3} /></Screen>;
  if (holding.error || !holding.data) return <Screen><ErrorText error={holding.error ?? new Error("Asset not found")} /></Screen>;
  const h = holding.data;
  const a = h.asset;
  const units = a.tracking === "units";
  const cur = a.currency;
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); } catch (e) { setError(e); } };
  const deleteTrade = async (tr: Trade) => {
    if (!(await confirmAsync("Delete this entry?", `${TYPE_LABEL[tr.type]} on ${tr.tradedOn}. This cannot be undone.`))) return;
    setDeleting(tr.id);
    try { await act(() => removeTrade.mutateAsync(tr.id)); } finally { setDeleting(null); }
  };

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
          [a.costMethod === "manual" || trades.data?.some((x) => x.type === "buy" && !x.includeInAvg) ? "Avg price (buys in average)" : "Avg cost / unit", h.avgCostMinor === null ? "—" : formatUnitPrice(h.avgCostMinor, cur)],
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
          <View key={tr.id} style={{ flexDirection: "row", gap: 10, paddingVertical: 10 }}>
            <T tone="muted" size={12} style={{ width: 78 }}>{tr.tradedOn}</T>
            <View style={{ flex: 1 }}>
              <T bold>{TYPE_LABEL[tr.type]}{tr.quantity !== null ? <T tone="muted" size={13}> · {formatQty(tr.quantity)}{tr.priceMinor !== null ? ` × ${formatUnitPrice(tr.priceMinor, cur)}` : ""}</T> : null}</T>
              {(tr.note || tr.feeMinor || (tr.type === "buy" && !tr.includeInAvg)) ? <T tone="muted" size={12} numberOfLines={1}>{[tr.note, tr.feeMinor ? `fee ${formatMoney(tr.feeMinor, cur)}` : null, tr.type === "buy" && !tr.includeInAvg ? "not in average" : null].filter(Boolean).join(" · ")}</T> : null}
              {tr.type === "buy" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <Switch value={tr.includeInAvg} disabled={a.archived || toggleAvg.isPending} onValueChange={(on) => act(() => toggleAvg.mutateAsync({ tradeId: tr.id, on }))} accessibilityLabel={`Use the buy of ${tr.tradedOn} for the average price`} />
                  <T tone="muted" size={12}>Use for average</T>
                </View>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <T bold tone={tr.type === "bonus" ? "muted" : isInflow(tr.type) ? "income" : "fg"}>{tr.type === "bonus" ? "free" : `${isInflow(tr.type) ? "+" : "−"}${formatMoney(tr.amountMinor, cur)}`}</T>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Button small variant="ghost" title="Edit" disabled={a.archived} onPress={() => router.push({ pathname: "/trade", params: { assetId: a.id, tradeId: tr.id } })} testID={`edit-${tr.id}`} />
                <Button small variant="danger" title="Delete" disabled={a.archived || (deleting !== null && deleting !== tr.id)} loading={deleting === tr.id} onPress={() => deleteTrade(tr)} testID={`delete-${tr.id}`} />
              </View>
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 12 }}>
        {units && (
          <View style={{ gap: 6 }}>
            <T tone="muted" size={13} bold>Cost method</T>
            <ChipRow>{([["wavg", "Weighted average"], ["fifo", "FIFO"], ["manual", "Selected buys"]] as [CostMethod, string][]).map(([v, l]) => <Chip key={v} label={l} selected={a.costMethod === v} onPress={() => act(() => patch.mutateAsync({ costMethod: v }))} />)}</ChipRow>
          </View>
        )}
        <CurrencyPicker label="Currency" value={a.currency} onChange={async (next) => {
          if (next === a.currency) return;
          if (await confirmAsync(`Use ${next} for ${a.symbol}?`, `This only changes the label from ${a.currency} to ${next}: every amount and price stays the number you entered. Use it when the asset was recorded in the wrong currency.`, `Use ${next}`)) await act(() => patch.mutateAsync({ currency: next }));
        }} />
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
