import * as SecureStore from "expo-secure-store";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { call, client } from "@/api/client";
import { useAccounts, useBudgetStatus, useGoals, useLatestTransaction, useMe, useMutate } from "@/api/hooks";
import { useTheme } from "@/theme/theme";
import { Card, FadeIn, ProgressBar, T } from "./ui";

const key = (userId: string) => `moneymgr.getStarted.hidden.${userId}`;
const readHidden = async (userId: string) => { try { return (Platform.OS === "web" ? globalThis.localStorage?.getItem(key(userId)) : await SecureStore.getItemAsync(key(userId))) === "1"; } catch { return false; } };
const writeHidden = (userId: string) => { try { if (Platform.OS === "web") globalThis.localStorage?.setItem(key(userId), "1"); else void SecureStore.setItemAsync(key(userId), "1"); } catch { /* ignore */ } };

/** First-run checklist on Home. Steps are derived from real data, so they tick themselves off; hidden once done or dismissed. */
export function GetStarted() {
  const t = useTheme();
  const { data: me } = useMe();
  const accounts = useAccounts();
  const latest = useLatestTransaction();
  const budgets = useBudgetStatus();
  const goals = useGoals();
  const [hidden, setHidden] = useState<boolean | null>(null); // null until the saved choice is read
  useEffect(() => { if (me) void readHidden(me.id).then(setHidden); }, [me]);
  const resend = useMutate(() => call(client.POST("/me/resend-verification")), async () => {}, "Verification email sent — check your inbox");

  if (!me || hidden !== false || !accounts.data || latest.data === undefined || !budgets.data || !goals.data) return null;
  const hasAccount = accounts.data.some((a) => !a.archived);
  const go = (href: Href) => () => router.push(href);
  const steps = [
    { id: "account", title: "Add an account", why: "Cash, a bank account or a card.", done: hasAccount, cta: "Add account", run: go("/accounts") },
    { id: "transaction", title: "Record your first transaction", why: "Or import your spreadsheet export.", done: !!latest.data, cta: hasAccount ? "Add transaction" : "Import a file", run: go(hasAccount ? "/transaction/new" : "/import-export") },
    { id: "budget", title: "Set a monthly budget", why: "Get warned before you overspend.", done: budgets.data.items.length > 0, cta: "Create budget", run: go("/budget-new") },
    { id: "goal", title: "Add a savings goal", why: "See how much to save each month.", done: goals.data.length > 0, cta: "Add goal", run: go("/goal-form") },
    { id: "email", title: "Confirm your email", why: "So you can reset your password.", done: me.emailVerified, cta: resend.isSuccess ? "Email sent" : "Resend email", run: () => resend.mutate(undefined as never) },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const hide = () => { writeHidden(me.id); setHidden(true); };

  return (
    <FadeIn>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <T bold size={17} accessibilityRole="header">Get started{me.name ? `, ${me.name.split(" ")[0]}` : ""}</T>
            <T tone="muted" size={13}>{done} of {steps.length} done — a few minutes to set things up.</T>
          </View>
          <T tone="muted" size={18} accessibilityRole="button" accessibilityLabel="Hide the get started checklist" onPress={hide} suppressHighlighting>✕</T>
        </View>
        <ProgressBar pct={(done / steps.length) * 100} color={t.primary} height={6} />
        {steps.map((s, i) => (
          <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
            <T size={18} tone={s.done ? "income" : "muted"} accessibilityLabel={s.done ? "Done" : "Not done"}>{s.done ? "✓" : "○"}</T>
            <View style={{ flex: 1 }}>
              <T bold={!s.done} tone={s.done ? "muted" : "fg"} size={14} style={s.done ? { textDecorationLine: "line-through" } : undefined}>{s.title}</T>
              {!s.done && <T tone="muted" size={12}>{s.why}</T>}
            </View>
            {!s.done && (
              <Pressable accessibilityRole="button" accessibilityLabel={s.cta} onPress={s.run} hitSlop={8} disabled={s.id === "email" && (resend.isPending || resend.isSuccess)}>
                <T tone="primary" bold size={13}>{s.cta}</T>
              </Pressable>
            )}
          </View>
        ))}
        <T tone="muted" size={12} onPress={hide} accessibilityRole="button" style={{ alignSelf: "flex-end" }}>I’ll do this later</T>
      </Card>
    </FadeIn>
  );
}
