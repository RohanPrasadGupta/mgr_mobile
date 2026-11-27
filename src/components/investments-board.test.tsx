import { fireEvent, screen } from "@testing-library/react-native";
import Investments from "@/app/(app)/(tabs)/investments";
import { asset, holding, trade } from "../../test/fixtures";
import { mockFetch, renderWithClient } from "../../test/utils";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock("@/components/portfolio-chart", () => ({ PortfolioChart: () => null }));

const stock = holding({ tradeCount: 3, lastBuyPriceMinor: 43_300, lastSellPriceMinor: 46_000 }, { id: "s1", symbol: "SNLI", currency: "NPR" });
const closed = holding({ quantity: 0, closed: true, tradeCount: 2, remainingCostMinor: 0 }, { id: "s2", symbol: "ILI", currency: "NPR" });
const sip = holding({ tradeCount: 4, contributedMinor: 200_000, remainingCostMinor: 200_000 }, { ...asset({ id: "f1", symbol: "NIBL", class: "fund", tracking: "value", currency: "NPR" }) });
const portfolio = {
  baseCurrency: "THB", asOf: "2026-11-26", investedMinor: 0, marketValueMinor: 0, unrealisedPnlMinor: 0, realisedPnlMinor: 0, dividendsMinor: 0, xirrPct: null, approximate: false, pricedAll: true,
  allocation: [], excluded: [], holdings: [stock, closed, sip],
};

describe("investments board (phone)", () => {
  it("shows Overview with a card per type, and a tab per type with its holdings (closed ones last)", async () => {
    mockFetch({ "GET /investments/portfolio": { data: portfolio }, "GET /investments/trades": { data: [trade({ assetId: "s1", tradedOn: "2026-11-02" })] } });
    await renderWithClient(<Investments />);
    expect((await screen.findAllByRole("tab")).map((t) => t.props.accessibilityLabel)).toEqual(["Overview", "Stock", "Fund / SIP"]);
    expect(screen.getByRole("button", { name: /^Stock capital/ })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /^Fund \/ SIP capital/ })).toBeOnTheScreen();
    expect(screen.getByText(/Stock · SNLI/)).toBeOnTheScreen(); // recent activity
    await fireEvent.press(screen.getByRole("tab", { name: "Stock" }));
    expect(screen.getByRole("button", { name: "+ Add stock" })).toBeOnTheScreen();
    const cards = screen.getAllByRole("button", { name: /^(SNLI|ILI)/ });
    expect(cards.map((c) => c.props.accessibilityLabel)).toEqual(["SNLI", "ILI (closed)"]);
    expect(screen.getByText(/Last buy: NPR\s?433/)).toBeOnTheScreen();
    expect(screen.queryByText("NIBL")).toBeNull(); // other types stay on their own tab
  });
});
