import { budgetDate, dayLabel, formatMoney, monthLabel, monthRange, parseAmount, shiftMonth, toMajor, toMinor, todayLocal } from "./money";

describe("money", () => {
  it("converts major↔minor without float drift", () => {
    expect(toMinor(19.99, "USD")).toBe(1999);
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinor(1500, "JPY")).toBe(1500);
    expect(toMajor(1999, "USD")).toBe(19.99);
  });
  it("formats without Intl, with grouping, a real minus sign and optional plus", () => {
    expect(formatMoney(123456789, "THB")).toBe("THB 1,234,567.89");
    expect(formatMoney(-5000, "USD")).toBe("−USD 50.00");
    expect(formatMoney(5000, "USD", { sign: true })).toBe("+USD 50.00");
    expect(formatMoney(0, "USD", { sign: true })).toBe("USD 0.00");
    expect(formatMoney(1500, "JPY")).toBe("JPY 1,500");
    expect(formatMoney(99, "THB")).toBe("THB 0.99");
  });
  it("parses what people type into amount fields", () => {
    expect(parseAmount("12.50")).toBe(12.5);
    expect(parseAmount("1,234.5")).toBe(1234.5);
    expect(parseAmount(" 7 ")).toBe(7);
    expect(parseAmount(".5")).toBe(0.5);
    for (const bad of ["", "abc", "1.2.3", "-5", "5e3", "1,2,x"]) expect(parseAmount(bad)).toBeNaN();
  });
});

describe("dates", () => {
  it("builds month ranges including leap February", () => {
    expect(monthRange(2024, 2)).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthRange(2025, 12)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
  it("shifts months across years", () => {
    expect(shiftMonth(2025, 1, -1)).toEqual({ year: 2024, month: 12 });
    expect(shiftMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
  });
  it("labels months and days in English without Intl", () => {
    expect(monthLabel(2025, 8)).toBe("August 2025");
    expect(dayLabel("2026-11-24")).toBe("Tue, 24 Nov");
  });
  it("asks for 'today' only in the current month", () => {
    const now = new Date(2025, 7, 15);
    expect(budgetDate(2025, 8, now)).toBeUndefined();
    expect(budgetDate(2025, 7, now)).toBe("2025-07-31");
  });
  it("formats the local date", () => expect(todayLocal(new Date(2025, 0, 5))).toBe("2025-01-05"));
});
