import { useLocalSearchParams } from "expo-router";
import { useRecurring } from "@/api/hooks";
import { CardsSkeleton, ErrorText, Screen } from "@/components/ui";
import { RecurringForm } from "@/components/recurring-form";

export default function RecurringFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const rules = useRecurring();
  if (id && rules.isPending) return <Screen><CardsSkeleton count={2} /></Screen>;
  const rule = id ? rules.data?.find((r) => r.id === id) : undefined;
  if (id && !rule) return <Screen><ErrorText error={rules.error ?? new Error("Rule not found")} /></Screen>;
  return <RecurringForm key={id ?? "new"} rule={rule} />;
}
