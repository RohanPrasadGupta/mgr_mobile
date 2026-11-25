import { useLocalSearchParams } from "expo-router";
import { TransferForm } from "@/components/transfer-form";

export default function NewTransfer() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <TransferForm defaultFrom={from} />;
}
