import { Stack } from "expo-router";
import { useTheme } from "@/theme/theme";

export default function AppLayout() {
  const t = useTheme();
  const header = { headerStyle: { backgroundColor: t.card }, headerTintColor: t.fg, headerTitleStyle: { color: t.fg }, headerShadowVisible: false, headerBackButtonDisplayMode: "minimal" as const, contentStyle: { backgroundColor: t.bg }, animation: "slide_from_right" as const };
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="transaction/new" options={{ title: "Add transaction", presentation: "modal" }} />
      <Stack.Screen name="transaction/[id]" options={{ title: "Edit transaction", presentation: "modal" }} />
      <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
      <Stack.Screen name="budget-new" options={{ title: "Add budget", presentation: "modal" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="categories" options={{ title: "Categories & tags" }} />
      <Stack.Screen name="transfers" options={{ title: "Transfers" }} />
      <Stack.Screen name="transfer-new" options={{ title: "New transfer", presentation: "modal" }} />
      <Stack.Screen name="recurring" options={{ title: "Recurring" }} />
      <Stack.Screen name="recurring-form" options={{ title: "Recurring rule", presentation: "modal" }} />
      <Stack.Screen name="investments/[id]" options={{ title: "Asset" }} />
      <Stack.Screen name="asset-new" options={{ title: "Add asset", presentation: "modal" }} />
      <Stack.Screen name="trade" options={{ title: "Trade", presentation: "modal" }} />
      <Stack.Screen name="sip" options={{ title: "SIP calculator" }} />
      <Stack.Screen name="goals/index" options={{ title: "Goals" }} />
      <Stack.Screen name="goals/[id]" options={{ title: "Goal" }} />
      <Stack.Screen name="goal-form" options={{ title: "Goal", presentation: "modal" }} />
      <Stack.Screen name="goal-money" options={{ title: "Add or take out money", presentation: "modal" }} />
      <Stack.Screen name="debts/index" options={{ title: "Debts" }} />
      <Stack.Screen name="debts/[id]" options={{ title: "Debt" }} />
      <Stack.Screen name="debt-form" options={{ title: "Debt", presentation: "modal" }} />
      <Stack.Screen name="debt-payment" options={{ title: "Repayment", presentation: "modal" }} />
      <Stack.Screen name="notes" options={{ title: "Notes" }} />
      <Stack.Screen name="note-form" options={{ title: "Note", presentation: "modal" }} />
      <Stack.Screen name="reports" options={{ title: "Reports" }} />
      <Stack.Screen name="import-export" options={{ title: "Import & export" }} />
    </Stack>
  );
}
