import type { AssetClass, TradeType } from "@/api/types";

export const CLASS_LABEL: Record<AssetClass, string> = { stock: "Stock", crypto: "Crypto", fund: "Fund / SIP", retirement: "Retirement", gold: "Gold", fixed_deposit: "Fixed deposit", other: "Other" };
export const CLASSES = Object.keys(CLASS_LABEL) as AssetClass[];
/** Board tab order, and each class's colour as an index into the theme's chart palette (same colours as the web app). */
export const CLASS_ORDER: AssetClass[] = ["stock", "crypto", "fund", "retirement", "gold", "fixed_deposit", "other"];
export const CLASS_CHART: Record<AssetClass, number> = { stock: 0, crypto: 2, fund: 4, retirement: 3, gold: 6, fixed_deposit: 1, other: 5 };
export const defaultTracking = (c: AssetClass): "units" | "value" => (c === "stock" || c === "crypto" || c === "gold" ? "units" : "value");

export const TYPES_FOR: Record<"units" | "value", { value: TradeType; label: string }[]> = {
  units: [{ value: "buy", label: "Buy" }, { value: "sell", label: "Sell" }, { value: "bonus", label: "Bonus shares" }, { value: "dividend", label: "Dividend" }, { value: "fee", label: "Fee" }],
  value: [{ value: "contribution", label: "Contribution" }, { value: "withdrawal", label: "Withdrawal" }, { value: "dividend", label: "Dividend / interest" }, { value: "fee", label: "Fee" }],
};
export const TYPE_LABEL: Record<TradeType, string> = { buy: "Buy", sell: "Sell", dividend: "Dividend", bonus: "Bonus", fee: "Fee", contribution: "Contribution", withdrawal: "Withdrawal" };
/** Money flowing back to the investor is shown positive. */
export const isInflow = (t: TradeType) => t === "sell" || t === "dividend" || t === "withdrawal";

import type { Frequency } from "@/api/types";
const UNIT: Record<Frequency, string> = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
export const freqLabel = (f: Frequency, n: number) => (n === 1 ? `Every ${UNIT[f]}` : `Every ${n} ${UNIT[f]}s`);
