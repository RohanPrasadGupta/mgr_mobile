import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateNotes, useMutate, useNotes } from "@/api/hooks";
import { Button, Card, CardsSkeleton, Empty, ErrorText, FadeIn, Field, Screen, T } from "@/components/ui";
import { useTheme } from "@/theme/theme";

const when = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`; };

export default function Notes() {
  const t = useTheme();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const notes = useNotes(q);
  const pin = useMutate(({ id, pinned }: { id: string; pinned: boolean }) => call(client.PATCH("/notes/{id}", { params: { path: { id } }, body: { pinned } })), invalidateNotes);
  return (
    <Screen edges={[]} onRefresh={() => void notes.refetch()} refreshing={notes.isRefetching && !notes.isPlaceholderData}>
      <Button title="+ New note" onPress={() => router.push("/note-form")} />
      <Field label="Search notes" value={search} onChangeText={setSearch} placeholder="Title or text" autoCapitalize="none" />
      {notes.isPending ? <CardsSkeleton /> : notes.error ? <ErrorText error={notes.error} onRetry={() => void notes.refetch()} /> : notes.data.length === 0 ? (
        <Empty>{q ? "No notes match your search." : "No notes yet. Jot down money plans, account details you need to remember, or a shopping list."}</Empty>
      ) : (
        <View style={{ gap: 10, opacity: notes.isPlaceholderData ? 0.55 : 1 }}>
          {notes.data.map((n, i) => (
            <FadeIn key={n.id} index={i}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open note ${n.title}`} onPress={() => router.push({ pathname: "/note-form", params: { id: n.id } })}>
                <Card style={{ gap: 6, borderColor: n.pinned ? `${t.primary}88` : t.border }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <T bold size={16} numberOfLines={1} style={{ flex: 1 }}>{n.title}</T>
                    <Pressable accessibilityRole="button" accessibilityLabel={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`} accessibilityState={{ selected: n.pinned }} hitSlop={10} onPress={() => pin.mutate({ id: n.id, pinned: !n.pinned })}>
                      <T size={16} style={{ opacity: n.pinned ? 1 : 0.35 }}>📌</T>
                    </Pressable>
                  </View>
                  {n.body ? <T tone="muted" size={14} numberOfLines={4}>{n.body}</T> : null}
                  <T tone="muted" size={11}>Edited {when(n.updatedAt)}</T>
                </Card>
              </Pressable>
            </FadeIn>
          ))}
        </View>
      )}
    </Screen>
  );
}
