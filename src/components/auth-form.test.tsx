import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { session } from "@/api/session";
import { errorResponse, mockFetch, tokenResponse } from "../../test/utils";
import { me } from "../../test/fixtures";
import { AuthForm } from "./auth-form";

jest.mock("expo-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => children, router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
beforeEach(async () => { await session.clear(); });

const fill = async (label: string, value: string) => { await fireEvent.changeText(screen.getByLabelText(label), value); };

describe("AuthForm (login)", () => {
  it("signs in and stores the session", async () => {
    const m = mockFetch({ "POST /auth/login": { data: { user: me, ...tokenResponse("1").data } } });
    await render(<AuthForm mode="login" />);
    await fill("Email", "  me@example.com ");
    await fill("Password", "secret-pass");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(session.get().status).toBe("signedIn"));
    expect(m.calls[0]).toMatchObject({ method: "POST", path: "/auth/login", body: { email: "me@example.com", password: "secret-pass" } });
    expect(session.get().tokens?.refreshToken).toBe("rt-1");
  });

  it("shows the API's message for a wrong password and stays signed out", async () => {
    mockFetch({ "POST /auth/login": () => errorResponse(401, "unauthorized", "Invalid email or password") });
    await render(<AuthForm mode="login" />);
    await fill("Email", "me@example.com");
    await fill("Password", "nope");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Invalid\ email\ or\ password/);
    expect(session.get().status).toBe("signedOut");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(); // can retry
  });

  it("does not call the API with empty fields", async () => {
    const m = mockFetch({});
    await render(<AuthForm mode="login" />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Enter\ your\ email\ and\ password/);
    expect(m.fn).not.toHaveBeenCalled();
  });

  it("explains a network failure", async () => {
    mockFetch({ "POST /auth/login": () => { throw new TypeError("Network request failed"); } });
    await render(<AuthForm mode="login" />);
    await fill("Email", "a@b.c");
    await fill("Password", "x");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Can't\ reach\ the\ server/);
  });
});

describe("AuthForm (register)", () => {
  it("validates the password length locally, then sends name, upper-cased currency and time zone", async () => {
    const m = mockFetch({ "POST /auth/register": { data: { user: me, ...tokenResponse("2").data } } });
    await render(<AuthForm mode="register" />);
    await fill("Name", "Rohan");
    await fill("Email", "r@example.com");
    await fill("Password", "short");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at\ least\ 8\ characters/);
    expect(m.fn).not.toHaveBeenCalled();
    await fill("Password", "longenough1");
    await fill("Base currency", "npr");
    await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(session.get().status).toBe("signedIn"));
    expect(m.calls[0]!.body).toMatchObject({ name: "Rohan", email: "r@example.com", baseCurrency: "NPR", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  });
});
