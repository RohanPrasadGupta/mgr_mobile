import { useLocalSearchParams } from "expo-router";
import { VerifyEmail } from "@/components/password-flows";

export default function Screen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <VerifyEmail token={token} />;
}
