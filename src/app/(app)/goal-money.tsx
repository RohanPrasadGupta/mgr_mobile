import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { call, client } from "@/api/client";
import { invalidateGoals, useGoal, useMutate } from "@/api/hooks";
import { Button, ErrorText, Field, Screen, Segmented, T } from "@/components/ui";
import { goBack } from "@/lib/nav";
import { formatMoney, isDate, parseAmount, toMinor, todayLocal } from "@/lib/money";

export default function GoalMoney() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = useGoal(id).data?.goal;
  const [dir, setDir] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const save = useMutate(() => {
    const minor = toMinor(parseAmount(amount), g!.currency);
    if (!(minor > 0)) throw new Error("Enter an amount greater than 0");
    if (!isDate(date)) throw new Error("Enter the date as YYYY-MM-DD");
    return call(client.POST("/goals/{id}/contributions", { params: { path: { id } }, body: { amountMinor: dir === "add" ? minor : -minor, occurredOn: date, note: note.trim() || undefined } }));
  }, invalidateGoals, dir === "add" ? "Saved toward your goal" : "Withdrawal recorded");
  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }
  return (
    <Screen edges={["bottom"]}>
      {g && <T tone="muted">{g.name}: {formatMoney(g.savedMinor, g.currency)} of {formatMoney(g.targetMinor, g.currency)}</T>}
      <Segmented value={dir} onChange={setDir} options={[{ value: "add", label: "Add", tone: "income" }, { value: "withdraw", label: "Take out", tone: "expense" }]} />
      <Field label={`Amount${g ? ` (${g.currency})` : ""}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" autoFocus />
      <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Note" value={note} onChangeText={setNote} maxLength={300} placeholder="Optional" />
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} disabled={!g} />
    </Screen>
  );
}
