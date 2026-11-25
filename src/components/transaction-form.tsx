import { goBack } from "@/lib/nav";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { call, client, uploadAttachment, type LocalFile } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { AttachmentsPanel, PendingAttachments } from "./attachments";
import { TagPicker } from "./tag-picker";
import { FxField } from "./fx-field";
import { rememberFxRate } from "@/lib/fx-memory";
import { invalidateLedger, useAccounts, useCategories, useMe, useMutate } from "@/api/hooks";
import type { Body, Transaction } from "@/api/types";
import { formatMoney, pad, parseAmount, toMajor, toMinor, todayLocal } from "@/lib/money";
import { Button, Chip, ChipRow, ErrorText, Field, Screen, T, confirmAsync } from "./ui";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return todayLocal(d); };
const timeOf = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Combine a YYYY-MM-DD date and HH:mm time (device-local) into the ISO instant the API stores. Null if the date is not real. */
export function toInstant(date: string, time: string): string | null {
  if (!DATE_RE.test(date)) return null;
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime()) || todayLocal(d) !== date) return null; // rejects 2025-02-31 style rollovers
  return d.toISOString();
}

export function TransactionForm({ tx }: { tx?: Transaction }) {
  const accounts = useAccounts();
  const categories = useCategories();
  const me = useMe();
  const editing = !!tx;
  const transfer = tx?.kind === "transfer_in" || tx?.kind === "transfer_out";

  const [kind, setKind] = useState<"income" | "expense">(tx?.kind === "income" ? "income" : "expense");
  const [amount, setAmount] = useState(tx ? String(toMajor(tx.amountMinor, tx.currency)) : "");
  const [accountId, setAccountId] = useState(tx?.accountId ?? "");
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? "");
  const [date, setDate] = useState(tx?.occurredOn ?? todayLocal());
  const [note, setNote] = useState(tx?.note ?? "");
  const [fx, setFx] = useState("");
  const [tagIds, setTagIds] = useState<string[]>(tx?.tagIds ?? []);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [error, setError] = useState<unknown>(null);
  const qc = useQueryClient();

  useEffect(() => { if (!editing && !accountId) { const first = accounts.data?.find((a) => !a.archived)?.id; if (first) setAccountId(first); } }, [editing, accountId, accounts.data]);

  const account = accounts.data?.find((a) => a.id === (tx?.accountId ?? accountId));
  const cats = useMemo(() => (categories.data ?? []).filter((c) => c.kind === kind && !c.archived), [categories.data, kind]);
  const foreign = !editing && !!account && !!me.data && account.currency !== me.data.baseCurrency;

  const save = useMutate(async () => {
    const major = parseAmount(amount);
    const occurredAt = toInstant(date, editing ? timeOf(tx!.occurredAt) : timeOf(new Date().toISOString()));
    if (!occurredAt) throw new Error("Enter the date as YYYY-MM-DD");
    if (editing) {
      if (!transfer && !(major > 0)) throw new Error("Enter an amount greater than 0");
      const body: Body<"/transactions/{id}", "patch"> = { occurredAt, note: note || null, tagIds, ...(transfer ? {} : { amountMinor: toMinor(major, tx!.currency), categoryId: categoryId || null }) };
      return call(client.PATCH("/transactions/{id}", { params: { path: { id: tx!.id } }, body }));
    }
    if (!(major > 0)) throw new Error("Enter an amount greater than 0");
    if (!account) throw new Error("Choose an account");
    const rate = fx ? parseAmount(fx) : undefined;
    if (fx && !(rate! > 0)) throw new Error("Enter a valid exchange rate or leave it empty");
    if (rate && me.data) void rememberFxRate(account.currency, me.data.baseCurrency, rate);
    return call(client.POST("/transactions", { body: { accountId: account.id, kind, amountMinor: toMinor(major, account.currency), categoryId: categoryId || undefined, occurredAt, note: note || undefined, fxRate: rate, clientId: newId(), tagIds } }));
  }, invalidateLedger, editing ? (transfer ? "Transfer updated" : "Transaction updated") : "Transaction added");
  const del = useMutate(() => call(client.DELETE("/transactions/{id}", { params: { path: { id: tx!.id } } })), invalidateLedger, transfer ? "Transfer deleted" : "Transaction deleted");

  async function submit() {
    setError(null);
    let saved: unknown;
    try { saved = await save.mutateAsync(undefined as never); } catch (e) { setError(e); return; }
    // Photos picked before the transaction existed are uploaded now that it has an id.
    const id = (saved as { data?: { id?: string } } | undefined)?.data?.id;
    if (!editing && files.length && id) {
      for (const f of files) await uploadAttachment(id, f).catch((e) => toast.error(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`));
      void qc.invalidateQueries({ queryKey: ["transactions"] });
    }
    goBack();
  }
  async function remove() {
    if (!(await confirmAsync(transfer ? "Delete this transfer?" : "Delete this transaction?", transfer ? "Both sides of the transfer will be removed." : "This cannot be undone."))) return;
    setError(null);
    try { await del.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); }
  }

  return (
    <Screen edges={["bottom"]}>
      {!editing && (
        <ChipRow wrap>
          <Chip label="Expense" tone="expense" selected={kind === "expense"} onPress={() => { setKind("expense"); setCategoryId(""); }} />
          <Chip label="Income" tone="income" selected={kind === "income"} onPress={() => { setKind("income"); setCategoryId(""); }} />
        </ChipRow>
      )}
      {!transfer && <Field label={`Amount${account ? ` (${account.currency})` : ""}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" autoFocus={!editing} />}
      {!editing && (
        <View style={{ gap: 6 }}>
          <T tone="muted" size={13} bold>Account</T>
          <ChipRow>{accounts.data?.filter((a) => !a.archived).map((a) => <Chip key={a.id} label={`${a.name} · ${formatMoney(a.balanceMinor, a.currency)}`} selected={a.id === accountId} onPress={() => setAccountId(a.id)} />)}</ChipRow>
        </View>
      )}
      {foreign && <FxField from={account!.currency} to={me.data!.baseCurrency} date={date} value={fx} onChange={setFx} amount={parseAmount(amount)} />}
      {!transfer && (
        <View style={{ gap: 6 }}>
          <T tone="muted" size={13} bold>Category</T>
          <ChipRow wrap>
            <Chip label="None" selected={!categoryId} onPress={() => setCategoryId("")} />
            {cats.map((c) => <Chip key={c.id} label={`${c.icon ? `${c.icon} ` : ""}${c.name}`} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />)}
          </ChipRow>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
        <ChipRow><Chip label="Today" selected={date === todayLocal()} onPress={() => setDate(todayLocal())} /><Chip label="Yesterday" selected={date === yesterday()} onPress={() => setDate(yesterday())} /></ChipRow>
      </View>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" maxLength={500} />
      <TagPicker value={tagIds} onChange={setTagIds} />
      {editing ? <AttachmentsPanel transactionId={tx!.id} /> : <PendingAttachments files={files} onChange={setFiles} />}
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
      {editing && <Button title="Delete" variant="danger" onPress={remove} loading={del.isPending} />}
    </Screen>
  );
}

/** RFC 4122 v4 id for idempotent creates; crypto.randomUUID isn't available on every Hermes build. */
export function newId() {
  const g = globalThis.crypto as Crypto | undefined;
  if (g?.randomUUID) return g.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
}
