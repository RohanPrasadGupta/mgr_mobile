import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The last exchange rate the user typed for each currency pair, kept on this device so a repeat entry is one tap.
const key = (from: string, to: string) => `moneymgr.fx.${from}.${to}`;
export async function lastFxRate(from: string, to: string): Promise<number | null> {
  try {
    const v = Number(Platform.OS === "web" ? globalThis.localStorage?.getItem(key(from, to)) : await SecureStore.getItemAsync(key(from, to)));
    return v > 0 ? v : null;
  } catch { return null; }
}
export async function rememberFxRate(from: string, to: string, rate: number) {
  if (!(rate > 0)) return;
  try { if (Platform.OS === "web") globalThis.localStorage?.setItem(key(from, to), String(rate)); else await SecureStore.setItemAsync(key(from, to), String(rate)); } catch { /* ignore */ }
}
