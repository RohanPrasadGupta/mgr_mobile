import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { call, client, signOut } from "@/api/client";
import { session } from "@/api/session";
import { toast } from "@/lib/toast";
import { useMe, useMutate } from "@/api/hooks";
import { Button, Card, ErrorText, Field, Screen, Segmented, Skeleton, T } from "@/components/ui";
import { ChangePasswordCard } from "@/components/change-password";
import { CurrencyPicker } from "@/components/currency-picker";
import { MyCurrencies } from "@/components/my-currencies";
import { themePref, useThemePref, type ThemePref } from "@/theme/theme";
import { openPrivacy } from "@/lib/legal";

export default function Settings() {
  const me = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { if (me.data) { setName(me.data.name); setBase(me.data.baseCurrency); } }, [me.data]);
  const save = useMutate((body: { name: string; baseCurrency: string }) => call(client.PATCH("/me", { body })), (q) => q.invalidateQueries());

  const dirty = !!me.data && (name.trim() !== me.data.name || base !== me.data.baseCurrency);
  async function submit() {
    setMsg(null); setError(null);
    try { await save.mutateAsync({ name: name.trim(), baseCurrency: base }); setMsg("Saved."); toast.success("Settings saved"); } catch (e) { setError(e); }
  }

  // account deletion
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [delError, setDelError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function deleteAccount() {
    setDelError(null); setBusy(true);
    try {
      await call(client.DELETE("/me", { body: { password } }));
      qc.clear();
      await session.clear(); // the root layout's guard returns the user to sign-in
    } catch (e) { setDelError(e); setBusy(false); }
  }

  const theme = useThemePref();
  if (me.isPending) return <Screen><Card style={{ gap: 12 }}><Skeleton height={14} width="30%" /><Skeleton height={42} /><Skeleton height={42} /></Card></Screen>;
  return (
    <Screen>
      <Card style={{ gap: 14 }}>
        <T bold>Profile</T>
        <Field label="Email" value={me.data?.email ?? ""} editable={false} />
        <Field label="Name" value={name} onChangeText={setName} />
        <CurrencyPicker label="Base currency" value={base} onChange={setBase} />
        {base !== me.data?.baseCurrency && <T tone="warn" size={13}>Changing the base currency does not convert your existing transactions, so past totals will mix currencies.</T>}
        <ErrorText error={error} />
        {msg ? <T tone="income" accessibilityRole="alert">{msg}</T> : null}
        <Button title="Save changes" onPress={submit} disabled={!dirty} loading={save.isPending} />
      </Card>

      <MyCurrencies />

      <Card style={{ gap: 12 }}>
        <T bold>Appearance</T>
        <Segmented<ThemePref> value={theme} onChange={(v) => themePref.set(v)} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </Card>

      <ChangePasswordCard />

      <Button title="Privacy policy" variant="ghost" onPress={() => void openPrivacy()} />
      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />

      <Card style={{ gap: 12, borderColor: "#dc262666" }}>
        <T tone="expense" bold>Delete account</T>
        <T tone="muted" size={13}>Permanently erases your account and everything in it — transactions, accounts, categories, budgets, recurring rules and investments. This cannot be undone.</T>
        {confirming ? (
          <>
            <Field label="Your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
            <Field label="Type DELETE to confirm" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
            <ErrorText error={delError} />
            <Button title="Delete everything" variant="danger" onPress={deleteAccount} disabled={!password || typed !== "DELETE"} loading={busy} />
            <Button title="Cancel" variant="ghost" onPress={() => { setConfirming(false); setPassword(""); setTyped(""); setDelError(null); }} />
          </>
        ) : <Button title="Delete my account…" variant="danger" onPress={() => setConfirming(true)} />}
      </Card>
    </Screen>
  );
}

