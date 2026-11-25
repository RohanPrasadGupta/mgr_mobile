import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { useMe } from "@/api/hooks";
import { Card, ErrorText, Field, ProgressBar, Screen, T } from "@/components/ui";
import { formatMoney, parseAmount, toMinor } from "@/lib/money";
import { useTheme } from "@/theme/theme";

export default function Sip() {
  const t = useTheme();
  const me = useMe();
  const cur = me.data?.baseCurrency ?? "THB";
  const [monthly, setMonthly] = useState("5000");
  const [rate, setRate] = useState("12");
  const [years, setYears] = useState("10");
  const [debounced, setDebounced] = useState({ monthly, rate, years });
  useEffect(() => { const id = setTimeout(() => setDebounced({ monthly, rate, years }), 300); return () => clearTimeout(id); }, [monthly, rate, years]);

  const m = parseAmount(debounced.monthly), r = parseAmount(debounced.rate), y = parseAmount(debounced.years);
  const valid = m > 0 && r >= 0 && r <= 100 && y > 0 && y <= 80;
  const calc = useQuery({ queryKey: ["calc", "sip", m, r, y], enabled: valid, staleTime: Infinity, queryFn: async () => (await call(client.POST("/calc/sip", { body: { monthly: m, annualRatePct: r, years: y } }))).data });
  const money = (v: number) => formatMoney(toMinor(v, cur), cur);
  const d = calc.data;
  const max = d ? Math.max(1, ...d.yearlyBreakdown.map((x) => x.total)) : 1;

  return (
    <Screen>
      <T tone="muted" size={13}>Projects a monthly investment growing at a fixed annual return, each instalment invested at the start of the month.</T>
      <Card style={{ gap: 12 }}>
        <Field label={`Monthly amount (${cur})`} value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" />
        <Field label="Expected return (% per year)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
        <Field label="Years" value={years} onChangeText={setYears} keyboardType="decimal-pad" />
      </Card>
      {!valid ? <T tone="muted">Enter a monthly amount above 0, a rate between 0 and 100, and 1–80 years.</T> : <ErrorText error={calc.error} />}
      {d && valid && (
        <>
          <Card><T tone="muted" size={12}>Total invested</T><T bold size={20}>{money(d.totalInvested)}</T></Card>
          <Card><T tone="muted" size={12}>Estimated returns</T><T bold size={20} tone="income">{money(d.estimatedReturns)}</T></Card>
          <Card><T tone="muted" size={12}>Maturity value</T><T bold size={20}>{money(d.maturityValue)}</T></Card>
          <Card style={{ gap: 8 }}>
            <T bold>By year</T>
            {d.yearlyBreakdown.map((row) => (
              <View key={row.year} style={{ gap: 3 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}><T size={13}>Year {row.year}</T><T tone="muted" size={12}>{money(row.total)}</T></View>
                <ProgressBar pct={(row.total / max) * 100} color={t.income} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
