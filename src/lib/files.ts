import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { API_URL } from "@/api/client";
import { session } from "@/api/session";

/** Writes text to a temporary file and opens the system share sheet (Files, Mail, Drive, Excel…). */
export async function shareTextFile(name: string, text: string, mimeType = "text/csv") {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  await file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device");
  await Sharing.shareAsync(file.uri, { mimeType, UTI: mimeType === "text/csv" ? "public.comma-separated-values-text" : undefined, dialogTitle: name });
}

export const attachmentUrl = (id: string) => `${API_URL}/v1/attachments/${encodeURIComponent(id)}/file`;
export const authHeader = () => ({ authorization: `Bearer ${session.get().tokens?.accessToken ?? ""}` });

/**
 * Android has no in-app PDF renderer (its WebView can't show PDFs), so the receipt is downloaded to the app's cache
 * with the bearer token and handed to the phone's PDF viewer. The cached copy lives only in this app's sandbox.
 */
export async function openPdfOnAndroid(id: string) {
  const dest = new File(Paths.cache, `receipt-${id}.pdf`);
  const file = await File.downloadFileAsync(attachmentUrl(id), dest, { headers: authHeader(), idempotent: true });
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: file.contentUri, flags: 1 /* FLAG_GRANT_READ_URI_PERMISSION */, type: "application/pdf" });
}
