import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { baseRoutes, me } from "../../test/fixtures";
import { mockFetch, renderWithClient } from "../../test/utils";
import { GetStarted } from "./get-started";
import { PortfolioChart } from "./portfolio-chart";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
beforeEach(() => (router.push as jest.Mock).mockClear());
const fresh = { "GET /transactions": { data: [], meta: { nextCursor: null } }, "GET /budgets/status": { data: { date: "2026-11-25", baseCurrency: "THB", items: [] } }, "GET /goals": { data: [] } };

describe("GetStarted (mobile)", () => {
  it("lists what's left from real data and takes the user to each step", async () => {
    mockFetch({ ...baseRoutes, "GET /me": { data: { ...me, emailVerified: false } }, ...fresh });
    await renderWithClient(<GetStarted />);
    expect(await screen.findByText("1 of 5 done — a few minutes to set things up.")).toBeOnTheScreen(); // accounts exist
    await fireEvent.press(screen.getByRole("button", { name: "Add transaction" }));
    expect(router.push).toHaveBeenCalledWith("/transaction/new");
    await fireEvent.press(screen.getByRole("button", { name: "Create budget" }));
    expect(router.push).toHaveBeenCalledWith("/budget-new");
  });
  it("hides when dismissed, and remembers it for this user", async () => {
    mockFetch({ ...baseRoutes, ...fresh });
    await renderWithClient(<GetStarted />);
    await fireEvent.press(await screen.findByRole("button", { name: "Hide the get started checklist" }));
    await waitFor(() => expect(screen.queryByText(/of 5 done/)).not.toBeOnTheScreen());
    const store = (globalThis as { __secureStore?: Map<string, string> }).__secureStore!;
    await waitFor(() => expect(store.get("moneymgr.getStarted.hidden.u1")).toBe("1"));
  });
});

describe("PortfolioChart (mobile)", () => {
  it("shows value vs invested per month and the change over the range", async () => {
    const m = mockFetch({ "GET /investments/portfolio/history": { data: { baseCurrency: "THB", asOf: "2026-11-25", approximate: true, excluded: [], points: [
      { date: "2026-09-30", valueMinor: 15_000, investedMinor: 15_000 }, { date: "2026-11-25", valueMinor: 18_000, investedMinor: 15_000 }] } } });
    await renderWithClient(<PortfolioChart />);
    expect(await screen.findByText("+THB 30.00 (+20.0%)")).toBeOnTheScreen(); // gain over invested, not raw growth
    expect(screen.getByRole("button", { name: "Nov: Value THB 180.00, Invested THB 150.00" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "3Y" }));
    await waitFor(() => expect(m.calls.at(-1)!.path).toBe("/investments/portfolio/history"));
    expect(m.fn.mock.calls.length).toBeGreaterThan(1);
  });
});
