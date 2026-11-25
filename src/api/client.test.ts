import { errorResponse, mockFetch, tokenResponse } from "../../test/utils";
import { ApiError, call, client, login, refreshTokens, signOut } from "./client";
import { session } from "./session";

const FRESH = { accessToken: "at-old", refreshToken: "rt-old", accessExpiresAt: Date.now() + 600_000 };
const me = { data: { id: "u1", email: "a@b.c", name: "A", baseCurrency: "THB", timezone: "UTC", locale: "en", weekStart: 1 } };
beforeEach(async () => { await session.set(FRESH); });

describe("authenticated requests", () => {
  it("sends the bearer token", async () => {
    const m = mockFetch({ "GET /me": me });
    await call(client.GET("/me"));
    expect(m.calls[0]!.auth).toBe("Bearer at-old");
  });

  it("refreshes BEFORE the access token expires and uses the new one", async () => {
    await session.set({ ...FRESH, accessExpiresAt: Date.now() + 5_000 }); // inside the 30s skew
    const m = mockFetch({ "POST /auth/refresh": tokenResponse("new"), "GET /me": me });
    await call(client.GET("/me"));
    expect(m.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /auth/refresh", "GET /me"]);
    expect(m.calls[1]!.auth).toBe("Bearer at-new");
    expect(session.get().tokens?.refreshToken).toBe("rt-new"); // rotated token stored
  });

  it("on 401 refreshes once and retries the original request with the same body", async () => {
    let first = true;
    const m = mockFetch({
      "POST /auth/refresh": tokenResponse("new"),
      "POST /accounts": ({ body }: { body: unknown }) => (first ? ((first = false), errorResponse(401, "unauthorized", "expired")) : { data: { echoed: body } }),
    });
    const out = await call(client.POST("/accounts", { body: { name: "Bank", type: "bank", currency: "THB" } }));
    expect(out).toEqual({ data: { echoed: { name: "Bank", type: "bank", currency: "THB" } } });
    expect(m.calls.map((c) => `${c.method} ${c.path} ${c.auth}`)).toEqual(["POST /accounts Bearer at-old", "POST /auth/refresh null", "POST /accounts Bearer at-new"]);
  });

  it("shares ONE refresh between parallel requests (rotating tokens must not be reused)", async () => {
    await session.set({ ...FRESH, accessExpiresAt: Date.now() + 1_000 });
    let refreshes = 0;
    mockFetch({ "POST /auth/refresh": () => { refreshes++; return tokenResponse("p"); }, "GET /me": me, "GET /accounts": { data: [] }, "GET /categories": { data: [] } });
    await Promise.all([call(client.GET("/me")), call(client.GET("/accounts")), call(client.GET("/categories"))]);
    expect(refreshes).toBe(1);
  });

  it("signs the user out when the refresh token is rejected", async () => {
    mockFetch({ "GET /me": () => errorResponse(401, "unauthorized", "expired"), "POST /auth/refresh": () => errorResponse(401, "unauthorized", "reuse detected") });
    await expect(call(client.GET("/me"))).rejects.toMatchObject({ status: 401 });
    expect(session.get()).toEqual({ status: "signedOut", tokens: null });
  });

  it("does NOT sign out on a network failure while refreshing", async () => {
    await session.set({ ...FRESH, accessExpiresAt: Date.now() + 1_000 });
    mockFetch({ "POST /auth/refresh": () => { throw new TypeError("Network request failed"); }, "GET /me": me });
    await call(client.GET("/me")).catch(() => undefined);
    expect(session.get().status).toBe("signedIn");
    await expect(refreshTokens()).resolves.toBe(false);
  });

  it("never attaches the access token to auth routes, and a wrong password does not trigger a refresh", async () => {
    const m = mockFetch({ "POST /auth/login": () => errorResponse(401, "unauthorized", "Invalid email or password") });
    await expect(login({ email: "a@b.c", password: "nope" })).rejects.toThrow("Invalid email or password");
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]!.auth).toBeNull();
  });
});

describe("call()", () => {
  it("turns API errors into ApiError with code, message and details", async () => {
    mockFetch({ "GET /me": () => errorResponse(422, "fx_rate_required", "No FX rate") });
    const e = await call(client.GET("/me")).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 422, code: "fx_rate_required", message: "No FX rate" });
  });
  it("explains network failures in plain words", async () => {
    mockFetch({ "GET /me": () => { throw new TypeError("Network request failed"); } });
    await expect(call(client.GET("/me"))).rejects.toMatchObject({ code: "network_error", message: expect.stringContaining("Can't reach the server") });
  });
  it("returns undefined for 204", async () => {
    mockFetch({ "DELETE /transactions/t1": null });
    await expect(call(client.DELETE("/transactions/{id}", { params: { path: { id: "t1" } } }))).resolves.toBeUndefined();
  });
});

describe("sign in / out", () => {
  it("login stores the session; signOut clears it locally even if the network call fails", async () => {
    await session.clear();
    mockFetch({ "POST /auth/login": { data: { user: me.data, ...tokenResponse("x").data } } });
    await login({ email: "a@b.c", password: "pw" });
    expect(session.get().tokens?.refreshToken).toBe("rt-x");
    mockFetch({ "POST /auth/logout": () => { throw new TypeError("offline"); } });
    await signOut();
    expect(session.get().status).toBe("signedOut");
  });
  it("signOut revokes the refresh token server-side", async () => {
    const m = mockFetch({ "POST /auth/logout": null });
    await signOut();
    expect(m.last("POST", "/auth/logout")!.body).toEqual({ refreshToken: "rt-old" });
  });
});
