import createClient from "openapi-fetch";
import { Platform } from "react-native";
import type { paths } from "./schema";
import type { Body } from "./types";
import { session, toTokens } from "./session";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

/** Android emulators reach the host machine at 10.0.2.2; real devices need EXPO_PUBLIC_API_URL set to the machine's LAN address. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000");

const withAuth = (req: Request, token?: string) => {
  const headers = new Headers(req.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request(req, { headers });
};

let refreshing: Promise<boolean> | null = null;
/**
 * Refresh tokens rotate and the API revokes the whole family on reuse, so every caller shares ONE refresh.
 * Returns false when the session can't continue; only an explicit rejection signs the user out (a network blip does not).
 */
export function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const rt = session.get().tokens?.refreshToken;
    if (!rt) return false;
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) });
      if (res.status === 401 || res.status === 403) { await session.clear(); return false; }
      if (!res.ok) return false;
      await session.set(toTokens((await res.json()).data));
      return true;
    } catch {
      return false;
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

const EXPIRY_SKEW_MS = 30_000;

async function authedFetch(req: Request): Promise<Response> {
  const isAuthRoute = new URL(req.url).pathname.includes("/auth/");
  if (isAuthRoute) return fetch(req);
  const t = session.get().tokens;
  if (t && t.accessExpiresAt - Date.now() < EXPIRY_SKEW_MS) await refreshTokens(); // refresh before it expires, not after the failure
  const retry = req.clone();
  const res = await fetch(withAuth(req, session.get().tokens?.accessToken));
  if (res.status !== 401 || !session.get().tokens) return res;
  if (await refreshTokens()) return fetch(withAuth(retry, session.get().tokens?.accessToken));
  return res;
}

/** Typed client generated from the API's OpenAPI document (src/api/schema.d.ts — regenerate with `npm run api:sync`). */
export const client = createClient<paths>({ baseUrl: `${API_URL}/v1`, fetch: authedFetch as unknown as typeof fetch });

type Result<T> = { data?: T; error?: unknown; response: Response };
/** Unwraps a client result: returns the body, or throws an ApiError carrying the API's code/message/details. */
export async function call<T>(result: Promise<Result<T>>): Promise<T> {
  let r: Result<T>;
  try { r = await result; } catch { throw new ApiError(0, "network_error", "Can't reach the server. Check your connection."); }
  if (r.error !== undefined || !r.response.ok) {
    const e = (r.error as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new ApiError(r.response.status, e?.code ?? "error", e?.message ?? `Request failed (${r.response.status})`, e?.details);
  }
  return r.data as T;
}

export async function login(body: { email: string; password: string }) {
  const { data } = await call(client.POST("/auth/login", { body }));
  await session.set(toTokens(data));
  return data.user;
}

export async function register(body: Body<"/auth/register", "post">) {
  const { data } = await call(client.POST("/auth/register", { body }));
  await session.set(toTokens(data));
  return data.user;
}

export async function signOut() {
  const rt = session.get().tokens?.refreshToken;
  await session.clear(); // local sign-out never depends on the network
  if (rt) await call(client.POST("/auth/logout", { body: { refreshToken: rt } })).catch(() => undefined);
}

// ── password + email flows (public auth routes, never authenticated) ──
export const forgotPassword = (email: string) => call(client.POST("/auth/forgot-password", { body: { email } }));
export const resetPassword = (token: string, password: string) => call(client.POST("/auth/reset-password", { body: { token, password } }));
export const verifyEmail = (token: string) => call(client.POST("/auth/verify-email", { body: { token } }));

/** A file picked on the device (camera, photo library). */
export interface LocalFile { uri: string; name: string; type: string; size?: number }

/**
 * Uploads a receipt as multipart/form-data. React Native's FormData streams a `{ uri, name, type }` file straight from disk;
 * on web the picker gives a blob: URI, which is read into a Blob first.
 * Native: Expo's fetch rejects the old React Native `{ uri, name, type }` part ("Unsupported FormDataPart implementation"),
 * so the photo goes in as an expo-file-system `File`. A plain `fetch(url, { body: form })` (no `Request` wrapper) is used, the
 * form is rebuilt per attempt, and the token is refreshed before expiry and once more on a 401.
 */
export async function uploadAttachment(transactionId: string, file: LocalFile) {
  const url = `${API_URL}/v1/transactions/${encodeURIComponent(transactionId)}/attachments`;
  const blob = Platform.OS === "web" ? await (await fetch(file.uri)).blob() : null;
  const send = () => {
    const form = new FormData(); // rebuilt per attempt: a sent body can't be reused
    if (blob) form.append("file", blob, file.name);
    // Expo's fetch only accepts parts that expose bytes(); expo-file-system's File streams the picked photo from disk.
    else form.append("file", new (require("expo-file-system") as typeof import("expo-file-system")).File(file.uri) as unknown as Blob, file.name);
    return fetch(url, { method: "POST", body: form, headers: { authorization: `Bearer ${session.get().tokens?.accessToken ?? ""}` } });
  };
  let res: Response;
  try {
    const t = session.get().tokens;
    if (t && t.accessExpiresAt - Date.now() < EXPIRY_SKEW_MS) await refreshTokens();
    res = await send();
    if (res.status === 401 && (await refreshTokens())) res = await send();
  } catch (e) {
    if (__DEV__) console.warn("[uploadAttachment]", e);
    throw new ApiError(0, "network_error", "Can't reach the server. Check your connection.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? "error", json?.error?.message ?? `Upload failed (${res.status})`);
  return json?.data as import("./types").Attachment;
}

/** Image source for an attachment: the file endpoint needs the bearer token, which expo-image sends as a header. */
export const attachmentSource = (id: string) => ({ uri: `${API_URL}/v1/attachments/${encodeURIComponent(id)}/file`, headers: { authorization: `Bearer ${session.get().tokens?.accessToken ?? ""}` } });
