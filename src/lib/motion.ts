import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/** The JS-thread driver is required on web (react-native-web has no native driver). */
export const NATIVE_DRIVER = Platform.OS !== "web";

// Tests run with motion off so assertions see final values immediately.
const IN_TEST = process.env.NODE_ENV === "test";

/** True when the user asked the OS for reduced motion; every animation then jumps straight to its end state. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(IN_TEST);
  useEffect(() => {
    if (IN_TEST) return;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (alive) setReduced(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduced);
    return () => { alive = false; sub?.remove(); };
  }, []);
  return reduced;
}
