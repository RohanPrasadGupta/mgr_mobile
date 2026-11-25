import { useState } from "react";
import { View } from "react-native";
import { usePortfolioHistory } from "@/api/hooks";
import { formatMoney } from "@/lib/money";
import { useTheme } from "@/theme/theme";
import { BarChart } from "./charts";
import { Card, ErrorText, FadeIn, Segmented, Skeleton, T } from "./ui";

const RANGES = [{ value: "6", label: "6M" }, { value: "12", label: "1Y" }, { value: "36", label: "3Y" }, { value: "60", label: "5Y" }] as const;
type Range = (typeof RANGES)[number]["value"];
const MONTH = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_LONG = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Portfolio value vs money still invested, month by month, from the user's own trades and the prices they entered. */
export function PortfolioChart() {
  const t = useTheme();
  const [range, setRange] = useState<Range>("12");
  const q = usePortfolioHistory(Number(range));
  const h = q.data;
  const pts = h?.points ?? [];
  const cur = h?.baseCurrency ?? "THB";
  // Growth in value is mostly new money, so the headline is the gain over what is still invested (today's point).
  const last = pts[pts.length - 1];
  const gain = last ? last.valueMinor - last.investedMinor : 0;
  const gainPct = last && last.investedMinor > 0 ? (gain / last.investedMinor) * 100 : null;
  const label = (d: string, long = false) => { const [y, m] = d.split("-"); return long ? `${MONTH_LONG[Number(m) - 1]} ${y}` : pts.length > 13 ? `${MONTH[Number(m) - 1]}${y!.slice(2)}` : MONTH_LONG[Number(m) - 1]!.slice(0, 3); };
  return (
    <FadeIn>
      <Card style={{ gap: 10 }}>
        <T bold>Portfolio value</T>
        <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
        {q.isPending ? <Skeleton height={150} /> : q.error ? <ErrorText error={q.error} onRetry={() => void q.refetch()} /> : pts.length < 2 ? (
          <T tone="muted" style={{ textAlign: "center", paddingVertical: 24 }}>{pts.length === 0 ? "Record a trade or contribution to start the history." : "The chart appears once there are two months of history."}</T>
        ) : (
          <View style={{ gap: 8, opacity: q.isPlaceholderData ? 0.5 : 1 }}>
            {gainPct !== null && <T tone="muted" size={12}>Now <T size={12} bold tone={gain >= 0 ? "income" : "expense"}>{formatMoney(gain, cur, { sign: true })} ({gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)</T> {gain >= 0 ? "above" : "below"} what you’ve put in</T>}
            <BarChart labels={pts.map((p) => label(p.date))} format={(v) => formatMoney(v, cur)}
              series={[{ name: "Value", values: pts.map((p) => p.valueMinor), color: t.primary }, { name: "Invested", values: pts.map((p) => p.investedMinor), color: t.muted }]} />
            <T tone="muted" size={11}>From your trades and the prices you enter (no market data). Holdings without a price count at cost.{h!.excluded.length > 0 ? ` Not included: ${h!.excluded.map((e) => e.symbol).join(", ")} (no exchange rate).` : ""}</T>
          </View>
        )}
      </Card>
    </FadeIn>
  );
}
