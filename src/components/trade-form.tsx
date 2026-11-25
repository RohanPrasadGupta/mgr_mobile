import { goBack } from "@/lib/nav";
import { useState } from "react";
import { call, client } from "@/api/client";
import { invalidateInvestments, useMutate } from "@/api/hooks";
import type { Body, Holding, Trade, TradeType } from "@/api/types";
import { TYPES_FOR, TYPE_LABEL } from "@/lib/investments";
import { formatMoney, minorUnit, parseAmount, toMajor, toMinor, todayLocal } from "@/lib/money";
import { newId } from "./transaction-form";
import { Button, Chip, ChipRow, ErrorText, Field, Screen, T, confirmAsync } from "./ui";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function TradeForm({ holding, trade }: { holding: Holding; trade?: Trade }) {
  const a = holding.asset;
  const units = a.tracking === "units";
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
    if (a.costMethod === "manual" && type === "buy") body.includeInAvg = inAvg;
    return trade
      ? call(client.PATCH("/investments/trades/{id}", { params: { path: { id: trade.id } }, body }))
      : call(client.POST("/investments/trades", { body: { ...body, note: note || undefined, assetId: a.id, type, clientId: newId() } }));
  }, invalidateInvestments, trade ? "Entry updated" : "Entry added");
  const del = useMutate(() => call(client.DELETE("/investments/trades/{id}", { params: { path: { id: trade!.id } } })), invalidateInvestments, "Entry deleted");

  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }
  async function remove() {
    if (!(await confirmAsync("Delete this entry?", "This cannot be undone."))) return;
    setError(null);
    try { await del.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); }
  }

  return (
    <Screen edges={["bottom"]}>
      <T tone="muted">{a.symbol} · {a.name}</T>
      {!trade && <ChipRow wrap>{options.map((o) => <Chip key={o.value} label={o.label} selected={type === o.value} onPress={() => setType(o.value)} />)}</ChipRow>}
      {trade && <T bold>{TYPE_LABEL[trade.type]}</T>}
      {qtyType && <Field label="Quantity" value={qty} onChangeText={setQty} keyboardType="decimal-pad" autoFocus />}
      {priced && <Field label={`Price per unit (${a.currency})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" hint={total === null ? undefined : `Total ${formatMoney(total, a.currency)}`} />}
      {!qtyType && <Field label={`Amount (${a.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />}
      {type !== "bonus" && type !== "fee" && <Field label={`Fee / charge (${a.currency})`} value={fee} onChangeText={setFee} keyboardType="decimal-pad" hint="Optional" />}
      <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" maxLength={500} />
      {a.costMethod === "manual" && type === "buy" && <ChipRow><Chip label="Use this buy for the displayed average" selected={inAvg} onPress={() => setInAvg((v) => !v)} /></ChipRow>}
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
      {trade && <Button title="Delete" variant="danger" onPress={remove} loading={del.isPending} />}
    </Screen>
  );
}
