import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { call, client } from "@/api/client";
import { invalidateNotes, useMutate } from "@/api/hooks";
import type { Note } from "@/api/types";
import { Button, ErrorText, Field, Screen, T, confirmAsync } from "@/components/ui";
import { goBack } from "@/lib/nav";
import { useTheme } from "@/theme/theme";

export default function NoteForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  // the list already holds every note: read it from the cache instead of another request
  const edit = id ? qc.getQueriesData<Note[]>({ queryKey: ["notes"] }).flatMap(([, d]) => d ?? []).find((n) => n.id === id) : undefined;
  const [title, setTitle] = useState(edit?.title ?? "");
  const [body, setBody] = useState(edit?.body ?? "");
  const [pinned, setPinned] = useState(edit?.pinned ?? false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { if (id && !edit) goBack(); }, [id, edit]);
  const save = useMutate(() => {
    if (!title.trim()) throw new Error("Give the note a title");
    const b = { title: title.trim(), body, pinned };
    return edit ? call(client.PATCH("/notes/{id}", { params: { path: { id: edit.id } }, body: b })) : call(client.POST("/notes", { body: b }));
  }, invalidateNotes, edit ? "Note saved" : "Note created");
  const del = useMutate(() => call(client.DELETE("/notes/{id}", { params: { path: { id: id! } } })), invalidateNotes, "Note deleted");
  async function submit() { setError(null); try { await save.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); } }
  async function remove() {
    if (!(await confirmAsync("Delete note?", `Delete "${edit?.title}"? This can't be undone.`))) return;
    try { await del.mutateAsync(undefined as never); goBack(); } catch (e) { setError(e); }
  }
  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: edit ? "Edit note" : "New note" }} />
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} autoFocus={!edit} />
      <Field label="Note" value={body} onChangeText={setBody} maxLength={20_000} multiline textAlignVertical="top" style={{ minHeight: 180 }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T>Pin to the top</T>
        <Switch value={pinned} onValueChange={setPinned} accessibilityLabel="Pin to the top" trackColor={{ true: t.primary, false: t.border }} />
      </View>
      <ErrorText error={error} />
      <Button title="Save" onPress={submit} loading={save.isPending} />
      {edit && <Button title="Delete" variant="danger" onPress={remove} loading={del.isPending} />}
    </Screen>
  );
}
