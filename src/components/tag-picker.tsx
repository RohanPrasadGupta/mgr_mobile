import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateTags, useMutate, useTags } from "@/api/hooks";
import { radius, useTheme } from "@/theme/theme";
import { T } from "./ui";

/** Toggleable tag chips plus an inline "new tag" field. Controlled: `value` is the selected tag ids. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const t = useTheme();
  const tags = useTags();
  const [draft, setDraft] = useState("");
  const create = useMutate((name: string) => call(client.POST("/tags", { body: { name } })), invalidateTags);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  async function add() {
    const name = draft.trim();
    if (!name) return;
    const existing = tags.data?.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (existing) { if (!value.includes(existing.id)) onChange([...value, existing.id]); setDraft(""); return; }
    try { const res = await create.mutateAsync(name); onChange([...value, res.data.id]); setDraft(""); } catch { /* failure toast already shown */ }
  }

  return (
    <View style={{ gap: 8 }}>
      <T tone="muted" size={13} bold>Tags</T>
      {(tags.data?.length ?? 0) > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {tags.data!.map((tag) => {
            const on = value.includes(tag.id);
            return (
              <Pressable key={tag.id} accessibilityRole="button" accessibilityLabel={`#${tag.name}`} accessibilityState={{ selected: on }} onPress={() => toggle(tag.id)}
                style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: on ? t.primary : t.border, backgroundColor: on ? `${t.primary}22` : "transparent", paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: on ? t.primary : t.muted, fontSize: 13, fontWeight: "600" }}>#{tag.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput value={draft} onChangeText={setDraft} maxLength={40} placeholder="New tag" placeholderTextColor={t.muted} accessibilityLabel="New tag" onSubmitEditing={() => void add()} autoCapitalize="none"
          style={{ flex: 1, color: t.fg, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Add tag" disabled={!draft.trim() || create.isPending} onPress={() => void add()}
          style={{ justifyContent: "center", paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, opacity: !draft.trim() ? 0.5 : 1 }}>
          <T bold size={14}>Add</T>
        </Pressable>
      </View>
    </View>
  );
}
