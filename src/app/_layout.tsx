import { MutationCache, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { session, useSession } from "@/api/session";
import { ToastHost } from "@/components/toast-host";
import { toast } from "@/lib/toast";
import { themePref, useTheme } from "@/theme/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({
    // Every write reports its outcome like the web app: a success toast when the call site names one, and a failure toast unless it opts out.
    mutationCache: new MutationCache({
      onSuccess: (_d, _v, _c, m) => { const msg = m.meta?.success; if (typeof msg === "string") toast.success(msg); },
      onError: (e, _v, _c, m) => { if (!m.meta?.silent) toast.error(e instanceof Error ? e.message : "Something went wrong"); },
    }),
    defaultOptions: {
      // retry only what can succeed on a second try: network failures and 5xx
      queries: { retry: (n, e) => (e instanceof ApiError ? (e.status === 0 || e.status >= 500) && n < 2 : n < 1), refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  }));
  useEffect(() => { void session.load(); void themePref.load(); }, []);
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <StatusBar style={t.scheme === "dark" ? "light" : "dark"} />
        <Gate />
        <ToastHost />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Signed-in users only see (app); everyone else only sees (auth). Guards re-evaluate whenever the session changes. */
function Gate() {
  const { status } = useSession();
  const qc = useQueryClient();
  useEffect(() => { if (status !== "loading") SplashScreen.hide(); }, [status]);
  useEffect(() => { if (status === "signedOut") qc.clear(); }, [status, qc]); // nothing of the previous account may linger in memory
  if (status === "loading") return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "signedIn"}><Stack.Screen name="(app)" /></Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}><Stack.Screen name="(auth)" /></Stack.Protected>
      {/* email links: open whether or not this device is signed in */}
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}
