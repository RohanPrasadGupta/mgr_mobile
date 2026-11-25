import { goBack } from "@/lib/nav";
import { useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { useCategories, useMe, useMutate } from "@/api/hooks";
import type { BudgetPeriod } from "@/api/types";
import { Button, Chip, ChipRow, ErrorText, Field, Screen, T } from "@/components/ui";
import { parseAmount, toMinor } from "@/lib/money";

export default function NewBudget() {
  const me = useMe();
  const cats = useCategories();
  const base = me.data?.baseCurrency ?? "THB";
  const [categoryId, setCategoryId] = useState("");
  const [period, setPeriod] = useState<Exclude<BudgetPeriod, "custom">>("month");
  const [amount, setAmount] = useState("");
  const [threshold, setThreshold] = useState("80");
  const [error, setError] = useState<unknown>(null);
  const save = useMutate(() => call(client.POST("/budgets", { body: { categoryId: categoryId || undefined, period, amountMinor: toMinor(parseAmount(amount), base), alertThresholdPct: Number(threshold) || 80 } })), (qc) => qc.invalidateQueries({ queryKey: ["budgets"] }), "Budget added");

  async function submit() {
    setError(null);
    if (!(parseAmount(amount) > 0)) return setError(new Error("Enter a limit greater than 0"));
    try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); }
  }
  return (
    <Screen edges={["bottom"]}>
      <View style={{ gap: 6 }}>
        <T tone="muted" size={13} bold>Category</T>
        <ChipRow wrap>
          <Chip label="All expenses" selected={!categoryId} onPress={() => setCategoryId("")} />
          {cats.data?.filter((c) => c.kind === "expense" && !c.archived).map((c) => <Chip key={c.id} label={`${c.icon ? `${c.icon} ` : ""}${c.name}`} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
        </ChipRow>
      </View>
      <ChipRow><Chip label="Monthly" selected={period === "month"} onPress={() => setPeriod("month")} /><Chip label="Weekly" selected={period === "week"} onPress={() => setPeriod("week")} /></ChipRow>
      <Field label={`Limit (${base})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />
      <Field label="Warn me at (% used)" value={threshold} onChangeText={setThreshold} keyboardType="number-pad" />
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
