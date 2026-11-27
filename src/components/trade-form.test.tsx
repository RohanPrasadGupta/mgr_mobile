import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { asset, holding, trade } from "../../test/fixtures";
import { errorResponse, mockFetch, renderWithClient } from "../../test/utils";
import { TradeForm } from "./trade-form";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
beforeEach(() => (router.back as jest.Mock).mockClear());

const press = async (name: string | RegExp) => { await fireEvent.press(screen.getByRole("button", { name })); };
const type = async (label: string | RegExp, v: string) => { await fireEvent.changeText(screen.getByLabelText(label), v); };

describe("TradeForm — unit assets", () => {
  it("buys: sends quantity and price per unit in minor units and previews the total", async () => {
    const m = mockFetch({ "POST /investments/trades": { data: {} } });
    await renderWithClient(<TradeForm holding={holding()} />);
    await type("Quantity", "10");
    await type(/^Price per unit/, "100.50");
    expect(screen.getByText("Total THB 1,005.00")).toBeOnTheScreen();
    await type("Date", "2025-01-01");
    await press("Save");
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const body = m.last("POST", "/investments/trades")!.body;
    expect(body).toMatchObject({ assetId: "as1", type: "buy", quantity: 10, priceMinor: 10_050, tradedOn: "2025-01-01", feeMinor: 0 });
    expect(body.amountMinor).toBeUndefined(); // the API derives the total
    expect(body.clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("shows the API's oversell error and stays on the form", async () => {
    mockFetch({ "POST /investments/trades": () => errorResponse(422, "insufficient_quantity", "Not enough units held on that date to sell") });
    await renderWithClient(<TradeForm holding={holding()} />);
    await fireEvent.press(screen.getByRole("radio", { name: "Sell" }));
    await type("Quantity", "999");
    await type(/^Price per unit/, "10");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Not enough units/);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("validates locally: quantity, price and date", async () => {
    const m = mockFetch({});
    await renderWithClient(<TradeForm holding={holding()} />);
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/quantity greater than 0/);
    await type("Quantity", "1");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/price greater than 0/);
    await type(/^Price per unit/, "1");
    await type("Date", "tomorrow");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/YYYY-MM-DD/);
    expect(m.fn).not.toHaveBeenCalled();
  });

  it("every buy has a 'use for average' switch (on by default, any cost method); bonus shares don't", async () => {
    const m = mockFetch({ "POST /investments/trades": { data: {} } });
    await renderWithClient(<TradeForm holding={holding()} />); // weighted average
    const sw = screen.getByLabelText("Use for average price");
    expect(sw.props.value).toBe(true);
    await fireEvent(sw, "valueChange", false);
    await type("Quantity", "2");
    await type(/^Price per unit/, "10");
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/investments/trades")!.body).toMatchObject({ type: "buy", includeInAvg: false }));
  });

  it("bonus shares need only a quantity, and have no average switch", async () => {
    const m = mockFetch({ "POST /investments/trades": { data: {} } });
    await renderWithClient(<TradeForm holding={holding()} />);
    await fireEvent.press(screen.getByRole("radio", { name: "Bonus shares" }));
    expect(screen.queryByLabelText("Use for average price")).not.toBeOnTheScreen();
    await type("Quantity", "5");
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/investments/trades")).toBeDefined());
    expect(m.last("POST", "/investments/trades")!.body).toMatchObject({ type: "bonus", quantity: 5 });
  });
});

describe("TradeForm — value assets", () => {
  const sip = holding({ quantity: 0 }, { tracking: "value", class: "fund", symbol: "GROWTH-SIP" });
  it("offers contribution/withdrawal and sends the amount and fee", async () => {
    const m = mockFetch({ "POST /investments/trades": { data: {} } });
    await renderWithClient(<TradeForm holding={sip} />);
    expect(screen.queryByRole("radio", { name: "Buy" })).not.toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Contribution" }).props.accessibilityState.checked).toBe(true);
    await type(/^Amount/, "1000");
    await type(/^Fee \/ charge/, "5");
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/investments/trades")).toBeDefined());
    expect(m.last("POST", "/investments/trades")!.body).toMatchObject({ type: "contribution", amountMinor: 100_000, feeMinor: 500 });
  });
});

describe("TradeForm — edit", () => {
  it("prefills and patches; the type is a radio group and only sent when it changes", async () => {
    const m = mockFetch({ "PATCH /investments/trades/tr1": { data: {} } });
    await renderWithClient(<TradeForm holding={holding()} trade={trade()} />);
    expect(screen.getByLabelText("Quantity").props.value).toBe("10");
    expect(screen.getByLabelText(/^Price per unit/).props.value).toBe("100");
    expect(screen.getByRole("radio", { name: "Buy" }).props.accessibilityState.checked).toBe(true);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull(); // delete is on the trades list now
    await type("Quantity", "12");
    await press("Save");
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const first = m.last("PATCH", "/investments/trades/tr1")!.body;
    expect(first).toMatchObject({ quantity: 12, priceMinor: 10_000 });
    expect(first.type).toBeUndefined();
  });

  it("turns a buy into a sell", async () => {
    const m = mockFetch({ "PATCH /investments/trades/tr1": { data: {} } });
    await renderWithClient(<TradeForm holding={holding()} trade={trade()} />);
    await fireEvent.press(screen.getByRole("radio", { name: "Sell" }));
    expect(screen.getByRole("radio", { name: "Sell" }).props.accessibilityState.checked).toBe(true);
    await press("Save");
    await waitFor(() => expect(m.last("PATCH", "/investments/trades/tr1")!.body).toMatchObject({ type: "sell", quantity: 10, priceMinor: 10_000 }));
    expect(asset().symbol).toBe("PTT");
  });
});
