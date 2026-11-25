import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "moneymgr.session.v1";

/** Native: the Keychain / Keystore via SecureStore. Web exists only as a development convenience (localStorage). */
const storage = {
  get: async (): Promise<string | null> => (Platform.OS === "web" ? (globalThis.localStorage?.getItem(KEY) ?? null) : SecureStore.getItemAsync(KEY)),
  set: async (v: string) => { if (Platform.OS === "web") globalThis.localStorage?.setItem(KEY, v); else await SecureStore.setItemAsync(KEY, v); },
  remove: async () => { if (Platform.OS === "web") globalThis.localStorage?.removeItem(KEY); else await SecureStore.deleteItemAsync(KEY); },
};

export interface Tokens { accessToken: string; refreshToken: string; /** epoch ms */ accessExpiresAt: number }
export type SessionStatus = "loading" | "signedIn" | "signedOut";
export interface SessionState { status: SessionStatus; tokens: Tokens | null }

let state: SessionState = { status: "loading", tokens: null };
const listeners = new Set<() => void>();
const publish = (next: SessionState) => { state = next; listeners.forEach((l) => l()); };

export const toTokens = (r: { accessToken: string; refreshToken: string; expiresIn: number }): Tokens => ({ accessToken: r.accessToken, refreshToken: r.refreshToken, accessExpiresAt: Date.now() + r.expiresIn * 1000 });

export const session = {
  get: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  /** Restore a saved session at app start. */
  async load() {
    try {
      const raw = await storage.get();
      const t = raw ? (JSON.parse(raw) as Tokens) : null;
      publish(t?.refreshToken ? { status: "signedIn", tokens: t } : { status: "signedOut", tokens: null });
    } catch {
      publish({ status: "signedOut", tokens: null });
    }
  },
  async set(tokens: Tokens) {
    publish({ status: "signedIn", tokens });
    await storage.set(JSON.stringify(tokens)).catch(() => undefined);
  },
  async clear() {
    publish({ status: "signedOut", tokens: null });
    await storage.remove().catch(() => undefined);
  },
};

export const useSession = () => useSyncExternalStore(session.subscribe, session.get, session.get);
