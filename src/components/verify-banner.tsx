import { useState } from "react";
import { Pressable, View } from "react-native";
import { call, client } from "@/api/client";
import { useMe, useMutate } from "@/api/hooks";
import { useTheme } from "@/theme/theme";
import { FadeIn, T } from "./ui";

/** Shown until the address is confirmed: without it, a forgotten password can't be recovered. */
export function VerifyBanner() {
  const t = useTheme();
  const { data: me } = useMe();
  const [hidden, setHidden] = useState(false);
  const resend = useMutate(() => call(client.POST("/me/resend-verification")), async () => {}, "Verification email sent — check your inbox");
  if (!me || me.emailVerified || hidden) return null;
  return (
    <FadeIn>
      <View accessibilityRole="summary" style={{ borderRadius: 14, borderWidth: 1, borderColor: `${t.primary}55`, backgroundColor: `${t.primary}18`, padding: 12, gap: 8 }}>
        <T size={14}>Please confirm <T size={14} bold>{me.email}</T> so you can recover your account if you forget the password.</T>
        <View style={{ flexDirection: "row", gap: 18 }}>
          <Pressable accessibilityRole="button" disabled={resend.isPending || resend.isSuccess} onPress={() => resend.mutate(undefined as never)}>
            <T tone="primary" size={14} bold>{resend.isSuccess ? "Sent" : resend.isPending ? "Sending…" : "Resend email"}</T>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setHidden(true)}><T tone="muted" size={14}>Later</T></Pressable>
        </View>
      </View>
    </FadeIn>
  );
}
