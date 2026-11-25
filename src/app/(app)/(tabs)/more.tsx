import { router, type Href } from "expo-router";
import { Pressable, View } from "react-native";
import { useMe } from "@/api/hooks";
import { signOut } from "@/api/client";
import { Button, Card, FadeIn, Screen, T } from "@/components/ui";
import { VerifyBanner } from "@/components/verify-banner";
import { useTheme } from "@/theme/theme";

const ITEMS: { label: string; href: Href; glyph: string }[] = [
  { label: "Goals", href: "/goals", glyph: "⚑" },
  { label: "Debts", href: "/debts", glyph: "⇆" },
  { label: "Reports", href: "/reports", glyph: "▥" },
  { label: "Notes", href: "/notes", glyph: "✎" },
  { label: "Transfers", href: "/transfers", glyph: "⇄" },
  { label: "Recurring", href: "/recurring", glyph: "↻" },
  { label: "Accounts", href: "/accounts", glyph: "▤" },
  { label: "Categories & tags", href: "/categories", glyph: "◈" },
  { label: "Import & export", href: "/import-export", glyph: "⇪" },
  { label: "Settings", href: "/settings", glyph: "⚙" },
];

export default function More() {
  const t = useTheme();
  const me = useMe();
  return (
    <Screen>
      <T size={26} bold>More</T>
      <VerifyBanner />
      <Card>
        <T bold>{me.data?.name ?? " "}</T>
        <T tone="muted" size={13}>{me.data?.email}</T>
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        {ITEMS.map((i, idx) => (
          <FadeIn key={i.label} index={idx}><Pressable accessibilityRole="button" accessibilityLabel={i.label} onPress={() => router.push(i.href)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, opacity: pressed ? 0.6 : 1, borderTopWidth: idx ? 1 : 0, borderTopColor: t.border })}>
            <T size={18} tone="muted">{i.glyph}</T><T style={{ flex: 1 }}>{i.label}</T><T tone="muted">›</T>
          </Pressable></FadeIn>
        ))}
      </Card>
      <View><Button title="Sign out" variant="ghost" onPress={() => void signOut()} /></View>
    </Screen>
  );
}
