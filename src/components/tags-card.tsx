import { useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateTags, useMutate, useTags } from "@/api/hooks";
import type { Tag } from "@/api/types";
import { useTheme } from "@/theme/theme";
import { Button, Card, ErrorText, FadeIn, Field, Skeleton, T, confirmAsync } from "./ui";

/** Tags: labels that cut across categories (#trip, #work). Add, rename, delete. */
export function TagsCard() {
  const t = useTheme();
  const tags = useTags();
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<unknown>(null);
  const create = useMutate((n: string) => call(client.POST("/tags", { body: { name: n } })), invalidateTags, "Tag added");
  const update = useMutate(({ id, n }: { id: string; n: string }) => call(client.PATCH("/tags/{id}", { params: { path: { id } }, body: { name: n } })), invalidateTags, "Tag renamed");
  const remove = useMutate((id: string) => call(client.DELETE("/tags/{id}", { params: { path: { id } } })), invalidateTags, "Tag deleted");

  async function save() {
    setError(null);
    const n = name.trim();
    if (!n) return setError(new Error("Give the tag a name"));
    try { if (editing) await update.mutateAsync({ id: editing.id, n }); else await create.mutateAsync(n); setName(""); setEditing(null); } catch (e) { setError(e); }
  }
  return (
    <Card style={{ gap: 12 }}>
      <View><T bold>Tags</T><T tone="muted" size={12}>Labels across categories, e.g. #trip, #work</T></View>
      <Field label={editing ? `Rename #${editing.name}` : "New tag"} value={name} onChangeText={setName} maxLength={40} autoCapitalize="none" onSubmitEditing={save} />
      <ErrorText error={error} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button small title={editing ? "Save" : "Add tag"} onPress={save} loading={create.isPending || update.isPending} /></View>
        {editing && <View style={{ flex: 1 }}><Button small variant="ghost" title="Cancel" onPress={() => { setEditing(null); setName(""); }} /></View>}
      </View>
      {tags.isPending ? <Skeleton height={40} /> : (tags.data?.length ?? 0) === 0 ? <T tone="muted" size={14}>No tags yet. Add one here or while entering a transaction.</T> : tags.data!.map((tag, i) => (
        <FadeIn key={tag.id} index={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border }}>
          <T style={{ flex: 1 }} numberOfLines={1}><T tone="primary">#</T>{tag.name} <T tone="muted" size={12}>· {tag.usageCount} use{tag.usageCount === 1 ? "" : "s"}</T></T>
          <T tone="primary" size={13} accessibilityRole="button" accessibilityLabel={`Rename tag ${tag.name}`} onPress={() => { setEditing(tag); setName(tag.name); setError(null); }}>Rename</T>
          <T tone="muted" size={13} accessibilityRole="button" accessibilityLabel={`Delete tag ${tag.name}`} onPress={async () => { if (await confirmAsync("Delete tag?", `Delete #${tag.name}? It is removed from ${tag.usageCount} transaction${tag.usageCount === 1 ? "" : "s"}; the transactions themselves stay.`)) remove.mutate(tag.id); }}>Delete</T>
        </FadeIn>
      ))}
    </Card>
  );
}
