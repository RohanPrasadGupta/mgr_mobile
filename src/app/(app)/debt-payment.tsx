import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { call, client } from "@/api/client";
import { invalidateDebts, useDebt, useMutate } from "@/api/hooks";
import { Button, ErrorText, Field, Screen, T } from "@/components/ui";
import { goBack } from "@/lib/nav";
import { formatMoney, isDate, parseAmount, toMajor, toMinor, todayLocal } from "@/lib/money";

export default function DebtPayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useDebt(id).data?.debt;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { if (d) setAmount((a) => a || String(toMajor(d.outstandingMinor, d.currency))); }, [d]);
  const save = useMutate(() => {
    const amountMinor = toMinor(parseAmount(amount), d!.currency);
    if (!(amountMinor > 0)) throw new Error("Enter an amount greater than 0");
    if (!isDate(date)) throw new Error("Enter the date as YYYY-MM-DD");
    return call(client.POST("/debts/{id}/payments", { params: { path: { id } }, body: { amountMinor, paidOn: date, note: note.trim() || undefined } }));
  }, invalidateDebts, "Repayment recorded");
  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }
  return (
    <Screen edges={["bottom"]}>
      {d && <T tone="muted">{d.counterparty} · outstanding <T bold>{formatMoney(d.outstandingMinor, d.currency)}</T></T>}
      <Field label={`Amount${d ? ` (${d.currency})` : ""}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />
      <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Note" value={note} onChangeText={setNote} maxLength={300} placeholder="Optional" />
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} disabled={!d} />
    </Screen>
  );
}
