import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { attachmentUrl, authHeader, openPdfOnAndroid } from "@/lib/files";
import { useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, View } from "react-native";
import { attachmentSource, call, client, uploadAttachment, type LocalFile } from "@/api/client";
import { useAttachments } from "@/api/hooks";
import { toast } from "@/lib/toast";
import { radius, useTheme } from "@/theme/theme";
import { Skeleton, T, confirmAsync } from "./ui";

export const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const size = (n?: number) => (n === undefined ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Client-side pre-check so obviously wrong files fail instantly (the API re-checks the real bytes). */
export function checkFile(f: LocalFile): string | null {
  if (f.size !== undefined && f.size > MAX_BYTES) return `${f.name} is larger than 10 MB`;
  if (f.type && !OK_TYPES.includes(f.type)) return `${f.name}: only photos (JPEG, PNG, WebP, HEIC) and PDFs can be attached`;
  return null;
}

/** Camera or photo library → LocalFile[] (empty when cancelled or permission refused). */
export async function pickReceipts(source: "camera" | "library"): Promise<LocalFile[]> {
  // The system photo picker runs out of process and needs no library permission; only the camera asks.
  if (source === "camera" && !(await ImagePicker.requestCameraPermissionsAsync()).granted) { toast.error("Camera access is off — allow it in Settings to photograph receipts"); return []; }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: source === "library", selectionLimit: 10 };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return [];
  return res.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `receipt-${Date.now()}-${i}.jpg`, type: a.mimeType ?? "image/jpeg", size: a.fileSize }));
}

/** A PDF (or photo) from Files / iCloud Drive / Google Drive / Downloads. */
export async function pickDocuments(): Promise<LocalFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], multiple: true, copyToCacheDirectory: Platform.OS !== "android" }); // Android: keep the content:// link (readable), not a cache copy
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? (a.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"), size: a.size }));
}

function PickButtons({ onFiles, busy }: { onFiles: (f: LocalFile[]) => void; busy?: boolean }) {
  const t = useTheme();
  const btn = (label: string, src: "camera" | "library" | "files") => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={async () => onFiles(src === "files" ? await pickDocuments() : await pickReceipts(src))}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: t.border, opacity: busy ? 0.5 : pressed ? 0.7 : 1 })}>
      <T tone="muted" size={14}>{label}</T>
    </Pressable>
  );
  return <View style={{ flexDirection: "row", gap: 8 }}>{busy ? <ActivityIndicator color={t.primary} /> : null}{btn("📷 Camera", "camera")}{btn("🖼 Photos", "library")}{btn("📄 Files", "files")}</View>;
}

