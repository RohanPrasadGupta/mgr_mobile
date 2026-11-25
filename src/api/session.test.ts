import * as SecureStore from "expo-secure-store";
import { session, toTokens } from "./session";

const tokens = { accessToken: "a", refreshToken: "r", accessExpiresAt: 123 };
beforeEach(async () => { await session.clear(); jest.clearAllMocks(); });

describe("session store", () => {
  it("converts an API token response to absolute expiry", () => {
    const t = toTokens({ accessToken: "a", refreshToken: "r", expiresIn: 900 });
    expect(t.accessExpiresAt).toBeGreaterThan(Date.now() + 890_000);
    expect(t.accessExpiresAt).toBeLessThan(Date.now() + 910_000);
  });

  it("persists in SecureStore and restores on the next launch", async () => {
    await session.set(tokens);
    expect(session.get()).toEqual({ status: "signedIn", tokens });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("moneymgr.session.v1", JSON.stringify(tokens));
    await session.clear(); // simulate a fresh process: memory empty, store populated
    await SecureStore.setItemAsync("moneymgr.session.v1", JSON.stringify(tokens));
    await session.load();
    expect(session.get()).toEqual({ status: "signedIn", tokens });
  });

  it("starts signed out when nothing is stored or the stored value is corrupt", async () => {
    await session.load();
    expect(session.get().status).toBe("signedOut");
    await SecureStore.setItemAsync("moneymgr.session.v1", "{not json");
    await session.load();
    expect(session.get()).toEqual({ status: "signedOut", tokens: null });
  });

  it("clear() removes the stored tokens and notifies subscribers", async () => {
    await session.set(tokens);
    const listener = jest.fn();
    const off = session.subscribe(listener);
    await session.clear();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("moneymgr.session.v1");
    expect(session.get()).toEqual({ status: "signedOut", tokens: null });
    expect(listener).toHaveBeenCalled();
    off();
  });

  it("still updates the in-memory state if the keychain write fails", async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error("keychain locked"));
    await expect(session.set(tokens)).resolves.toBeUndefined();
    expect(session.get().status).toBe("signedIn");
  });
});
