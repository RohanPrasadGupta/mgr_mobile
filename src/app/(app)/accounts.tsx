import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { useAccounts, useMe, useMutate } from "@/api/hooks";
import type { Account, AccountType, Body } from "@/api/types";
import { Button, Card, Chip, ChipRow, Empty, ErrorText, Field, Screen, T, confirmAsync } from "@/components/ui";
import { formatMoney, parseAmount, toMinor } from "@/lib/money";
import { CurrencyPicker } from "@/components/currency-picker";

const TYPES: AccountType[] = ["cash", "bank", "wallet", "card", "loan", "investment"];
const refresh = (qc: import("@tanstack/react-query").QueryClient) => qc.invalidateQueries({ queryKey: ["accounts"] });

export default function Accounts() {
  const accounts = useAccounts();
  const me = useMe();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [currency, setCurrency] = useState("");
  const [opening, setOpening] = useState("");
  const [error, setError] = useState<unknown>(null);
  const create = useMutate((body: Body<"/accounts", "post">) => call(client.POST("/accounts", { body })), async (qc) => { await refresh(qc); await qc.invalidateQueries({ queryKey: ["me"] }); }, "Account added");
  const update = useMutate(({ id, archived }: { id: string; archived: boolean }) => call(client.PATCH("/accounts/{id}", { params: { path: { id } }, body: { archived } })), refresh, "Account updated");
  const remove = useMutate((id: string) => call(client.DELETE("/accounts/{id}", { params: { path: { id } } })), refresh, "Account deleted");
  const cur = currency || me.data?.baseCurrency || "THB";

  async function add() {
    setError(null);
    if (!name.trim()) return setError(new Error("Give the account a name"));
    try {
      await create.mutateAsync({ name: name.trim(), type, currency: cur, openingBalanceMinor: opening ? toMinor(parseAmount(opening) || 0, cur) : 0 });
      setAdding(false); setName(""); setOpening("");
    } catch (e) { setError(e); }
  }
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); } catch (e) { setError(e); } };

  return (
    <Screen>
      <ErrorText error={accounts.error ?? error} />
      {accounts.data?.length === 0 && <Empty>No accounts yet.</Empty>}
      {accounts.data?.map((a: Account) => (
        <Card key={a.id} style={{ gap: 8, opacity: a.archived ? 0.6 : 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View><T bold>{a.name}</T><T tone="muted" size={12}>{a.type} · {a.currency}{a.archived ? " · archived" : ""}</T></View>
            <T bold tone={a.balanceMinor < 0 ? "expense" : "fg"}>{formatMoney(a.balanceMinor, a.currency)}</T>
          </View>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {!a.archived && <T tone="muted" size={13} style={{ textDecorationLine: "underline" }} onPress={() => router.push({ pathname: "/transfer-new", params: { from: a.id } })}>Transfer</T>}
            <T tone="muted" size={13} style={{ textDecorationLine: "underline" }} onPress={() => act(() => update.mutateAsync({ id: a.id, archived: !a.archived }))}>{a.archived ? "Unarchive" : "Archive"}</T>
            <T tone="muted" size={13} style={{ textDecorationLine: "underline" }} onPress={async () => { if (await confirmAsync(`Delete "${a.name}"?`, "Accounts that have transactions can only be archived.")) await act(() => remove.mutateAsync(a.id)); }}>Delete</T>
          </View>
        </Card>
      ))}
      {adding ? (
        <Card style={{ gap: 14 }}>
          <T bold>New account</T>
          <Field label="Name" value={name} onChangeText={setName} autoFocus />
          <ChipRow>{TYPES.map((x) => <Chip key={x} label={x} selected={type === x} onPress={() => setType(x)} />)}</ChipRow>
          <CurrencyPicker value={cur} onChange={setCurrency} />
          <Field label="Opening balance" value={opening} onChangeText={setOpening} keyboardType="decimal-pad" placeholder="0.00" />
          <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} /></View><View style={{ flex: 1 }}><Button title="Add" onPress={add} loading={create.isPending} /></View></View>
        </Card>
      ) : <Button title="+ Add account" onPress={() => setAdding(true)} />}
    </Screen>
  );
}
