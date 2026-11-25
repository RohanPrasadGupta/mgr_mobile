import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateDebts, useCurrencies, useDebt, useMe, useMutate } from "@/api/hooks";
import { Button, Chip, ChipRow, ErrorText, Field, Screen, Segmented, Skeleton, T } from "@/components/ui";
import { goBack } from "@/lib/nav";
import { isDate, parseAmount, toMajor, toMinor, todayLocal } from "@/lib/money";

export default function DebtForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useDebt(id);
  const me = useMe();
  const currencies = useCurrencies();
  const edit = existing.data?.debt;
  const [direction, setDirection] = useState<"lent" | "borrowed">("lent");
  const [who, setWho] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [start, setStart] = useState(todayLocal());
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { if (edit) { setWho(edit.counterparty); setAmount(String(toMajor(edit.principalMinor, edit.currency))); setDue(edit.dueOn ?? ""); setNote(edit.note ?? ""); } }, [edit]);
  const cur = edit?.currency ?? (currency || me.data?.baseCurrency || "THB");

  const save = useMutate(async () => {
    if (!who.trim()) throw new Error("Enter who the debt is with");
    const principalMinor = toMinor(parseAmount(amount), cur);
    if (!(principalMinor > 0)) throw new Error("Enter an amount greater than 0");
    if (due && !isDate(due)) throw new Error("Enter the due date as YYYY-MM-DD");
    if (edit) return call(client.PATCH("/debts/{id}", { params: { path: { id: edit.id } }, body: { counterparty: who.trim(), principalMinor, dueOn: due || null, note: note.trim() || null } }));
    if (!isDate(start)) throw new Error("Enter the start date as YYYY-MM-DD");
    return call(client.POST("/debts", { body: { direction, counterparty: who.trim(), principalMinor, currency: cur, startedOn: start, dueOn: due || undefined, note: note.trim() || undefined } }));
  }, invalidateDebts, edit ? "Debt updated" : "Debt recorded");
  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }

  if (id && existing.isPending) return <Screen edges={["bottom"]}><Skeleton height={44} /><Skeleton height={44} /></Screen>;
  return (
    <Screen edges={["bottom"]}>
      {!edit && <Segmented value={direction} onChange={setDirection} options={[{ value: "lent", label: "I lent", tone: "income" }, { value: "borrowed", label: "I borrowed", tone: "expense" }]} />}
      <Field label={edit ? "Person or organisation" : direction === "lent" ? "Who owes you?" : "Who do you owe?"} value={who} onChangeText={setWho} maxLength={60} autoFocus={!id} />
      <Field label={`Amount (${cur})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      {!edit && (
        <View style={{ gap: 6 }}>
          <T tone="muted" size={13} bold>Currency</T>
          <ChipRow>{(currencies.data ?? [{ code: cur }]).map((c) => <Chip key={c.code} label={c.code} selected={cur === c.code} onPress={() => setCurrency(c.code)} />)}</ChipRow>
        </View>
      )}
      {!edit && <Field label="Since" value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" autoCapitalize="none" />}
      <Field label="Due (optional)" value={due} onChangeText={setDue} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Note" value={note} onChangeText={setNote} maxLength={1000} placeholder="Optional" />
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
