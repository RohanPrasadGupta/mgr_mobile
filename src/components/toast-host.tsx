import { Fragment, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, Text } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NATIVE_DRIVER } from "@/lib/motion";
import { toast, type ToastKind } from "@/lib/toast";
import { useTheme } from "@/theme/theme";

interface Item { id: number; kind: ToastKind; message: string }

/** Slides a short confirmation/failure message up from the bottom; queued so none are lost, tap to dismiss. */
export function ToastHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<Item[]>([]);
  const [current, setCurrent] = useState<Item | null>(null);
  const seq = useRef(0);
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => toast.subscribe((kind, message) => setQueue((q) => (q.some((x) => x.message === message) ? q : [...q, { id: ++seq.current, kind, message }]))), []);
  useEffect(() => {
    if (current || !queue.length) return;
    const next = queue[0]!;
    setQueue((q) => q.slice(1));
    setCurrent(next);
  }, [queue, current]);
  useEffect(() => {
    if (!current) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start();
    const hide = setTimeout(dismiss, current.kind === "error" ? 6000 : 3000);
    return () => clearTimeout(hide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  function dismiss() {
    Animated.timing(v, { toValue: 0, duration: 180, useNativeDriver: NATIVE_DRIVER }).start(() => setCurrent(null));
  }

  if (!current) return null;
  // On iOS, modal screens are separate native windows that would cover a normal view: the overlay keeps toasts on top of them.
  const Layer = Platform.OS === "ios" ? FullWindowOverlay : Fragment;
  const bg = current.kind === "error" ? t.expense : current.kind === "success" ? t.income : t.primary;
  return (
    <Layer>
    <Animated.View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 70, alignItems: "center", opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <Pressable onPress={dismiss} accessibilityRole={current.kind === "error" ? "alert" : "text"} accessibilityLiveRegion="polite"
        style={{ maxWidth: 520, backgroundColor: bg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", gap: 10, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>{current.kind === "error" ? "!" : "✓"}</Text>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "500", flexShrink: 1 }}>{current.message}</Text>
      </Pressable>
    </Animated.View>
    </Layer>
  );
}
