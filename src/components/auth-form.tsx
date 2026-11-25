import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { ApiError, login, register } from "@/api/client";
import { Button, Card, ErrorText, FadeIn, Field, Screen, T } from "./ui";
import { Wordmark } from "./brand";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) return setError(new Error("Enter your email and password"));
    if (isRegister && password.length < 8) return setError(new Error("Use at least 8 characters for the password"));
    setBusy(true);
    try {
      if (isRegister) await register({ name: name.trim(), email: email.trim(), password, baseCurrency: currency.trim().toUpperCase(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      else await login({ email: email.trim(), password });
      // the root layout's session guard takes over from here
    } catch (e) {
      setError(e instanceof ApiError ? e : new Error("Something went wrong"));
      setBusy(false);
    }
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FadeIn style={{ gap: 16, paddingTop: 40 }}>
          <View style={{ gap: 4 }}>
            <Wordmark height={36} />
            <T tone="muted">{isRegister ? "Create your account" : "Sign in to continue"}</T>
          </View>
          <Card style={{ gap: 14 }}>
            {isRegister && <Field label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />}
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={isRegister ? "new-password" : "current-password"} textContentType={isRegister ? "newPassword" : "password"} hint={isRegister ? "At least 8 characters" : undefined} onSubmitEditing={submit} />
            {isRegister && <Field label="Base currency" value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} hint="All totals are shown in this currency" />}
            <ErrorText error={error} />
            <Button title={isRegister ? "Create account" : "Sign in"} onPress={submit} loading={busy} />
            {!isRegister && <Link href="/forgot-password" style={{ alignSelf: "flex-end" }}><T tone="primary" size={14}>Forgot password?</T></Link>}
          </Card>
          <T tone="muted" style={{ textAlign: "center" }}>
            {isRegister ? "Have an account? " : "New here? "}
            <Link href={isRegister ? "/login" : "/register"}><T tone="primary" bold>{isRegister ? "Sign in" : "Create an account"}</T></Link>
          </T>
        </FadeIn>
      </KeyboardAvoidingView>
    </Screen>
  );
}
