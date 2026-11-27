import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useCurrencies, useMe } from "@/api/hooks";
import { radius, useTheme } from "@/theme/theme";
import { Chip, ChipRow, Field, T } from "./ui";

/**
 * Pick a currency: your own currencies as chips, and "Other…" to search every currency. Choosing another one is
 * enough to add it to your list — the API remembers it when the item is saved. `exclude` hides codes (e.g. ones
 * already in a list you're adding to).
 */
export function CurrencyPicker({ value, onChange, label = "Currency", exclude, mineOnly }: { value: string; onChange: (code: string) => void; label?: string; exclude?: string[]; mineOnly?: boolean }) {
  const t = useTheme();
  const me = useMe();
  const all = useCurrencies();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const hide = new Set(exclude ?? []);
  const mine = [...(me.data?.currencies ?? []), ...(value && !me.data?.currencies.includes(value) ? [value] : [])].filter((c) => !hide.has(c));
  const query = q.trim().toLowerCase();
  const others = (all.data ?? [])
    .filter((c) => !mine.includes(c.code) && !hide.has(c.code))
    .filter((c) => !query || c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query))
    .sort((a, b) => a.code.localeCompare(b.code));
  return (
    <View style={{ gap: 8 }}>
      <T tone="muted" size={13} bold>{label}</T>
      <ChipRow wrap>
        {!mineOnly && mine.map((c) => <Chip key={c} label={c} selected={value === c} onPress={() => onChange(c)} />)}
        <Chip label={open ? "Close list" : mineOnly ? "Choose…" : "Other…"} selected={false} onPress={() => setOpen((o) => !o)} />
      </ChipRow>
      {open && (
        <View style={{ gap: 8, borderWidth: 1, borderColor: t.border, borderRadius: radius.md, padding: 10 }}>
          <Field label="Search currencies" value={q} onChangeText={setQ} placeholder="e.g. NPR or rupee" autoCapitalize="none" />
          <View style={{ gap: 2 }}>
            {others.slice(0, 40).map((c) => (
              <Pressable key={c.code} accessibilityRole="button" accessibilityLabel={`${c.code} ${c.name}`} onPress={() => { onChange(c.code); setOpen(false); setQ(""); }}
                style={({ pressed }) => ({ flexDirection: "row", gap: 10, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ color: t.fg, fontWeight: "600", width: 44 }}>{c.code}</Text>
                <Text style={{ color: t.muted, flex: 1 }} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            ))}
            {others.length === 0 && <T tone="muted" size={13}>No currency matches “{q}”.</T>}
            {others.length > 40 && <T tone="muted" size={12}>Type to narrow down {others.length} currencies.</T>}
          </View>
        </View>
      )}
    </View>
  );
}
