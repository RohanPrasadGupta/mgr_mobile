import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Platform } from "react-native";
import type { Transaction } from "@/api/types";
import { baseRoutes, npr } from "../../test/fixtures";
import { errorResponse, mockFetch, renderWithClient } from "../../test/utils";
import { TransactionForm, newId, toInstant } from "./transaction-form";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
beforeEach(() => (router.back as jest.Mock).mockClear());

const routes = (extra: Record<string, unknown> = {}) => ({ ...baseRoutes, "POST /transactions": { data: { id: "t1" } }, ...extra });
const tx: Transaction = { id: "t9", userId: "u1", clientId: null, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z", deletedAt: null, version: 1, accountId: "a-cash", categoryId: "c-food", kind: "expense", amountMinor: 12_345, currency: "THB", fxRate: 1, baseAmountMinor: 12_345, occurredAt: "2025-08-26T06:30:00.000Z", occurredOn: "2025-08-26", note: "lunch", transferGroupId: null, recurringId: null, tagIds: [], attachmentCount: 0 };
const press = async (name: string | RegExp) => { await fireEvent.press(screen.getByRole("button", { name })); };
const accountsLoaded = () => screen.findByRole("button", { name: /Cash · THB 1,000.00/ });

describe("toInstant", () => {
  it("combines a real date and time, and rejects impossible dates", () => {
    expect(toInstant("2025-08-26", "13:05")).toBe(new Date(2025, 7, 26, 13, 5).toISOString());
    expect(toInstant("2025-02-31", "10:00")).toBeNull(); // would silently roll into March
    expect(toInstant("26/08/2025", "10:00")).toBeNull();
    expect(toInstant("", "10:00")).toBeNull();
  });
  it("newId yields RFC 4122 v4 ids", () => expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
});

describe("TransactionForm — add", () => {
  it("posts an expense in minor units with the chosen category and a client id", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<TransactionForm />);
    await accountsLoaded();
    await fireEvent.changeText(screen.getByLabelText(/^Amount/), "123.45");
    await press("Food");
    await fireEvent.changeText(screen.getByLabelText("Note"), "pad thai");
    await press("Save");
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const body = m.last("POST", "/transactions")!.body;
    expect(body).toMatchObject({ accountId: "a-cash", kind: "expense", amountMinor: 12_345, categoryId: "c-food", note: "pad thai" });
    expect(body.clientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.fxRate).toBeUndefined();
  });

  it("refuses zero or garbage amounts without calling the API", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<TransactionForm />);
    await accountsLoaded();
    for (const bad of ["0", "abc", ""]) {
      await fireEvent.changeText(screen.getByLabelText(/^Amount/), bad);
      await press("Save");
      expect(await screen.findByRole("alert")).toHaveTextContent(/greater\ than\ 0/);
    }
    expect(m.last("POST", "/transactions")).toBeUndefined();
  });

  it("rejects a date that is not real", async () => {
    mockFetch(routes());
    await renderWithClient(<TransactionForm />);
    await accountsLoaded();
    await fireEvent.changeText(screen.getByLabelText(/^Amount/), "5");
    await fireEvent.changeText(screen.getByLabelText("Date"), "2025-02-31");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/YYYY\-MM\-DD/);
  });

  it("only offers categories of the selected type", async () => {
    mockFetch(routes());
    await renderWithClient(<TransactionForm />);
    await accountsLoaded();
    expect(screen.getByRole("button", { name: "Food" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Salary" })).not.toBeOnTheScreen();
    await press("Income");
    expect(screen.getByRole("button", { name: "Salary" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Food" })).not.toBeOnTheScreen();
  });

  it("asks for an FX rate only for accounts outside the base currency, and sends it", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<TransactionForm />);
    await accountsLoaded();
    expect(screen.queryByLabelText(/Exchange rate/)).not.toBeOnTheScreen();
    await press(new RegExp(npr.name));
    await fireEvent.changeText(await screen.findByLabelText(/Exchange rate NPR → THB/), "0.25");
    await fireEvent.changeText(screen.getByLabelText(/^Amount \(NPR\)/), "400");
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/transactions")).toBeDefined());
    expect(m.last("POST", "/transactions")!.body).toMatchObject({ accountId: npr.id, amountMinor: 40_000, fxRate: 0.25 });
  });

  it("shows the API's reason when saving fails and stays on the form", async () => {
    mockFetch(routes({ "POST /transactions": () => errorResponse(422, "fx_rate_required", "No FX rate available for NPR→THB") }));
    await renderWithClient(<TransactionForm />);
    await accountsLoaded();
    await fireEvent.changeText(screen.getByLabelText(/^Amount/), "5");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/No\ FX\ rate/);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("refreshes balances, insights and budgets after saving", async () => {
    mockFetch(routes());
    const { client } = await renderWithClient(<TransactionForm />);
    const spy = jest.spyOn(client, "invalidateQueries");
    await accountsLoaded();
    await fireEvent.changeText(screen.getByLabelText(/^Amount/), "5");
    await press("Save");
    await waitFor(() => expect(spy.mock.calls.map((c) => (c[0]!.queryKey as string[])[0])).toEqual(expect.arrayContaining(["transactions", "accounts", "insights", "budgets"])));
  });
});

describe("TransactionForm — edit", () => {
  it("prefills, patches only editable fields, and deletes after confirming", async () => {
    const m = mockFetch(routes({ "PATCH /transactions/t9": { data: {} }, "DELETE /transactions/t9": null }));
    await renderWithClient(<TransactionForm tx={tx} />);
    expect(screen.getByLabelText(/^Amount/).props.value).toBe("123.45");
    expect(screen.getByLabelText("Note").props.value).toBe("lunch");
    expect(screen.queryByText("Account")).not.toBeOnTheScreen(); // the account can't change
    await fireEvent.changeText(screen.getByLabelText(/^Amount/), "200");
    await press("Save");
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(m.last("PATCH", "/transactions/t9")!.body).toMatchObject({ amountMinor: 20_000, categoryId: "c-food", note: "lunch" });

    (globalThis as { confirm?: () => boolean }).confirm = jest.fn(() => true);
    jest.replaceProperty(Platform, "OS", "web"); // confirmAsync uses window.confirm on web
    await press("Delete");
    await waitFor(() => expect(m.last("DELETE", "/transactions/t9")).toBeDefined());
  });

  it("treats transfers as date/note-only", async () => {
    const m = mockFetch(routes({ "PATCH /transactions/t9": { data: {} } }));
    await renderWithClient(<TransactionForm tx={{ ...tx, kind: "transfer_out", categoryId: null, transferGroupId: "g1" }} />);
    expect(screen.queryByLabelText(/^Amount/)).not.toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("Note"), "moved");
    await press("Save");
    await waitFor(() => expect(m.last("PATCH", "/transactions/t9")).toBeDefined());
    const body = m.last("PATCH", "/transactions/t9")!.body;
    expect(body.note).toBe("moved");
    expect(body).not.toHaveProperty("amountMinor");
    expect(body).not.toHaveProperty("categoryId");
  });
});
