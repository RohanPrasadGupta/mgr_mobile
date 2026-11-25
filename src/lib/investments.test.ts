import { CLASSES, TYPES_FOR, defaultTracking, freqLabel, isInflow } from "./investments";
import { formatPct, formatQty, formatUnitPrice } from "./money";

describe("investment helpers", () => {
  it("tracks market instruments by units and pooled money by value (mirrors the API)", () => {
    for (const c of ["stock", "crypto", "gold"] as const) expect(defaultTracking(c)).toBe("units");
    for (const c of ["fund", "retirement", "fixed_deposit", "other"] as const) expect(defaultTracking(c)).toBe("value");
    expect(CLASSES).toHaveLength(7);
  });
  it("offers only valid trade types per tracking mode", () => {
    expect(TYPES_FOR.units.map((t) => t.value)).toEqual(["buy", "sell", "bonus", "dividend", "fee"]);
    expect(TYPES_FOR.value.map((t) => t.value)).toEqual(["contribution", "withdrawal", "dividend", "fee"]);
  });
  it("treats money back to the investor as inflow", () => {
    for (const t of ["sell", "dividend", "withdrawal"] as const) expect(isInflow(t)).toBe(true);
    for (const t of ["buy", "contribution", "fee", "bonus"] as const) expect(isInflow(t)).toBe(false);
  });
  it("labels recurrence", () => {
    expect(freqLabel("monthly", 1)).toBe("Every month");
    expect(freqLabel("weekly", 2)).toBe("Every 2 weeks");
  });
});

describe("investment formatting", () => {
  it("shows fractional unit prices without padding noise", () => {
    expect(formatUnitPrice(15_000, "THB")).toBe("THB 150.00");
    expect(formatUnitPrice(12_345.6789, "USD")).toBe("USD 123.4568");
    expect(formatUnitPrice(1_500, "JPY")).toBe("JPY 1,500");
    expect(formatUnitPrice(100_050, "THB")).toBe("THB 1,000.50");
  });
  it("trims quantities and percentages", () => {
    expect(formatQty(15)).toBe("15");
    expect(formatQty(1.5)).toBe("1.5");
    expect(formatQty(1234567.12345678)).toBe("1,234,567.12345678");
    expect(formatPct(null)).toBe("—");
    expect(formatPct(12.34, true)).toBe("+12.3%");
    expect(formatPct(-3)).toBe("-3.0%");
  });
});
