import { useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { useCurrencies, useMe, useMutate } from "@/api/hooks";
import { CurrencyPicker } from "./currency-picker";
import { Button, Card, ErrorText, T } from "./ui";

/** The currencies offered first in every picker. The base currency stays in the list. */
export function MyCurrencies() {
  const me = useMe();
  const all = useCurrencies();
  const save = useMutate((currencies: string[]) => call(client.PATCH("/me", { body: { currencies } })), (q) => q.invalidateQueries({ queryKey: ["me"] }), "Currencies updated");
  const [error, setError] = useState<unknown>(null);
  if (!me.data) return null;
  const list = me.data.currencies;
  const names = new Map((all.data ?? []).map((c) => [c.code, c.name]));
  const set = async (next: string[]) => { setError(null); try { await save.mutateAsync(next); } catch (e) { setError(e); } };
  return (
    <Card style={{ gap: 10 }}>
      <T bold>My currencies</T>
      <T tone="muted" size={13}>Shown first whenever you pick a currency. Using another currency adds it here automatically.</T>
      <View style={{ gap: 6 }}>
        {list.map((code) => (
          <View key={code} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <T bold style={{ width: 44 }}>{code}</T>
            <T tone="muted" style={{ flex: 1 }} numberOfLines={1}>{names.get(code) ?? ""}</T>
            {code === me.data!.baseCurrency ? <T tone="muted" size={12}>base</T> : <Button small variant="ghost" title={`Remove ${code}`} onPress={() => set(list.filter((c) => c !== code))} disabled={save.isPending} />}
          </View>
        ))}
      </View>
      <CurrencyPicker label="Add a currency" value="" onChange={(code) => set([...list, code])} exclude={list} mineOnly />
      <ErrorText error={error} />
    </Card>
  );
}
