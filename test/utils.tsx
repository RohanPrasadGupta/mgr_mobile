import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";

export async function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  ((globalThis as { __queryClients?: QueryClient[] }).__queryClients ??= []).push(client); // cleared in test/setup.ts so timers stop
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client };
}

export interface Call { method: string; path: string; body: any; auth: string | null }
type Handler = (req: { url: URL; body: any }) => unknown;

/** Stubs global fetch with "METHOD /path" → JSON handlers (path without the /v1 prefix and query). Unhandled calls fail loudly. */
export function mockFetch(routes: Record<string, Handler | unknown>) {
  const calls: Call[] = [];
  const fn = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const isReq = typeof Request !== "undefined" && input instanceof Request;
    const url = new URL(isReq ? (input as Request).url : String(input));
    const method = (isReq ? (input as Request).method : (init?.method ?? "GET")).toUpperCase();
    const headers = new Headers(isReq ? (input as Request).headers : init?.headers);
    const text = isReq ? await (input as Request).clone().text() : init?.body ? String(init.body) : "";
    const body = text ? JSON.parse(text) : undefined;
    const path = url.pathname.replace(/^\/v1/, "");
    calls.push({ method, path, body, auth: headers.get("authorization") });
    const key = `${method} ${path}`;
    if (!(key in routes)) throw new Error(`Unhandled fetch: ${key}`);
    const h = routes[key];
    const out = typeof h === "function" ? (h as Handler)({ url, body }) : h;
    if (out instanceof Response) return out;
    if (out === null) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
  });
  (globalThis as { fetch: unknown }).fetch = fn;
  return { calls, fn, last: (method: string, path: string) => [...calls].reverse().find((c) => c.method === method && c.path === path) };
}

export const errorResponse = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: { code, message } }), { status, headers: { "content-type": "application/json" } });

export const tokenResponse = (n: string, expiresIn = 900) => ({ data: { accessToken: `at-${n}`, refreshToken: `rt-${n}`, expiresIn } });
