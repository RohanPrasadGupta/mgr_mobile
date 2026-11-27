import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { radius, space, useTheme } from "@/theme/theme";
import { NATIVE_DRIVER, useReducedMotion } from "@/lib/motion";

type Tone = "fg" | "muted" | "income" | "expense" | "warn" | "primary";
export function T({ children, tone = "fg", size = 15, bold, style, ...p }: { children: ReactNode; tone?: Tone; size?: number; bold?: boolean; style?: StyleProp<TextStyle> } & Omit<React.ComponentProps<typeof Text>, "style">) {
  const t = useTheme();
  return <Text {...p} style={[{ color: t[tone], fontSize: size, fontWeight: bold ? "600" : "400" }, style]}>{children}</Text>;
}

export function Screen({ children, scroll = true, edges = ["top"], onRefresh, refreshing }: { children: ReactNode; scroll?: boolean; edges?: ("top" | "bottom" | "left" | "right")[]; onRefresh?: () => void; refreshing?: boolean }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.primary} colors={[t.primary]} /> : undefined}>{children}</ScrollView>
      ) : children}
    </SafeAreaView>
  );
}

/** Cards lift with a soft shadow in light mode; dark mode relies on the border (shadows vanish on navy). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const lift: ViewStyle = t.scheme === "light" ? { shadowColor: "#2b1d5c", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 } : {};
  return <View style={[{ backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.lg, padding: space.lg }, lift, style]}>{children}</View>;
}

/** Scales down slightly while pressed, so every tap gets instant physical feedback. */
function PressScale({ children, style, disabled, ...p }: Omit<React.ComponentProps<typeof Pressable>, "style" | "children"> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: NATIVE_DRIVER, speed: 40, bounciness: 4 }).start();
  return (
    <Pressable {...p} disabled={disabled} onPressIn={(e) => { to(0.97); p.onPressIn?.(e); }} onPressOut={(e) => { to(1); p.onPressOut?.(e); }}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ title, onPress, variant = "primary", disabled, loading, testID, small }: { title: string; onPress?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; loading?: boolean; testID?: string; small?: boolean }) {
  const t = useTheme();
  const bg = variant === "primary" ? t.primary : variant === "danger" ? t.expense : "transparent";
  const fg = variant === "ghost" ? t.fg : variant === "primary" ? t.primaryFg : "#ffffff";
  return (
    <PressScale testID={testID} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }} disabled={disabled || loading} onPress={onPress}
      style={{ backgroundColor: bg, borderColor: t.border, borderWidth: variant === "ghost" ? 1 : 0, opacity: disabled || loading ? 0.55 : 1, borderRadius: radius.md, paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 12 : space.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
      {loading && <ActivityIndicator color={fg} size="small" />}
      <Text style={{ color: fg, fontSize: small ? 14 : 16, fontWeight: "600" }}>{title}</Text>
    </PressScale>
  );
}

export function Field({ label, hint, ...p }: { label: string; hint?: string } & TextInputProps) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T tone="muted" size={13} bold>{label}</T>
      <TextInput accessibilityLabel={label} placeholderTextColor={t.muted} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...p}
        style={[{ color: t.fg, backgroundColor: t.bg, borderColor: focus ? t.primary : t.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 }, p.style]} />
      {hint ? <T tone="muted" size={12}>{hint}</T> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, tone }: { label: string; selected?: boolean; onPress?: () => void; tone?: "income" | "expense" }) {
  const t = useTheme();
  const active = tone ? t[tone] : t.primary;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: selected ? active : t.border, backgroundColor: selected ? active : "transparent", opacity: pressed ? 0.75 : 1 })}>
      <Text style={{ color: selected ? (tone ? "#ffffff" : t.primaryFg) : t.fg, fontSize: 14, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

/** One choice from a few, shown as radio buttons (all options visible, the chosen one marked). */
export function RadioGroup<V extends string>({ label, options, value, onChange }: { label: string; options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 6 }}>
      <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: on }} onPress={() => onChange(o.value)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: on ? t.primary : t.border, opacity: pressed ? 0.75 : 1 })}>
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? t.primary : t.muted, alignItems: "center", justifyContent: "center" }}>
                {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary }} />}
              </View>
              <Text style={{ color: t.fg, fontSize: 14, fontWeight: "500" }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ChipRow({ children, wrap }: { children: ReactNode; wrap?: boolean }) {
  return wrap ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{children}</ScrollView>;
}

/** Small coloured label (status pills). */
export function Badge({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  const t = useTheme();
  const c = t[tone];
  return <View style={{ alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: `${c}22` }}><Text style={{ color: c, fontSize: 11, fontWeight: "700" }}>{label}</Text></View>;
}

/** Fills from 0 on first show and glides to new values. */
export function ProgressBar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const target = Math.max(1, Math.min(100, pct));
  const w = useRef(new Animated.Value(reduced ? target : 0)).current;
  useEffect(() => {
    if (reduced) { w.setValue(target); return; }
    Animated.timing(w, { toValue: target, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [target, reduced, w]);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(100, pct)) }} style={{ height, borderRadius: height / 2, backgroundColor: t.border, overflow: "hidden" }}>
      <Animated.View style={{ width: w.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }), height: "100%", backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/** Content arrives by fading up a few points; `index` staggers siblings (capped so long lists never wait). */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 320, delay: Math.min(index, 8) * 40, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start();
  }, [v, index, reduced]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}

