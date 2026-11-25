import { useLocalSearchParams } from "expo-router";
import { useTransaction } from "@/api/hooks";
import { CardsSkeleton, ErrorText, Screen } from "@/components/ui";
import { TransactionForm } from "@/components/transaction-form";

export default function EditTransaction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useTransaction(id);
  if (q.isPending) return <Screen><CardsSkeleton count={3} /></Screen>;
  if (q.error || !q.data) return <Screen><ErrorText error={q.error ?? new Error("Transaction not found")} /></Screen>;
  return <TransactionForm key={q.data.id} tx={q.data} />;
}
