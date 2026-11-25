import { Link, router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { forgotPassword, resetPassword, verifyEmail } from "@/api/client";
import { session } from "@/api/session";
import { Button, Card, ErrorText, FadeIn, Field, Screen, T } from "./ui";
import { Wordmark } from "./brand";

/** Pull the token out of whatever was pasted: the bare token, or the whole link from the email. */
export function extractToken(input: string): string {
  const s = input.trim();
  const m = s.match(/[?&]token=([^&#\s]+)/);
  return m ? decodeURIComponent(m[1]!) : s;
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FadeIn style={{ gap: 16, paddingTop: 40 }}>
          <Wordmark height={26} />
          <View style={{ gap: 4 }}><T size={24} bold>{title}</T>{subtitle ? <T tone="muted">{subtitle}</T> : null}</View>
          <Card style={{ gap: 14 }}>{children}</Card>
        </FadeIn>
      </KeyboardAvoidingView>
    </Screen>
  );
}
const back = (label = "Back to sign in") => <Link href="/login" style={{ alignSelf: "center" }}><T tone="primary" bold>{label}</T></Link>;

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setError(null);
    if (!email.trim()) return setError(new Error("Enter your email"));
    setBusy(true);
    try { await forgotPassword(email.trim()); setSent(email.trim()); } catch (e) { setError(e); } finally { setBusy(false); }
  }
  if (sent) return (
    <Shell title="Check your email">
      <T>If an account exists for <T bold>{sent}</T>, we’ve sent a link to reset its password. It works once and expires in 1 hour.</T>
      <T tone="muted" size={14}>Open the link on this phone, or copy it and paste it on the next screen.</T>
      <Button title="I have the link" onPress={() => router.push("/reset-password")} />
      {back()}
    </Shell>
  );
  return (
    <Shell title="Forgot your password?" subtitle="Enter your email and we’ll send you a reset link.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" onSubmitEditing={submit} />
      <ErrorText error={error} />
      <Button title="Send reset link" onPress={submit} loading={busy} />
      {back()}
    </Shell>
  );
}

export function ResetPassword({ token: initial }: { token?: string }) {
  const [token, setToken] = useState(initial ?? "");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setError(null);
    const tk = extractToken(token);
    if (!tk) return setError(new Error("Paste the link from the email"));
    if (password.length < 8) return setError(new Error("Use at least 8 characters for the password"));
    if (password !== repeat) return setError(new Error("The two passwords don’t match"));
    setBusy(true);
    try {
      await resetPassword(tk, password);
      await session.clear(); // every session was revoked server-side; drop this device's too
      setDone(true);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  if (done) return (
    <Shell title="Password changed">
      <T>Your password has been reset and every device was signed out. Sign in with your new password.</T>
      <Button title="Sign in" onPress={() => router.replace("/login")} />
    </Shell>
  );
  return (
    <Shell title="Choose a new password">
      {!initial && <Field label="Reset link or code" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} placeholder="Paste the link from the email" />}
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters" />
      <Field label="Repeat new password" value={repeat} onChangeText={setRepeat} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
      <ErrorText error={error} />
      <Button title="Reset password" onPress={submit} loading={busy} />
      {error instanceof Error && /expired|invalid/i.test(error.message) ? <Link href="/forgot-password" style={{ alignSelf: "center" }}><T tone="primary" bold>Request a new link</T></Link> : back()}
    </Shell>
  );
}

export function VerifyEmail({ token }: { token?: string }) {
  const [state, setState] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [error, setError] = useState<unknown>(token ? null : new Error("This verification link is missing its token."));
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return; // single-use token: never send it twice
    ran.current = true;
    verifyEmail(extractToken(token)).then(() => setState("ok"), (e) => { setError(e); setState("error"); });
  }, [token]);
  const signedIn = session.get().status === "signedIn";
  return (
    <Shell title={state === "ok" ? "Email confirmed" : state === "working" ? "Confirming…" : "Couldn’t confirm"}>
      {state === "ok" && <T>Thanks — your email address is confirmed. You can now reset your password if you ever forget it.</T>}
      {state === "working" && <T tone="muted">One moment…</T>}
      <ErrorText error={state === "error" ? error : null} />
      {state !== "working" && <Button title={signedIn ? "Continue" : "Sign in"} onPress={() => router.replace(signedIn ? "/" : "/login")} />}
    </Shell>
  );
}
