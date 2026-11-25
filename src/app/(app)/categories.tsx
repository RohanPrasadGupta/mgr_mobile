import { useState } from "react";
import { View } from "react-native";
import { call, client } from "@/api/client";
import { useCategories, useMutate } from "@/api/hooks";
import type { Category } from "@/api/types";
import { TagsCard } from "@/components/tags-card";
import { Button, Card, Empty, ErrorText, FadeIn, Field, ListSkeleton, Screen, Segmented, T, confirmAsync } from "@/components/ui";
import { useTheme } from "@/theme/theme";

const refresh = (qc: import("@tanstack/react-query").QueryClient) => qc.invalidateQueries({ queryKey: ["categories"] });

export default function Categories() {
  const t = useTheme();
  const cats = useCategories();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState<unknown>(null);
  const create = useMutate(() => call(client.POST("/categories", { body: { name: name.trim(), kind, icon: icon.trim() || undefined } })), refresh, "Category added");
  const update = useMutate(() => call(client.PATCH("/categories/{id}", { params: { path: { id: editing!.id } }, body: { name: name.trim(), ...(icon.trim() ? { icon: icon.trim() } : {}) } })), refresh, "Category updated");
  const remove = useMutate((id: string) => call(client.DELETE("/categories/{id}", { params: { path: { id } } })), refresh, "Category deleted");

  async function save() {
    setError(null);
    if (!name.trim()) return setError(new Error("Give the category a name"));
    try { await (editing ? update : create).mutateAsync(undefined as never); setName(""); setIcon(""); setEditing(null); } catch (e) { setError(e); }
  }
  const shown = cats.data?.filter((c) => c.kind === kind && !c.archived) ?? [];
  return (
    <Screen edges={[]}>
      <Segmented value={kind} onChange={(k) => { setKind(k); setEditing(null); setName(""); setIcon(""); }} options={[{ value: "expense", label: "Expense", tone: "expense" }, { value: "income", label: "Income", tone: "income" }]} />
      <Card style={{ gap: 12 }}>
        <T bold>{editing ? `Edit “${editing.name}”` : `New ${kind} category`}</T>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Icon (emoji)" value={icon} onChangeText={setIcon} maxLength={8} hint="Optional" />
        <ErrorText error={error} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button title={editing ? "Save" : "Add"} onPress={save} loading={create.isPending || update.isPending} /></View>
          {editing && <View style={{ flex: 1 }}><Button variant="ghost" title="Cancel" onPress={() => { setEditing(null); setName(""); setIcon(""); }} /></View>}
        </View>
      </Card>
      {cats.isPending ? <ListSkeleton rows={5} /> : shown.length === 0 ? <Empty>None yet.</Empty> : (
        <Card style={{ paddingVertical: 4 }}>
          {shown.map((c, i) => (
            <FadeIn key={c.id} index={i} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
              <T style={{ flex: 1 }} numberOfLines={1}>{c.icon ? `${c.icon}  ` : ""}{c.name}</T>
              <T tone="primary" size={13} accessibilityRole="button" accessibilityLabel={`Edit ${c.name}`} onPress={() => { setEditing(c); setName(c.name); setIcon(c.icon ?? ""); setError(null); }}>Edit</T>
              <T tone="muted" size={13} accessibilityRole="button" accessibilityLabel={`Delete ${c.name}`} onPress={async () => { if (await confirmAsync(`Delete "${c.name}"?`, "Existing transactions keep their history.")) remove.mutate(c.id); }}>Delete</T>
            </FadeIn>
          ))}
        </Card>
      )}
      <TagsCard />
    </Screen>
  );
}
