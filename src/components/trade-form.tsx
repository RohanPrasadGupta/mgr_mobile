import { goBack } from "@/lib/nav";
import { useState } from "react";
import { Switch, View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateInvestments, useMutate } from "@/api/hooks";
import type { Body, Holding, Trade, TradeType } from "@/api/types";
import { TYPES_FOR } from "@/lib/investments";
import { formatMoney, minorUnit, parseAmount, toMajor, toMinor, todayLocal } from "@/lib/money";
import { newId } from "./transaction-form";
import { Button, ErrorText, Field, RadioGroup, Screen, T } from "./ui";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function TradeForm({ holding, trade }: { holding: Holding; trade?: Trade }) {
  const a = holding.asset;
  const unit = 10 ** minorUnit(a.currency);
  const options = TYPES_FOR[a.tracking];
  const [type, setType] = useState<TradeType>(trade?.type ?? options[0]!.value);
  const [qty, setQty] = useState(trade?.quantity != null ? String(trade.quantity) : "");
  const [price, setPrice] = useState(trade?.priceMinor != null ? String(trade.priceMinor / unit) : "");
  const [amount, setAmount] = useState(trade ? String(toMajor(trade.amountMinor, a.currency)) : "");
  const [fee, setFee] = useState(trade?.feeMinor ? String(toMajor(trade.feeMinor, a.currency)) : "");
  const [date, setDate] = useState(trade?.tradedOn ?? todayLocal());
  const [note, setNote] = useState(trade?.note ?? "");
  const [inAvg, setInAvg] = useState(trade?.includeInAvg ?? true);
  const [error, setError] = useState<unknown>(null);

  const qtyType = type === "buy" || type === "sell" || type === "bonus";
  const priced = type === "buy" || type === "sell";
  const total = priced && parseAmount(qty) > 0 && parseAmount(price) > 0 ? Math.round(parseAmount(qty) * parseAmount(price) * unit) : null;

  const save = useMutate(async () => {
    if (!DATE_RE.test(date)) throw new Error("Enter the date as YYYY-MM-DD");
    const body: Body<"/investments/trades/{id}", "patch"> = { tradedOn: date, note: note || null, feeMinor: fee ? toMinor(parseAmount(fee) || 0, a.currency) : 0 };
    if (qtyType) { if (!(parseAmount(qty) > 0)) throw new Error("Enter a quantity greater than 0"); body.quantity = parseAmount(qty); }
    if (priced) { if (!(parseAmount(price) > 0)) throw new Error("Enter a price greater than 0"); body.priceMinor = Number((parseAmount(price) * unit).toFixed(6)); }
    if (!qtyType) { if (!(parseAmount(amount) > 0)) throw new Error("Enter an amount greater than 0"); body.amountMinor = toMinor(parseAmount(amount), a.currency); }
    if (type === "buy") body.includeInAvg = inAvg;
    if (trade && type !== trade.type) body.type = type;
    return trade
      ? call(client.PATCH("/investments/trades/{id}", { params: { path: { id: trade.id } }, body }))
      : call(client.POST("/investments/trades", { body: { ...body, note: note || undefined, assetId: a.id, type, clientId: newId() } }));
  }, invalidateInvestments, trade ? "Entry updated" : "Entry added");
  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }
  /** Switching between kinds keeps what still applies: a buy turned into a dividend starts from the buy's total. */
  function pickType(next: TradeType) {
    const nextQty = next === "buy" || next === "sell" || next === "bonus";
    if (!nextQty && !amount && total !== null) setAmount(String(toMajor(total, a.currency)));
    setType(next);
  }

  return (
    <Screen edges={["bottom"]}>
      <T tone="muted">{a.symbol} · {a.name}</T>
      <RadioGroup label="Type" options={options} value={type} onChange={pickType} />
      {qtyType && <Field label="Quantity" value={qty} onChangeText={setQty} keyboardType="decimal-pad" autoFocus />}
      {priced && <Field label={`Price per unit (${a.currency})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" hint={total === null ? undefined : `Total ${formatMoney(total, a.currency)}`} />}
      {!qtyType && <Field label={`Amount (${a.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />}
      {type !== "bonus" && type !== "fee" && <Field label={`Fee / charge (${a.currency})`} value={fee} onChangeText={setFee} keyboardType="decimal-pad" hint="Optional" />}
      <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" maxLength={500} />
      {type === "buy" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}><T>Use for average price</T><T tone="muted" size={12}>Off: still counts toward cost and P/L, but not the average price shown.</T></View>
          <Switch value={inAvg} onValueChange={setInAvg} accessibilityLabel="Use for average price" />
        </View>
      )}
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
