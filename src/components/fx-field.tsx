import { useEffect, useState } from "react";
import { View } from "react-native";
import { useFxQuote } from "@/api/hooks";
import { lastFxRate } from "@/lib/fx-memory";
import { formatMoney, isDate, parseAmount, toMinor } from "@/lib/money";
import { Chip, Field, T } from "./ui";

const fmtRate = (r: number) => (r >= 100 ? r.toFixed(2) : r >= 1 ? r.toFixed(4) : r.toPrecision(4));

/**
 * Exchange-rate input for a foreign-currency amount. Shows the stored daily rate used when left empty (or that none exists),
 * previews the converted amount, and offers the last rate typed on this device for the pair.
 */
export function FxField({ from, to, date, value, onChange, amount }: { from: string; to: string; date: string; value: string; onChange: (v: string) => void; amount?: number }) {
  const quote = useFxQuote(from, to, isDate(date) ? date : undefined);
  const [last, setLast] = useState<number | null>(null);
  useEffect(() => { let alive = true; void lastFxRate(from, to).then((r) => alive && setLast(r)); return () => { alive = false; }; }, [from, to]);
  const typed = parseAmount(value) > 0 ? parseAmount(value) : null;
  const effective = typed ?? quote.data?.rate ?? null;
  const converted = effective && amount && amount > 0 ? formatMoney(toMinor(amount * effective, to), to) : null;
  const hint = quote.isPending ? "Looking up the stored rate…"
    : quote.data ? `Empty = stored rate 1 ${from} = ${fmtRate(quote.data.rate)} ${to} (${quote.data.approximate ? "approximate, " : ""}as of ${quote.data.asOf})`
      : `No stored ${from}→${to} rate for this date — enter the rate you got.`;
  return (
    <View style={{ gap: 8 }}>
      <Field label={`Exchange rate ${from} → ${to}`} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder={quote.data ? fmtRate(quote.data.rate) : "e.g. 0.25"} hint={hint} />
      {(last !== null && String(last) !== value) || (quote.data && value) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {last !== null && String(last) !== value && <Chip label={`Use last: ${fmtRate(last)}`} onPress={() => onChange(String(last))} />}
          {quote.data && !!value && <Chip label="Use stored rate" onPress={() => onChange("")} />}
        </View>
      ) : null}
      {converted && <T tone="muted" size={13}>≈ <T bold size={13}>{converted}</T>{typed ? " at your rate" : " at the stored rate"}</T>}
    </View>
  );
}
