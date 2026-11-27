import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Platform } from "react-native";
import AssetDetail from "@/app/(app)/investments/[id]";
import { holding, trade } from "../../test/fixtures";
import { mockFetch, renderWithClient } from "../../test/utils";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }, useLocalSearchParams: () => ({ id: "as1" }) }));

const routes = (extra: Record<string, unknown> = {}) => ({
  "GET /investments/assets/as1": { data: holding() },
  "GET /investments/trades": { data: [trade(), trade({ id: "tr2", tradedOn: "2025-02-01", quantity: 5 })] },
  "GET /investments/assets/as1/prices": { data: [] },
  ...extra,
});

describe("asset trades list", () => {
  it("each row has Edit (opens that entry) and Delete (confirms, then deletes exactly that entry)", async () => {
    const m = mockFetch(routes({ "DELETE /investments/trades/tr2": null }));
    await renderWithClient(<AssetDetail />);
    fireEvent.press(await screen.findByTestId("edit-tr1"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/trade", params: { assetId: "as1", tradeId: "tr1" } });
    (globalThis as { confirm?: () => boolean }).confirm = jest.fn(() => true);
    jest.replaceProperty(Platform, "OS", "web");
    fireEvent.press(screen.getByTestId("delete-tr2"));
    await waitFor(() => expect(m.calls.some((c) => c.method === "DELETE" && c.path === "/investments/trades/tr2")).toBe(true));
    expect(m.calls.some((c) => c.method === "DELETE" && c.path === "/investments/trades/tr1")).toBe(false);
  });
});
