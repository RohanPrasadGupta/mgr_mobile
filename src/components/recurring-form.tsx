import { goBack } from "@/lib/nav";
import { useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateLedger, invalidateRecurring, useAccounts, useCategories, useMutate } from "@/api/hooks";
import type { Body, Frequency, RecurringRule } from "@/api/types";
import { parseAmount, toMajor, toMinor, todayLocal } from "@/lib/money";
import { Button, Chip, ChipRow, ErrorText, Field, Screen, T } from "./ui";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FREQ: [Frequency, string][] = [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]];
const refresh = (qc: import("@tanstack/react-query").QueryClient) => Promise.all([invalidateRecurring(qc), invalidateLedger(qc)]);

export function RecurringForm({ rule }: { rule?: RecurringRule }) {
  const accounts = useAccounts();
  const cats = useCategories();
  const edit = !!rule;
  const [kind, setKind] = useState<"income" | "expense">(rule?.kind ?? "expense");
  const [accountId, setAccountId] = useState(rule?.accountId ?? "");
  const account = accounts.data?.find((a) => a.id === (rule?.accountId ?? accountId)) ?? accounts.data?.find((a) => !a.archived);
  const [amount, setAmount] = useState(rule ? String(toMajor(rule.amountMinor, account?.currency ?? "THB")) : "");
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [note, setNote] = useState(rule?.note ?? "");
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? "monthly");
  const [interval, setInterval] = useState(String(rule?.interval ?? 1));
  const [startOn, setStartOn] = useState(todayLocal());
  const [endOn, setEndOn] = useState(rule?.endOn ?? "");
  const [backfill, setBackfill] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pastStart = !edit && DATE_RE.test(startOn) && startOn < todayLocal();

  const save = useMutate(async () => {
    const cur = account?.currency ?? "THB";
    const amountMinor = toMinor(parseAmount(amount), cur);
    if (!(amountMinor > 0)) throw new Error("Enter an amount greater than 0");
    const every = Math.round(parseAmount(interval));
    if (!(every >= 1 && every <= 365)) throw new Error("“Every” must be between 1 and 365");
    if (endOn && !DATE_RE.test(endOn)) throw new Error("Enter the end date as YYYY-MM-DD, or leave it empty");
    if (rule) {
      const body: Body<"/recurring/{id}", "patch"> = { amountMinor, categoryId: categoryId || null, note: note.trim() || null, frequency, interval: every, endOn: endOn || null };
      return call(client.PATCH("/recurring/{id}", { params: { path: { id: rule.id } }, body }));
    }
    if (!account) throw new Error("Choose an account");
    if (!DATE_RE.test(startOn)) throw new Error("Enter the start date as YYYY-MM-DD");
    return call(client.POST("/recurring", { body: { accountId: account.id, kind, amountMinor, categoryId: categoryId || undefined, note: note.trim() || undefined, frequency, interval: every, startOn, endOn: endOn || undefined, backfill } }));
  }, refresh, rule ? "Rule updated" : "Rule added");

  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }
  const k = rule?.kind ?? kind;

  return (
    <Screen edges={["bottom"]}>
      {!edit && <ChipRow wrap><Chip label="Expense" tone="expense" selected={kind === "expense"} onPress={() => { setKind("expense"); setCategoryId(""); }} /><Chip label="Income" tone="income" selected={kind === "income"} onPress={() => { setKind("income"); setCategoryId(""); }} /></ChipRow>}
      {!edit && <View style={{ gap: 6 }}><T tone="muted" size={13} bold>Account</T><ChipRow>{accounts.data?.filter((a) => !a.archived).map((a) => <Chip key={a.id} label={`${a.name} (${a.currency})`} selected={a.id === account?.id} onPress={() => setAccountId(a.id)} />)}</ChipRow></View>}
      <Field label={`Amount (${account?.currency ?? "THB"})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />
      <View style={{ gap: 6 }}><T tone="muted" size={13} bold>Category</T><ChipRow wrap><Chip label="None" selected={!categoryId} onPress={() => setCategoryId("")} />{cats.data?.filter((c) => c.kind === k && !c.archived).map((c) => <Chip key={c.id} label={`${c.icon ? `${c.icon} ` : ""}${c.name}`} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />)}</ChipRow></View>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. Rent, Netflix" maxLength={500} />
      <View style={{ gap: 6 }}><T tone="muted" size={13} bold>Repeats</T><ChipRow>{FREQ.map(([v, l]) => <Chip key={v} label={l} selected={frequency === v} onPress={() => setFrequency(v)} />)}</ChipRow></View>
      <Field label="Every" value={interval} onChangeText={setInterval} keyboardType="number-pad" hint="1 = every period" />
      {!edit && <Field label="Start date" value={startOn} onChangeText={setStartOn} placeholder="YYYY-MM-DD" autoCapitalize="none" />}
      <Field label="End date" value={endOn} onChangeText={setEndOn} placeholder="YYYY-MM-DD" autoCapitalize="none" hint="Optional" />
      {pastStart && <View style={{ gap: 4 }}><ChipRow><Chip label="Also record the missed dates since the start date" selected={backfill} onPress={() => setBackfill((v) => !v)} /></ChipRow><T tone="muted" size={12}>Otherwise it starts from the next upcoming date.</T></View>}
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
