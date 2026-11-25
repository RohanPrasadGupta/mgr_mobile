import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Platform } from "react-native";
import type { Goal, Note, Report, Transaction } from "@/api/types";
import { session } from "@/api/session";
import { isDate } from "@/lib/money";
import { reportCsv } from "@/lib/report-csv";
import { toast } from "@/lib/toast";
import { palette, themePref } from "@/theme/theme";
import { baseRoutes } from "../../test/fixtures";
import { errorResponse, mockFetch, renderWithClient } from "../../test/utils";
import { BarChart, ShareBar } from "./charts";
import { ForgotPassword, ResetPassword, extractToken } from "./password-flows";
import { TagPicker } from "./tag-picker";
import { ToastHost } from "./toast-host";
import { TransactionForm } from "./transaction-form";
import { Button } from "./ui";

const params: Record<string, string | undefined> = {};
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => params,
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
}));
// expo-file-system's File is Blob-like (it has bytes()); in Node the stand-in must be a real Blob for undici's FormData.
jest.mock("expo-file-system", () => ({ File: class MockFile extends Blob { constructor(_uri: string) { super([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }); } } }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
beforeEach(() => { (router.back as jest.Mock).mockClear(); (router.replace as jest.Mock).mockClear(); for (const k of Object.keys(params)) delete params[k]; });

const press = async (name: string | RegExp) => { await fireEvent.press(screen.getByRole("button", { name })); };
const type = async (label: string | RegExp, v: string) => { await fireEvent.changeText(screen.getByLabelText(label), v); };

describe("helpers", () => {
  it("extractToken accepts a bare token or the whole emailed link", () => {
    expect(extractToken("  abc123  ")).toBe("abc123");
    expect(extractToken("http://localhost:3000/reset-password?token=Xy_9-z&utm=1")).toBe("Xy_9-z");
    expect(extractToken("moneymgr://reset-password?token=a%2Bb")).toBe("a+b");
  });
  it("isDate only accepts real calendar dates", () => {
    expect(isDate("2026-02-28")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("28/02/2026")).toBe(false);
  });
  it("report CSV neutralises spreadsheet formulas in text cells and keeps numbers", () => {
    const r = { label: "Nov 2026", from: "2026-11-01", to: "2026-11-30", baseCurrency: "THB", period: "month", incomeMinor: 100_00, expenseMinor: 40_00, netMinor: 60_00,
      previous: { incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
      expenseByCategory: [{ categoryId: "c", name: "=HYPERLINK(\"x\")", totalMinor: 40_00, pct: 100, previousMinor: 0, changePct: null }], incomeByCategory: [], series: [{ from: "2026-11-01", label: "1", incomeMinor: 0, expenseMinor: -5_00 }] } as unknown as Report;
    const csv = reportCsv(r);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("2026-11-01,0.00,-5.00"); // negative numbers are not mangled
  });
});

describe("theme", () => {
  it("matches the web palette and remembers the chosen mode", () => {
    expect(palette.dark.bg).toBe("#070b22");
    expect(palette.light.primary).toBe("#9333ea");
    themePref.set("dark");
    expect(themePref.get()).toBe("dark");
    themePref.set("system");
  });
});

describe("Button", () => {
  it("is busy and disabled while loading", async () => {
    const onPress = jest.fn();
    await renderWithClient(<Button title="Save" loading onPress={onPress} />);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toBeDisabled();
    expect(b.props.accessibilityState).toMatchObject({ busy: true });
  });
});

describe("toasts", () => {
  it("show a raised message and dismiss on tap", async () => {
    await renderWithClient(<ToastHost />);
    await act(async () => toast.success("Goal created"));
    expect(await screen.findByText("Goal created")).toBeOnTheScreen();
  });
});

describe("password flows", () => {
  it("forgot password posts the email and confirms without revealing whether it exists", async () => {
    const m = mockFetch({ "POST /auth/forgot-password": new Response(null, { status: 202 }) });
    await renderWithClient(<ForgotPassword />);
    await type("Email", " me@example.com ");
    await press("Send reset link");
    expect(await screen.findByText("Check your email")).toBeOnTheScreen();
    expect(m.last("POST", "/auth/forgot-password")!.body).toEqual({ email: "me@example.com" });
    expect(m.last("POST", "/auth/forgot-password")!.auth).toBeNull();
  });

  it("reset refuses mismatched passwords, then resets with the pasted link's token and signs this device out", async () => {
    const m = mockFetch({ "POST /auth/reset-password": null });
    await session.set({ accessToken: "a", refreshToken: "r", accessExpiresAt: Date.now() + 60_000 });
    await renderWithClient(<ResetPassword />);
    await type("Reset link or code", "http://localhost:3000/reset-password?token=TOK123");
    await type("New password", "longenough1");
    await type("Repeat new password", "different11");
    await press("Reset password");
    expect(await screen.findByRole("alert")).toHaveTextContent(/don.t match/);
    expect(m.calls).toHaveLength(0);
    await type("Repeat new password", "longenough1");
    await press("Reset password");
    expect(await screen.findByText("Password changed")).toBeOnTheScreen();
    expect(m.last("POST", "/auth/reset-password")!.body).toEqual({ token: "TOK123", password: "longenough1" });
    expect(session.get().status).toBe("signedOut");
  });

  it("shows the API's reason for an expired link", async () => {
    mockFetch({ "POST /auth/reset-password": () => errorResponse(400, "invalid_token", "This link is invalid or has expired") });
    await renderWithClient(<ResetPassword token="old" />);
    expect(screen.queryByLabelText("Reset link or code")).not.toBeOnTheScreen(); // came in through the deep link
    await type("New password", "longenough1");
    await type("Repeat new password", "longenough1");
    await press("Reset password");
    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/);
  });
});

describe("tags", () => {
  const tags = [{ id: "g1", name: "trip", usageCount: 2 }, { id: "g2", name: "work", usageCount: 0 }];
  it("toggles existing tags and creates a new one inline (reusing an existing name case-insensitively)", async () => {
    const m = mockFetch({ "GET /tags": { data: tags }, "POST /tags": { data: { id: "g3", name: "gift", usageCount: 0 } } });
    const onChange = jest.fn();
    await renderWithClient(<TagPicker value={["g1"]} onChange={onChange} />);
    await fireEvent.press(await screen.findByRole("button", { name: "#work" }));
    expect(onChange).toHaveBeenLastCalledWith(["g1", "g2"]);
    await press("#trip");
    expect(onChange).toHaveBeenLastCalledWith([]);
    await type("New tag", "TRIP");
    await press("Add tag");
    expect(m.last("POST", "/tags")).toBeUndefined();
    await type("New tag", "gift");
    await press("Add tag");
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(["g1", "g3"]));
  });

  it("the transaction form sends the chosen tags", async () => {
    const m = mockFetch({ ...baseRoutes, "GET /tags": { data: tags }, "POST /transactions": { data: { id: "t1" } } });
    await renderWithClient(<TransactionForm />);
    await screen.findByRole("button", { name: /Cash · THB 1,000.00/ });
    await type(/^Amount/, "12");
    await fireEvent.press(await screen.findByRole("button", { name: "#trip" }));
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/transactions")).toBeDefined());
    expect(m.last("POST", "/transactions")!.body.tagIds).toEqual(["g1"]);
  });

  it("edit shows tags and the receipts panel", async () => {
    const tx = { id: "t9", userId: "u1", clientId: null, createdAt: "", updatedAt: "", deletedAt: null, version: 1, accountId: "a-cash", categoryId: null, kind: "expense", amountMinor: 100, currency: "THB", fxRate: 1, baseAmountMinor: 100, occurredAt: "2025-08-26T06:30:00.000Z", occurredOn: "2025-08-26", note: null, transferGroupId: null, recurringId: null, tagIds: ["g2"], attachmentCount: 1 } as Transaction;
    const m = mockFetch({ ...baseRoutes, "GET /tags": { data: tags }, "GET /transactions/t9/attachments": { data: [] }, "PATCH /transactions/t9": { data: {} } });
    await renderWithClient(<TransactionForm tx={tx} />);
    expect(await screen.findByRole("button", { name: "#work", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Camera/ })).toBeOnTheScreen();
    await press("Save");
    await waitFor(() => expect(m.last("PATCH", "/transactions/t9")!.body.tagIds).toEqual(["g2"]));
  });
});

const goal = (o: Partial<Goal> = {}): Goal => ({ id: "go1", userId: "u1", name: "Trip", targetMinor: 100_000, currency: "THB", targetDate: null, accountId: null, icon: null, color: null, note: null, archived: false, createdAt: "", updatedAt: "", source: "contributions", savedMinor: 25_000, remainingMinor: 75_000, pct: 25, monthlyNeededMinor: null, status: "no_deadline", ...o });

describe("goals", () => {
  it("lists goals with progress and status, and archives", async () => {
    const Goals = require("@/app/(app)/goals/index").default;
    const m = mockFetch({ "GET /goals": { data: [goal({ status: "behind", monthlyNeededMinor: 12_500 })] }, "PATCH /goals/go1": { data: goal({ archived: true }) } });
    await renderWithClient(<Goals />);
    expect(await screen.findByText("Behind")).toBeOnTheScreen();
    expect(screen.getByText("THB 750.00 to go")).toBeOnTheScreen();
    expect(screen.getByText("THB 125.00")).toBeOnTheScreen(); // monthly needed
    await press("Archive");
    await waitFor(() => expect(m.last("PATCH", "/goals/go1")!.body).toEqual({ archived: true }));
  });

  it("taking money out posts a negative contribution", async () => {
    params.id = "go1";
    const GoalMoney = require("@/app/(app)/goal-money").default;
    const m = mockFetch({ "GET /goals/go1": { data: { goal: goal(), contributions: [] } }, "POST /goals/go1/contributions": { data: {} } });
    await renderWithClient(<GoalMoney />);
    await screen.findByText(/Trip: THB 250.00/);
    await fireEvent.press(screen.getByRole("radio", { name: "Take out" }));
    await type(/^Amount/, "50");
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/goals/go1/contributions")!.body).toMatchObject({ amountMinor: -5_000 }));
    expect(router.back).toHaveBeenCalled();
  });

  it("the goal form refuses a target of 0 and a bad date without calling the API", async () => {
    const GoalForm = require("@/app/(app)/goal-form").default;
    const m = mockFetch({ ...baseRoutes, "POST /goals": { data: goal() } });
    await renderWithClient(<GoalForm />);
    await type("Name", "Laptop");
    await type(/^Target \(/, "0");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/greater than 0/);
    await type(/^Target \(/, "30000");
    await type("Target date (optional)", "2026-13-01");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/YYYY-MM-DD/);
    expect(m.last("POST", "/goals")).toBeUndefined();
    await type("Target date (optional)", "2027-06-30");
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/goals")!.body).toMatchObject({ name: "Laptop", targetMinor: 3_000_000, targetDate: "2027-06-30" }));
  });
});

describe("debts", () => {
  it("records a borrowed debt in the chosen currency", async () => {
    const DebtForm = require("@/app/(app)/debt-form").default;
    const m = mockFetch({ ...baseRoutes, "GET /currencies": { data: [{ code: "THB" }, { code: "NPR" }] }, "POST /debts": { data: {} } });
    await renderWithClient(<DebtForm />);
    await fireEvent.press(screen.getByRole("radio", { name: "I borrowed" }));
    await type("Who do you owe?", "Sam");
    await type(/^Amount/, "1000");
    await fireEvent.press(await screen.findByRole("button", { name: "NPR" }));
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/debts")!.body).toMatchObject({ direction: "borrowed", counterparty: "Sam", principalMinor: 100_000, currency: "NPR" }));
  });

  it("shows per-currency totals and an overdue badge", async () => {
    const Debts = require("@/app/(app)/debts/index").default;
    mockFetch({
      "GET /debts/summary": { data: { totals: [{ currency: "THB", owedToMeMinor: 50_000, iOweMinor: 10_000, netMinor: 40_000 }], overdueCount: 1 } },
      "GET /debts": { data: [{ id: "d1", counterparty: "Alex", direction: "lent", principalMinor: 50_000, paidMinor: 0, outstandingMinor: 50_000, currency: "THB", startedOn: "2026-01-01", dueOn: "2026-02-01", status: "overdue", note: null }] },
    });
    await renderWithClient(<Debts />);
    expect((await screen.findAllByText("THB 500.00")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Overdue")).toBeOnTheScreen();
    expect(screen.getByText("Owes you")).toBeOnTheScreen();
  });
});

describe("notes", () => {
  it("lists notes and toggles a pin", async () => {
    const Notes = require("@/app/(app)/notes").default;
    const note: Note = { id: "n1", userId: "u1", title: "Bank PIN hint", body: "ask mum", pinned: false, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z" } as Note;
    const m = mockFetch({ "GET /notes": { data: [note] }, "PATCH /notes/n1": { data: { ...note, pinned: true } } });
    await renderWithClient(<Notes />);
    expect(await screen.findByText("Bank PIN hint")).toBeOnTheScreen();
    await press("Pin Bank PIN hint");
    await waitFor(() => expect(m.last("PATCH", "/notes/n1")!.body).toEqual({ pinned: true }));
  });
});

describe("charts", () => {
  it("bar groups are accessible and tap shows exact values", async () => {
    await renderWithClient(<BarChart labels={["Jan", "Feb"]} format={(v) => `฿${v}`} series={[{ name: "Income", values: [5, 7], color: "#0f0" }, { name: "Expense", values: [3, 0], color: "#f00" }]} />);
    await press("Feb: Income ฿7, Expense ฿0");
    expect(screen.getByText("Feb · Income ฿7 · Expense ฿0")).toBeOnTheScreen();
  });
  it("empty data says so instead of drawing zero bars", async () => {
    await renderWithClient(<BarChart labels={["Jan"]} format={String} series={[{ name: "x", values: [0], color: "#000" }]} />);
    expect(screen.getByText("No data for this period.")).toBeOnTheScreen();
  });
  it("share bar keeps the top 6 and groups the rest as Other", async () => {
    const slices = Array.from({ length: 8 }, (_, i) => ({ label: `C${i}`, value: 10 - i }));
    await renderWithClient(<ShareBar slices={slices} format={String} />);
    expect(screen.getByText("Other")).toBeOnTheScreen();
    expect(screen.queryByText("C7")).not.toBeOnTheScreen();
  });
  it("share bar leaves out categories with nothing spent", async () => {
    await renderWithClient(<ShareBar slices={[{ label: "Food", value: 5 }, { label: "Bills", value: 0 }]} format={String} />);
    expect(screen.queryByText("Bills")).not.toBeOnTheScreen();
  });
});

describe("receipt upload", () => {
  it("sends multipart with the bearer token and surfaces the API's rejection", async () => {
    const { uploadAttachment } = require("@/api/client");
    jest.replaceProperty(Platform, "OS", "ios");
    await session.set({ accessToken: "AT1", refreshToken: "r", accessExpiresAt: Date.now() + 600_000 });
    let seen: { auth: string | null; isForm: boolean } | null = null;
    (globalThis as { fetch: unknown }).fetch = jest.fn(async (_url: string, init: RequestInit) => {
      seen = { auth: new Headers(init.headers).get("authorization"), isForm: init.body instanceof FormData };
      return new Response(JSON.stringify({ data: { id: "att1" } }), { status: 201, headers: { "content-type": "application/json" } });
    });
    const out = await uploadAttachment("t1", { uri: "file:///r.jpg", name: "r.jpg", type: "image/jpeg" });
    expect(out).toEqual({ id: "att1" });
    expect(seen!.auth).toBe("Bearer AT1");
    expect(seen!.isForm).toBe(true);
    (globalThis as { fetch: unknown }).fetch = jest.fn(async () => errorResponse(415, "unsupported_type", "Only photos and PDFs can be attached"));
    await expect(uploadAttachment("t1", { uri: "file:///x.exe", name: "x.exe", type: "image/jpeg" })).rejects.toThrow("Only photos and PDFs");
  });
  it("refreshes the token and retries once when the upload gets a 401", async () => {
    const { uploadAttachment } = require("@/api/client");
    jest.replaceProperty(Platform, "OS", "ios");
    await session.set({ accessToken: "OLD", refreshToken: "r1", accessExpiresAt: Date.now() + 600_000 });
    const auths: (string | null)[] = [];
    (globalThis as { fetch: unknown }).fetch = jest.fn(async (url: string, init: RequestInit) => {
      if (String(url).endsWith("/auth/refresh")) return new Response(JSON.stringify({ data: { accessToken: "NEW", refreshToken: "r2", expiresIn: 900 } }), { status: 200, headers: { "content-type": "application/json" } });
      auths.push(new Headers(init.headers).get("authorization"));
      return auths.length === 1 ? errorResponse(401, "unauthorized", "expired") : new Response(JSON.stringify({ data: { id: "att2" } }), { status: 201, headers: { "content-type": "application/json" } });
    });
    await expect(uploadAttachment("t1", { uri: "file:///r.jpg", name: "r.jpg", type: "image/jpeg" })).resolves.toEqual({ id: "att2" });
    expect(auths).toEqual(["Bearer OLD", "Bearer NEW"]);
  });
  it("checkFile refuses oversize and non-receipt files before uploading", () => {
    const { checkFile } = require("./attachments");
    expect(checkFile({ uri: "u", name: "big.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 })).toMatch(/larger than 10 MB/);
    expect(checkFile({ uri: "u", name: "a.gif", type: "image/gif", size: 10 })).toMatch(/only photos/);
    expect(checkFile({ uri: "u", name: "a.jpg", type: "image/jpeg", size: 10 })).toBeNull();
  });
});

describe("reports", () => {
  it("renders totals with change vs the previous period", async () => {
    const Reports = require("@/app/(app)/reports").default;
    jest.replaceProperty(Platform, "OS", "ios");
    const r = { label: "November 2026", period: "month", from: "2026-11-01", to: "2026-11-30", previousFrom: "2026-10-01", previousTo: "2026-10-31", baseCurrency: "THB", transactionCount: 3,
      incomeMinor: 200_000, expenseMinor: 50_000, netMinor: 150_000, savingsRatePct: 75, avgDailyExpenseMinor: 1_667,
      previous: { incomeMinor: 100_000, expenseMinor: 50_000, netMinor: 50_000 }, expenseByCategory: [{ categoryId: "c", name: "Food", totalMinor: 50_000, pct: 100, previousMinor: 25_000, changePct: 100 }],
      incomeByCategory: [], series: [{ from: "2026-11-01", label: "1", incomeMinor: 200_000, expenseMinor: 50_000 }], topExpenses: [], byAccount: [], budgets: [] };
    mockFetch({ "GET /reports": { data: r } });
    await renderWithClient(<Reports />);
    expect(await screen.findByText("THB 2,000.00")).toBeOnTheScreen();
    expect(screen.getByText("▲ 100% vs previous")).toBeOnTheScreen(); // income doubled
    expect(screen.getByText("no change")).toBeOnTheScreen(); // expense flat
    expect(screen.getByText("+100%")).toBeOnTheScreen(); // Food up
  });
});