/** A gently pulsing placeholder block. */
export function Skeleton({ height = 16, width = "100%", round, style }: { height?: number; width?: ViewStyle["width"]; round?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(v, { toValue: 0.55, duration: 700, useNativeDriver: NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, reduced]);
  return <Animated.View style={[{ height, width, borderRadius: round ? height / 2 : 8, backgroundColor: t.border, opacity: v }, style]} />;
}

/** Placeholder shaped like a list (icon · two lines · amount), so the screen doesn't jump when data lands. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ gap: 14 }}>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: 1 - i * (0.5 / rows) }}>
            <Skeleton height={38} width={38} round />
            <View style={{ flex: 1, gap: 6 }}><Skeleton height={12} width="45%" /><Skeleton height={10} width="28%" /></View>
            <Skeleton height={14} width={64} />
          </View>
        ))}
      </View>
    </Card>
  );
}
export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, i) => <Card key={i} style={{ gap: 10 }}><Skeleton height={14} width="50%" /><Skeleton height={22} width="35%" /><Skeleton height={8} round /></Card>)}
    </View>
  );
}

export function ErrorText({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTheme();
  if (!error) return null;
  return (
    <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: `${t.expense}66`, backgroundColor: `${t.expense}14`, padding: 12, gap: 6 }}>
      <T tone="expense" size={14} accessibilityRole="alert">{error instanceof Error ? error.message : String(error)}</T>
      {onRetry && <T tone="expense" size={14} bold onPress={onRetry} accessibilityRole="button" style={{ textDecorationLine: "underline" }}>Retry</T>}
    </View>
  );
}
export const Empty = ({ children }: { children: ReactNode }) => <FadeIn><Card><T tone="muted" style={{ textAlign: "center" }}>{children}</T></Card></FadeIn>;

/** Segmented control (two to four options). */
export function Segmented<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: { value: V; label: string; tone?: "income" | "expense" }[] }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", borderRadius: radius.md, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        const bg = on ? (o.tone ? t[o.tone] : t.primary) : "transparent";
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: on }} onPress={() => onChange(o.value)}
            style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.md - 3, backgroundColor: bg }}>
            <Text style={{ color: on ? (o.tone ? "#ffffff" : t.primaryFg) : t.muted, fontWeight: "600", fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Header({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><T size={26} bold>{title}</T>{action}</View>;
}

export function MonthPicker({ label, onPrev, onNext, prevLabel = "Previous month", nextLabel = "Next month" }: { label: string; onPrev: () => void; onNext: () => void; prevLabel?: string; nextLabel?: string }) {
  const t = useTheme();
  const arrow = (txt: string, onPress: () => void, name: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={onPress} hitSlop={10} style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, backgroundColor: pressed ? t.border : "transparent" })}>
      <Text style={{ color: t.fg, fontSize: 18 }}>{txt}</Text>
    </Pressable>
  );
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.md }}>{arrow("‹", onPrev, prevLabel)}<T bold style={{ minWidth: 140, textAlign: "center" }}>{label}</T>{arrow("›", onNext, nextLabel)}</View>;
}

/** Alert.alert does nothing on react-native-web, so confirmations go through the platform's own dialog. */
export function confirmAsync(title: string, message: string, confirmLabel = "Delete"): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) => Alert.alert(title, message, [{ text: "Cancel", style: "cancel", onPress: () => resolve(false) }, { text: confirmLabel, style: "destructive", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
}
