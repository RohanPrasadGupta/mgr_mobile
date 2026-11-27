import { goBack } from "@/lib/nav";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { call, client } from "@/api/client";
import { invalidateInvestments, useMe, useMutate } from "@/api/hooks";
import type { AssetClass, CostMethod } from "@/api/types";
import { Button, Chip, ChipRow, ErrorText, Field, Screen, T } from "@/components/ui";
import { CLASSES, CLASS_LABEL, defaultTracking } from "@/lib/investments";
import { CurrencyPicker } from "@/components/currency-picker";

export default function NewAsset() {
  const me = useMe();
  // opened from a board tab: that tab's class is already chosen
  const { cls: initial } = useLocalSearchParams<{ cls?: string }>();
  const [cls, setCls] = useState<AssetClass>(CLASSES.includes(initial as AssetClass) ? (initial as AssetClass) : "stock");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");
  const [method, setMethod] = useState<CostMethod>("wavg");
  const [error, setError] = useState<unknown>(null);
  const cur = currency || me.data?.baseCurrency || "THB";
  const units = defaultTracking(cls) === "units";
  const create = useMutate(() => call(client.POST("/investments/assets", { body: { symbol: symbol.trim(), name: name.trim(), class: cls, currency: cur, costMethod: units ? method : "wavg" } })), async (qc) => { await invalidateInvestments(qc); await qc.invalidateQueries({ queryKey: ["me"] }); }, "Asset added");

  async function submit() {
    setError(null);
    if (!symbol.trim() || !name.trim()) return setError(new Error("Enter a symbol and a name"));
    try { await create.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); }
  }
  return (
    <Screen edges={["bottom"]}>
      <T tone="muted" size={13} bold>Type</T>
      <ChipRow wrap>{CLASSES.map((c) => <Chip key={c} label={CLASS_LABEL[c]} selected={cls === c} onPress={() => setCls(c)} />)}</ChipRow>
      <Field label="Symbol / short name" value={symbol} onChangeText={setSymbol} autoCapitalize="characters" placeholder={units ? "e.g. ACME" : "e.g. GROWTH-SIP"} autoFocus />
      <Field label="Name" value={name} onChangeText={setName} placeholder={units ? "e.g. Acme Corporation" : "e.g. Example Growth Fund"} />
      <CurrencyPicker value={cur} onChange={setCurrency} />
      {units ? (
        <>
          <T tone="muted" size={13} bold>Cost method</T>
          <ChipRow>{([["wavg", "Weighted average"], ["fifo", "FIFO"], ["manual", "Selected buys"]] as [CostMethod, string][]).map(([v, l]) => <Chip key={v} label={l} selected={method === v} onPress={() => setMethod(v)} />)}</ChipRow>
        </>
      ) : <T tone="muted" size={13}>Tracked by value: you record contributions and withdrawals, and update the current total value yourself.</T>}
      <ErrorText error={error} />
      <Button title="Add asset" onPress={submit} loading={create.isPending} />
    </Screen>
  );
}
