import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme/theme";
import { T } from "./ui";

/** 0 → 1 once on mount (instantly when motion is reduced); bars multiply their height by it so they rise from the baseline. */
function useGrow(deps: unknown) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [deps, reduced, v]);
  return v;
}

export interface BarSeries { name: string; values: number[]; color: string }

/**
 * Grouped vertical bars (one group per label). Tap a group to read its exact values in the caption line;
 * every group is an accessible button with a full spoken summary.
 */
export function BarChart({ labels, series, format, height = 150, highlight }: { labels: string[]; series: BarSeries[]; format: (v: number) => string; height?: number; highlight?: number }) {
  const t = useTheme();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const grow = useGrow(labels.join() + series.map((s) => s.values.join()).join("|"));
  const every = Math.ceil(labels.length / 8);
  if (series.every((s) => s.values.every((v) => v === 0))) return <T tone="muted" style={{ textAlign: "center", paddingVertical: 24 }}>No data for this period.</T>;
  return (
    <View style={{ gap: 8 }}>
      <T tone="muted" size={12} numberOfLines={1}>{active !== null ? `${labels[active]} · ${series.map((s) => `${s.name} ${format(s.values[active]!)}`).join(" · ")}` : "Tap a bar for details"}</T>
      <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: labels.length > 20 ? 1 : 4, borderBottomWidth: 1, borderBottomColor: t.border }}>
        {labels.map((l, i) => (
          <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${l}: ${series.map((s) => `${s.name} ${format(s.values[i]!)}`).join(", ")}`} onPress={() => setActive(active === i ? null : i)}
            style={{ flex: 1, height: "100%", flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 1, opacity: active === null || active === i ? 1 : 0.4 }}>
            {series.map((s) => (
              <Animated.View key={s.name} style={{ flex: 1, maxWidth: 18, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: highlight === i ? t.primary : s.color, height: Animated.multiply(grow, Math.max(s.values[i]! > 0 ? 2 : 0, (s.values[i]! / max) * height)) }} />
            ))}
          </Pressable>
        ))}
      </View>
      {/* one label per `every` bars, each given the width of its whole group so two-digit days never clip */}
      <View style={{ flexDirection: "row" }}>
        {labels.filter((_, i) => i % every === 0).map((l, k) => <T key={k} tone="muted" size={10} numberOfLines={1} style={{ flex: Math.min(every, labels.length - k * every), textAlign: every === 1 ? "center" : "left" }}>{l}</T>)}
      </View>
      {series.length > 1 && <View style={{ flexDirection: "row", gap: 14, justifyContent: "center" }}>{series.map((s) => <Legend key={s.name} color={s.color} label={s.name} />)}</View>}
    </View>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} /><T size={12} tone="muted">{label}</T></View>
);

export interface Slice { label: string; value: number }

/** Share of a whole as one segmented bar plus a legend (top 6, the rest grouped as "Other"). */
export function ShareBar({ slices, format }: { slices: Slice[]; format: (v: number) => string }) {
  const t = useTheme();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const grow = useGrow(slices.map((s) => s.value).join());
  if (total <= 0) return <T tone="muted" style={{ textAlign: "center", paddingVertical: 16 }}>Nothing recorded.</T>;
  const sorted = slices.filter((x) => x.value > 0).sort((a, b) => b.value - a.value); // zero rows add nothing to a share
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6).reduce((s, x) => s + x.value, 0);
  const items = rest > 0 ? [...top, { label: "Other", value: rest }] : top;
  return (
    <View style={{ gap: 12 }}>
      <Animated.View style={{ flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", backgroundColor: t.border, width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }}>
        {/* `amount`, not `.value`: Reanimated's Babel plugin mistakes `x.value` inside a style for a shared value */}
        {items.map(({ label, value: amount }, i) => <View key={label} style={{ flex: amount, backgroundColor: t.chart[i % t.chart.length], marginRight: i < items.length - 1 ? 2 : 0 }} />)}
      </Animated.View>
      {items.map((s, i) => (
        <View key={s.label} accessible accessibilityLabel={`${s.label}: ${format(s.value)}, ${((s.value / total) * 100).toFixed(0)} percent`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.chart[i % t.chart.length] }} />
          <T style={{ flex: 1 }} numberOfLines={1}>{s.label}</T>
          <T tone="muted" size={13}>{format(s.value)} · {((s.value / total) * 100).toFixed(0)}%</T>
        </View>
      ))}
    </View>
  );
}
