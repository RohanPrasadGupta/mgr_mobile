import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateGoals, useAccounts, useGoal, useMe, useMutate } from "@/api/hooks";
import { Button, Chip, ChipRow, ErrorText, Field, Screen, Skeleton, T } from "@/components/ui";
import { goBack } from "@/lib/nav";
import { isDate, parseAmount, toMajor, toMinor } from "@/lib/money";

export default function GoalForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useGoal(id);
  const me = useMe();
  const accounts = useAccounts();
  const edit = existing.data?.goal;
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [icon, setIcon] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!edit) return;
    setName(edit.name); setTarget(String(toMajor(edit.targetMinor, edit.currency))); setDate(edit.targetDate ?? ""); setIcon(edit.icon ?? ""); setNote(edit.note ?? "");
  }, [edit]);
  const acct = accounts.data?.find((a) => a.id === accountId);
  const currency = edit?.currency ?? acct?.currency ?? me.data?.baseCurrency ?? "THB";

  const save = useMutate(async () => {
    if (!name.trim()) throw new Error("Give the goal a name");
    const targetMinor = toMinor(parseAmount(target), currency);
    if (!(targetMinor > 0)) throw new Error("Enter a target greater than 0");
    if (date && !isDate(date)) throw new Error("Enter the target date as YYYY-MM-DD");
    if (edit) return call(client.PATCH("/goals/{id}", { params: { path: { id: edit.id } }, body: { name: name.trim(), targetMinor, targetDate: date || null, icon: icon.trim() || null, note: note.trim() || null } }));
    return call(client.POST("/goals", { body: { name: name.trim(), targetMinor, targetDate: date || undefined, icon: icon.trim() || undefined, note: note.trim() || undefined, accountId: accountId || undefined } }));
  }, invalidateGoals, edit ? "Goal updated" : "Goal created");

  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }
  if (id && existing.isPending) return <Screen edges={["bottom"]}><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></Screen>;
  return (
    <Screen edges={["bottom"]}>
      <Field label="Name" value={name} onChangeText={setName} maxLength={60} placeholder="e.g. Emergency fund" autoFocus={!id} />
      <Field label={`Target (${currency})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" />
      <Field label="Target date (optional)" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      {!edit && (
        <View style={{ gap: 6 }}>
          <T tone="muted" size={13} bold>Track an account (optional)</T>
          <ChipRow wrap>
            <Chip label="No — I'll add money" selected={!accountId} onPress={() => setAccountId("")} />
            {accounts.data?.filter((a) => !a.archived).map((a) => <Chip key={a.id} label={`${a.name} (${a.currency})`} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />)}
          </ChipRow>
          <T tone="muted" size={12}>Progress follows that account’s balance instead of money you add by hand.</T>
        </View>
      )}
      <Field label="Icon" value={icon} onChangeText={setIcon} maxLength={8} placeholder="🎯" />
      <Field label="Note" value={note} onChangeText={setNote} maxLength={1000} placeholder="Optional" />
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
