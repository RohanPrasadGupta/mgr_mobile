import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useTheme } from "@/theme/theme";

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ color: String(color), fontSize: 20 }}>{glyph}</Text>;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, animation: "shift", tabBarActiveTintColor: t.primary, tabBarInactiveTintColor: t.muted, tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border } }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("▦") }} />
      <Tabs.Screen name="transactions" options={{ title: "Activity", tabBarIcon: icon("⇅") }} />
      <Tabs.Screen name="budgets" options={{ title: "Budgets", tabBarIcon: icon("◔") }} />
      <Tabs.Screen name="investments" options={{ title: "Invest", tabBarIcon: icon("↗") }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: icon("⋯") }} />
    </Tabs>
  );
}
