import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { Platform, useColorScheme } from "react-native";

// Same tokens as the web app (globals.css) so both clients look like one product:
// dark is a deep navy with a violet/cyan accent pair, light keeps the same hues on a soft lavender canvas.
export const palette = {
  light: {
    bg: "#f3f2fa", card: "#ffffff", fg: "#15132b", muted: "#646287", border: "#e3e1f1", primary: "#9333ea", primaryFg: "#ffffff",
    income: "#15803d", expense: "#dc2626", warn: "#b45309", soft: "#f3e8ff",
    chart: ["#9333ea", "#0891b2", "#d97706", "#059669", "#db2777", "#4f46e5", "#ea580c", "#65a30d"],
  },
  dark: {
    bg: "#070b22", card: "#0d1434", fg: "#e9edff", muted: "#8e9bc9", border: "#1c2653", primary: "#c85bf5", primaryFg: "#14012a",
    income: "#34d399", expense: "#fb7185", warn: "#fbbf24", soft: "#2a1747",
    chart: ["#c85bf5", "#22c7f5", "#fbbf24", "#34d399", "#f472b6", "#6d8cff", "#fb923c", "#a3e635"],
  },
} as const;
type Colors = Omit<typeof palette.light, "chart">;
export type Theme = { [K in keyof Colors]: string } & { chart: readonly string[]; scheme: "light" | "dark" };

// ── theme preference (System / Light / Dark), remembered on the device like the web app's setting ──
export type ThemePref = "system" | "light" | "dark";
const KEY = "moneymgr.theme";
let pref: ThemePref = "system";
const listeners = new Set<() => void>();
const store = {
  get: async () => (Platform.OS === "web" ? (globalThis.localStorage?.getItem(KEY) ?? null) : SecureStore.getItemAsync(KEY)),
  set: async (v: string) => { if (Platform.OS === "web") globalThis.localStorage?.setItem(KEY, v); else await SecureStore.setItemAsync(KEY, v); },
};
export const themePref = {
  get: () => pref,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  async load() { try { const v = await store.get(); if (v === "light" || v === "dark" || v === "system") { pref = v; listeners.forEach((l) => l()); } } catch { /* keep system */ } },
  set(v: ThemePref) { pref = v; listeners.forEach((l) => l()); void store.set(v).catch(() => undefined); },
};
export const useThemePref = () => useSyncExternalStore(themePref.subscribe, themePref.get, themePref.get);

export function useTheme(): Theme {
  const system = useColorScheme();
  const p = useThemePref();
  const scheme = p === "system" ? (system === "dark" ? "dark" : "light") : p;
  return { ...palette[scheme], scheme };
}
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { md: 12, lg: 18, pill: 999 } as const;
