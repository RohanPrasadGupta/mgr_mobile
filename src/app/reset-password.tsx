import { useLocalSearchParams } from "expo-router";
import { ResetPassword } from "@/components/password-flows";

// Outside the signed-in/out groups so the email link (moneymgr://reset-password?token=…) opens in either state.
export default function Screen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <ResetPassword token={token} />;
}