/** Receipts of a saved transaction: thumbnails, add (camera/library), remove. */
export function AttachmentsPanel({ transactionId }: { transactionId: string }) {
  const t = useTheme();
  const list = useAttachments(transactionId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ id: string; name: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  async function openPdf(id: string, name: string) {
    if (Platform.OS === "ios") return setPdf({ id, name }); // WKWebView renders PDFs natively, with pinch-zoom and paging
    setOpening(id);
    try {
      if (Platform.OS === "android") await openPdfOnAndroid(id);
      else { // web (development only): fetch with the token, open the blob in a new tab
        const blob = await (await fetch(attachmentUrl(id), { headers: authHeader() })).blob();
        window.open(URL.createObjectURL(blob), "_blank", "noopener");
      }
    } catch (e) { toast.error(e instanceof Error && /activity|intent/i.test(e.message) ? "No app on this phone can open PDFs" : "Couldn't open the receipt"); }
    finally { setOpening(null); }
  }
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["attachments", transactionId] }), qc.invalidateQueries({ queryKey: ["transactions"] })]);

  async function add(files: LocalFile[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) {
        const bad = checkFile(f);
        if (bad) { toast.error(bad); continue; }
        try { await uploadAttachment(transactionId, f); toast.success("Receipt attached"); } catch (e) { console.warn("[receipt upload]", e); toast.error(e instanceof Error ? e.message : "Upload failed"); }
      }
    } finally { setBusy(false); await refresh(); }
  }
  async function remove(id: string, name: string) {
    if (!(await confirmAsync("Remove attachment?", `Delete "${name}"? This can't be undone.`, "Remove"))) return;
    try { await call(client.DELETE("/attachments/{id}", { params: { path: { id } } })); toast.success("Attachment removed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't remove it"); }
    await refresh();
  }

  return (
    <View style={{ gap: 8 }}>
      <T tone="muted" size={13} bold>Receipts</T>
      {list.isPending ? <Skeleton height={84} /> : (list.data?.length ?? 0) > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {list.data!.map((a) => {
            const isImage = a.contentType.startsWith("image/") && a.contentType !== "image/heic";
            return (
              <View key={a.id} style={{ width: 96 }}>
                <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Open ${a.fileName}`} onPress={() => (isImage ? setPreview(a.id) : void openPdf(a.id, a.fileName))}
                  style={{ width: 96, height: 96, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: t.border, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
                  {isImage ? <Image source={attachmentSource(a.id)} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} accessibilityLabel={a.fileName} />
                    : opening === a.id ? <ActivityIndicator color={t.primary} /> : <View style={{ alignItems: "center", gap: 2 }}><T size={26}>📄</T><T tone="muted" size={11} bold>PDF</T></View>}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${a.fileName}`} onPress={() => void remove(a.id, a.fileName)} hitSlop={8}
                  style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}>
                  <T size={12} tone="expense" bold>✕</T>
                </Pressable>
                <T tone="muted" size={11} numberOfLines={1}>{size(a.sizeBytes)}</T>
              </View>
            );
          })}
        </View>
      )}
      <PickButtons onFiles={(f) => void add(f)} busy={busy} />
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close receipt" onPress={() => setPreview(null)} style={{ flex: 1, backgroundColor: "rgba(4,7,24,0.92)", padding: 16, justifyContent: "center" }}>
          {preview && <Image source={attachmentSource(preview)} style={{ width: "100%", height: "85%" }} contentFit="contain" transition={200} />}
          <T style={{ color: "#fff", textAlign: "center", marginTop: 12 }}>Tap anywhere to close</T>
        </Pressable>
      </Modal>
      <Modal visible={!!pdf} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPdf(null)}>
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: t.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
            <T bold numberOfLines={1} style={{ flex: 1 }}>{pdf?.name}</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Close receipt" onPress={() => setPdf(null)} hitSlop={10}><T tone="primary" bold>Done</T></Pressable>
          </View>
          {pdf && <WebView source={{ uri: attachmentUrl(pdf.id), headers: authHeader() }} style={{ flex: 1, backgroundColor: t.bg }} originWhitelist={["*"]}
            startInLoadingState renderLoading={() => <ActivityIndicator style={{ position: "absolute", top: "45%", alignSelf: "center" }} color={t.primary} />}
            onHttpError={() => toast.error("Couldn't load the receipt")} />}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/** For a transaction that doesn't exist yet: photos are held locally and uploaded right after it is saved. */
export function PendingAttachments({ files, onChange }: { files: LocalFile[]; onChange: (f: LocalFile[]) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T tone="muted" size={13} bold>Receipts</T>
      {files.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {files.map((f, i) => (
            <View key={`${f.uri}-${i}`} style={{ width: 72, height: 72, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: t.border }}>
              {f.type === "application/pdf"
                ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} accessibilityLabel={f.name}><T size={22}>📄</T><T tone="muted" size={10} bold>PDF</T></View>
                : <Image source={{ uri: f.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" accessibilityLabel={f.name} />}
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} onPress={() => onChange(files.filter((_, j) => j !== i))} hitSlop={8}
                style={{ position: "absolute", top: 3, right: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}>
                <T size={11} tone="expense" bold>✕</T>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <PickButtons onFiles={(add) => {
        const ok = add.filter((f) => { const bad = checkFile(f); if (bad) toast.error(bad); return !bad; });
        onChange([...files, ...ok].slice(0, 10));
      }} />
    </View>
  );
}
