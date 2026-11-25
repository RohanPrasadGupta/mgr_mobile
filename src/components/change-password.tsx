import { useState } from "react";
import { call, client, login } from "@/api/client";
import { useMe, useMutate } from "@/api/hooks";
import { Button, Card, ErrorText, Field, T } from "./ui";

export function ChangePasswordCard() {
  const { data: me } = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<unknown>(null);
  const save = useMutate((b: { currentPassword: string; newPassword: string }) => call(client.POST("/me/password", { body: b })), async () => {}, "Password changed. Other devices were signed out.");

  async function submit() {
    setError(null);
    if (next.length < 8) return setError(new Error("Use at least 8 characters for the new password"));
    if (next !== repeat) return setError(new Error("The new passwords don’t match"));
    try {
      await save.mutateAsync({ currentPassword: current, newPassword: next });
      // The change revokes every session, this one included: sign straight back in so the app keeps working.
      if (me) await login({ email: me.email, password: next });
      setCurrent(""); setNext(""); setRepeat("");
    } catch (e) { setError(e); }
  }
  return (
    <Card style={{ gap: 14 }}>
      <T bold>Password</T>
      <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
      <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" hint="At least 8 characters" />
      <Field label="Repeat new password" value={repeat} onChangeText={setRepeat} secureTextEntry autoComplete="new-password" />
      <ErrorText error={error} />
      <Button title="Change password" onPress={submit} disabled={!current || !next} loading={save.isPending} />
    </Card>
  );
}
