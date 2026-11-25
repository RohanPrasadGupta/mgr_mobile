import { goBack } from "@/lib/nav";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateLedger, useAccounts, useMe, useMutate } from "@/api/hooks";
import { formatMoney, parseAmount, toMinor, todayLocal } from "@/lib/money";
import { toInstant } from "./transaction-form";
import { Button, Chip, ChipRow, ErrorText, Field, Screen, T } from "./ui";
import { FxField } from "./fx-field";
import { rememberFxRate } from "@/lib/fx-memory";

export function TransferForm({ defaultFrom }: { defaultFrom?: string }) {
  const accounts = useAccounts();
  const me = useMe();
  const active = (accounts.data ?? []).filter((a) => !a.archived);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [fx, setFx] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);

  // pick sensible accounts once the list is available (it may load after the screen opens)
  useEffect(() => {
    if (active.length === 0) return;
    const valid = (id: string) => active.some((a) => a.id === id);
    const from = valid(fromId) ? fromId : defaultFrom && valid(defaultFrom) ? defaultFrom : active[0]!.id;
    if (from !== fromId) setFromId(from);
    if (!valid(toId) || toId === from) setToId(active.find((a) => a.id !== from)?.id ?? "");
  }, [active, fromId, toId, defaultFrom]);

  const from = active.find((a) => a.id === fromId);
  const to = active.find((a) => a.id === toId);
  const cross = !!from && !!to && from.currency !== to.currency;
  const base = me.data?.baseCurrency;
  // The API only accepts an explicit rate when exactly one side is non-base; otherwise it uses stored daily rates.
  const showFx = !!from && !!to && !!base && ((from.currency !== base) !== (to.currency !== base));
  const fxFrom = showFx ? (from!.currency !== base ? from!.currency : to!.currency) : undefined; // the non-base side
  const sent = parseAmount(amount);
  const recv = parseAmount(received);
  const implied = cross && sent > 0 && recv > 0 ? recv / sent : null;
  const short = !!from && sent > 0 && toMinor(sent, from.currency) > from.balanceMinor;

  const save = useMutate(async () => {
    if (!from || !to) throw new Error("Choose both accounts");
    if (from.id === to.id) throw new Error("Choose two different accounts");
    const amountMinor = toMinor(sent, from.currency);
    if (!(amountMinor > 0)) throw new Error("Enter an amount greater than 0");
    let toAmountMinor: number | undefined;
    if (cross) { toAmountMinor = toMinor(recv, to.currency); if (!(toAmountMinor > 0)) throw new Error(`Enter how much ${to.currency} arrives`); }
    const occurredAt = toInstant(date, "12:00");
    if (!occurredAt) throw new Error("Enter the date as YYYY-MM-DD");
    const rate = showFx && fx ? parseAmount(fx) : undefined;
    if (showFx && fx && !(rate! > 0)) throw new Error("Enter a valid exchange rate or leave it empty");
    if (rate) void rememberFxRate(fxFrom!, base!, rate);
    return call(client.POST("/transfers", { body: { fromAccountId: from.id, toAccountId: to.id, amountMinor, toAmountMinor, occurredAt, note: note.trim() || undefined, fxRate: rate } }));
  }, invalidateLedger, "Transfer done");

  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }

  if (accounts.data && active.length < 2) return <Screen><T tone="muted">You need at least two active accounts to transfer between them. Add another account first.</T></Screen>;
  const label = (a: (typeof active)[number]) => `${a.name} · ${formatMoney(a.balanceMinor, a.currency)}`;
  return (
    <Screen edges={["bottom"]}>
      <View style={{ gap: 6 }}><T tone="muted" size={13} bold>From</T><ChipRow>{active.map((a) => <Chip key={a.id} label={label(a)} selected={a.id === fromId} onPress={() => { setFromId(a.id); if (a.id === toId) setToId(active.find((x) => x.id !== a.id)?.id ?? ""); }} />)}</ChipRow></View>
      <View style={{ gap: 6 }}><T tone="muted" size={13} bold>To</T><ChipRow>{active.filter((a) => a.id !== fromId).map((a) => <Chip key={a.id} label={label(a)} selected={a.id === toId} onPress={() => setToId(a.id)} />)}</ChipRow></View>
      <Field label={`Amount sent${from ? ` (${from.currency})` : ""}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus hint={short ? "This is more than the account's current balance." : undefined} />
      {cross && <Field label={`Amount received (${to!.currency})`} value={received} onChangeText={setReceived} keyboardType="decimal-pad" hint={implied ? `Implied rate: 1 ${from!.currency} = ${implied.toFixed(4)} ${to!.currency}` : "Different currencies: enter what actually arrives."} />}
      {showFx && <FxField from={fxFrom!} to={base!} date={date} value={fx} onChange={setFx} amount={fxFrom === from!.currency ? sent : recv} />}
      <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" maxLength={500} />
      <ErrorText error={error} />
      <Button title="Transfer" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
