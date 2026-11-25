import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { baseRoutes, rule } from "../../test/fixtures";
import { errorResponse, mockFetch, renderWithClient } from "../../test/utils";
import { RecurringForm } from "./recurring-form";
import { todayLocal } from "@/lib/money";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
beforeEach(() => (router.back as jest.Mock).mockClear());

const routes = (extra: Record<string, unknown> = {}) => ({ ...baseRoutes, "POST /recurring": { data: {} }, "PATCH /recurring/r1": { data: {} }, ...extra });
const press = async (name: string | RegExp) => { await fireEvent.press(screen.getByRole("button", { name })); };
const type = async (label: string | RegExp, v: string) => { await fireEvent.changeText(screen.getByLabelText(label), v); };
const ready = () => screen.findByRole("button", { name: /Cash \(THB\)/ });

describe("RecurringForm", () => {
  it("creates a monthly expense in minor units", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<RecurringForm />);
    await ready();
    await type(/^Amount/, "99");
    await press("Food");
    await type("Note", "Netflix");
    await type("Start date", "2030-01-05");
    await press("Save");
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(m.last("POST", "/recurring")!.body).toMatchObject({ accountId: "a-cash", kind: "expense", amountMinor: 9_900, categoryId: "c-food", note: "Netflix", frequency: "monthly", interval: 1, startOn: "2030-01-05", backfill: false });
  });

  it("offers to record missed dates only when the start date is in the past, and sends the choice", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<RecurringForm />);
    await ready();
    expect(screen.queryByRole("button", { name: /missed dates/ })).not.toBeOnTheScreen();
    await type("Start date", "2024-01-05");
    await press(/missed dates/);
    await type(/^Amount/, "5");
    await press("Save");
    await waitFor(() => expect(m.last("POST", "/recurring")).toBeDefined());
    expect(m.last("POST", "/recurring")!.body).toMatchObject({ startOn: "2024-01-05", backfill: true });
    expect(todayLocal() > "2024-01-05").toBe(true);
  });

  it("validates amount, interval and dates locally", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<RecurringForm />);
    await ready();
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/amount greater than 0/);
    await type(/^Amount/, "5");
    await type("Every", "0");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/between 1 and 365/);
    await type("Every", "2");
    await type("End date", "next year");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/end date/);
    expect(m.last("POST", "/recurring")).toBeUndefined();
  });

  it("edits only what the API allows (no account/start date) and clears optional fields with null", async () => {
    const m = mockFetch(routes());
    await renderWithClient(<RecurringForm rule={rule({ endOn: "2030-01-01" })} />);
    expect(screen.queryByLabelText("Start date")).not.toBeOnTheScreen();
    expect(screen.getByLabelText(/^Amount/).props.value).toBe("5000");
    await type("Note", "");
    await type("End date", "");
    await press("Save");
    await waitFor(() => expect(m.last("PATCH", "/recurring/r1")).toBeDefined());
    expect(m.last("PATCH", "/recurring/r1")!.body).toEqual({ amountMinor: 500_000, categoryId: "c-rent", note: null, frequency: "monthly", interval: 1, endOn: null });
  });

  it("shows the API's reason and stays on the form", async () => {
    mockFetch(routes({ "POST /recurring": () => errorResponse(422, "nothing_to_schedule", "No occurrence falls between today and endOn") }));
    await renderWithClient(<RecurringForm />);
    await ready();
    await type(/^Amount/, "5");
    await press("Save");
    expect(await screen.findByRole("alert")).toHaveTextContent(/No occurrence falls/);
    expect(router.back).not.toHaveBeenCalled();
  });
});
