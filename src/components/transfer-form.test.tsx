import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { bank, baseRoutes, cash, npr, usd } from "../../test/fixtures";
import { mockFetch, renderWithClient } from "../../test/utils";
import { TransferForm } from "./transfer-form";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
beforeEach(() => (router.back as jest.Mock).mockClear());

const routes = (accounts: unknown[] = [cash, bank, npr, usd]) => ({ ...baseRoutes, "GET /accounts": { data: accounts }, "POST /transfers": { data: { transferGroupId: "g1", legs: [] } } });
const press = async (name: string | RegExp) => { await fireEvent.press(screen.getByRole("button", { name })); };
/** Each account appears in both the From and the To row; the To row is rendered second. */
const pressTo = async (name: RegExp) => { await fireEvent.press(screen.getAllByRole("button", { name }).at(-1)!); };
const type = async (label: string | RegExp, v: string) => { await fireEvent.changeText(screen.getByLabelText(label), v); };
/** Accounts load asynchronously: wait until the defaults (From = Cash, To = Bank) are actually selected. */
const ready = async () => {
  await screen.findByRole("button", { name: /Cash · THB 1,000.00/ });
  await waitFor(() => expect(screen.getByRole("button", { name: /Bank · THB 500.00/, selected: true })).toBeOnTheScreen());
};

describe("TransferForm", () => {
  it("defaults to the first two accounts and sends a same-currency transfer without a received amount", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<TransferForm />);
    await ready();
    expect(screen.queryByLabelText(/Amount received/)).not.toBeOnTheScreen();
    await type(/^Amount sent/, "400");
    await type("Note", "top-up");
    await press("Transfer");
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const body = m.last("POST", "/transfers")!.body;
    expect(body).toMatchObject({ fromAccountId: cash.id, toAccountId: bank.id, amountMinor: 40_000, note: "top-up" });
    expect(body.toAmountMinor).toBeUndefined();
  });

  it("preselects the account it was opened from", async () => {
    mockFetch(routes());
    await renderWithClient(<TransferForm defaultFrom={bank.id} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Bank · THB 500.00/, selected: true })).toBeOnTheScreen());
    expect(screen.getByRole("button", { name: /Cash · THB 1,000.00/, selected: true })).toBeOnTheScreen(); // To moved off the From account
  });

  it("requires the received amount across currencies, shows the implied rate, and sends toAmountMinor", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<TransferForm />);
    await ready();
    await pressTo(new RegExp(npr.name)); // To: NPR wallet
    await type(/^Amount sent/, "100");
    await press("Transfer");
    expect(await screen.findByRole("alert")).toHaveTextContent(/how much NPR arrives/);
    expect(m.last("POST", "/transfers")).toBeUndefined();
    await type(/^Amount received/, "400");
    expect(screen.getByText(/1 THB = 4\.0000 NPR/)).toBeOnTheScreen();
    await press("Transfer");
    await waitFor(() => expect(m.last("POST", "/transfers")).toBeDefined());
    expect(m.last("POST", "/transfers")!.body).toMatchObject({ amountMinor: 10_000, toAmountMinor: 40_000, toAccountId: npr.id });
  });

  it("shows the FX field only when exactly one side is outside the base currency", async () => {
    mockFetch(routes());
    await renderWithClient(<TransferForm />);
    await ready();
    expect(screen.queryByLabelText(/Exchange rate/)).not.toBeOnTheScreen(); // THB → THB
    await pressTo(new RegExp(npr.name));
    expect(await screen.findByLabelText(/Exchange rate NPR → THB/)).toBeOnTheScreen(); // THB → NPR
    await pressTo(new RegExp(usd.name)); // THB → USD: still exactly one side foreign, now quoted for USD
    expect(screen.getByLabelText(/Exchange rate USD → THB/)).toBeOnTheScreen();
  });

  it("warns, without blocking, when the amount exceeds the balance", async () => {
    mockFetch(routes());
    await renderWithClient(<TransferForm />);
    await ready();
    await type(/^Amount sent/, "999999");
    expect(screen.getByText(/more than the account's current balance/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Transfer" })).toBeEnabled();
  });

  it("rejects an impossible date and explains when fewer than two accounts exist", async () => {
    mockFetch(routes());
    await renderWithClient(<TransferForm />);
    await ready();
    await type(/^Amount sent/, "5");
    await type("Date", "2025-02-31");
    await press("Transfer");
    expect(await screen.findByRole("alert")).toHaveTextContent(/YYYY-MM-DD/);
  });

  it("explains when fewer than two accounts exist", async () => {
    mockFetch(routes([cash]));
    await renderWithClient(<TransferForm />);
    expect(await screen.findByText(/at least two active accounts/)).toBeOnTheScreen();
  });
});
