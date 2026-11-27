import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { baseRoutes, me } from "../../test/fixtures";
import { mockFetch, renderWithClient } from "../../test/utils";
import { CurrencyPicker } from "./currency-picker";
import { MyCurrencies } from "./my-currencies";

const ALL = ["THB", "NPR", "USD", "EUR"].map((code) => ({ code, name: code === "EUR" ? "Euro" : code === "USD" ? "US Dollar" : code, symbol: code, minorUnit: 2 }));
const routes = { ...baseRoutes, "GET /currencies": { data: ALL } };

function Harness({ onPick }: { onPick: (c: string) => void }) {
  const [v, setV] = useState("THB");
  return <CurrencyPicker value={v} onChange={(c) => { setV(c); onPick(c); }} />;
}

describe("CurrencyPicker", () => {
  it("shows your currencies, and 'Other…' searches the rest", async () => {
    mockFetch(routes); // me: THB (base), NPR · all: THB, NPR, USD, EUR
    const onPick = jest.fn();
    await renderWithClient(<Harness onPick={onPick} />);
    expect(await screen.findByRole("button", { name: "NPR" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^EUR/ })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Other…" }));
    await fireEvent.changeText(screen.getByLabelText("Search currencies"), "eu");
    expect(screen.queryByRole("button", { name: /^USD/ })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: /^EUR/ }));
    expect(onPick).toHaveBeenLastCalledWith("EUR");
    expect(screen.getByRole("button", { name: "EUR" }).props.accessibilityState.selected).toBe(true); // stays visible once picked
  });
});

describe("MyCurrencies", () => {
  it("adds from the full list and removes; the base currency stays", async () => {
    const m = mockFetch({ ...routes, "PATCH /me": ({ body }: { body: { currencies: string[] } }) => ({ data: { ...me, currencies: body.currencies } }) });
    await renderWithClient(<MyCurrencies />);
    expect(await screen.findByRole("button", { name: "Remove NPR" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Remove THB" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Choose…" }));
    await fireEvent.press(screen.getByRole("button", { name: /^USD/ }));
    await waitFor(() => expect(m.last("PATCH", "/me")!.body).toEqual({ currencies: ["THB", "NPR", "USD"] }));
    await fireEvent.press(screen.getByRole("button", { name: "Remove NPR" }));
    await waitFor(() => expect(m.last("PATCH", "/me")!.body).toEqual({ currencies: ["THB"] }));
  });
});
