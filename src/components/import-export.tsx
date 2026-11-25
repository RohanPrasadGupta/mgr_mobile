import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { call, client } from "@/api/client";
import { invalidateLedger, useAccounts, useCategories, useMe } from "@/api/hooks";
import type { ImportReport, Transaction } from "@/api/types";
import { REQUIRED, buildRows, csvCell, detectColumns, type Field, type ImportRow } from "@/lib/import";
import { shareTextFile } from "@/lib/files";
import { isDate, toMajor } from "@/lib/money";
import { toast } from "@/lib/toast";
import { useTheme } from "@/theme/theme";
import { Badge, Button, Card, ErrorText, FadeIn, Field as FormField, Segmented, T } from "./ui";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 10_000;
type Ssf = Parameters<typeof buildRows>[2]["ssf"];
export interface Picked { name: string; uri: string; mimeType?: string; size?: number }

/** Reads the picked file's bytes (native: expo-file-system; web: fetch the blob URL). */
async function readBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === "web") return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  const { File } = require("expo-file-system") as typeof import("expo-file-system");
  return new File(uri).bytes();
}

/** Spreadsheet → rows of { header: cell }. CSV is decoded as UTF-8 text (SheetJS would otherwise assume Latin-1 and garble emoji/Thai text). */
export async function parseSpreadsheet(file: Picked, read = readBytes): Promise<{ rows: Record<string, unknown>[]; ssf: Ssf }> {
  if ((file.size ?? 0) > MAX_BYTES) throw new Error("That file is larger than 15 MB. Export a smaller date range and import it in parts.");
  const XLSX = require("xlsx") as typeof import("xlsx"); // loaded only when someone imports a file
  const bytes = await read(file.uri);
  const isCsv = /\.csv$/i.test(file.name) || file.mimeType === "text/csv";
  const wb = isCsv ? XLSX.read(new TextDecoder("utf-8").decode(bytes), { type: "string", raw: true, sheets: 0 }) : XLSX.read(bytes, { type: "array", sheets: 0, bookVBA: false, cellHTML: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) throw new Error("The file has no sheets");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: "" });
  if (rows.length === 0) throw new Error("No rows found in the first sheet");
  if (rows.length > MAX_ROWS) throw new Error(`${rows.length.toLocaleString()} rows is more than the 10,000 per import — split the file`);
  return { rows, ssf: XLSX.SSF as unknown as Ssf };
}

const LABELS: Record<Field, string> = { date: "Date", account: "Account", category: "Category", note: "Note", currency: "Currency", amount: "Amount", type: "Income/Expense" };

export function ImportTransactions({ pick = defaultPick, read }: { pick?: () => Promise<Picked | null>; read?: (uri: string) => Promise<Uint8Array> }) {
  const t = useTheme();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState<Record<string, unknown>[] | null>(null);
  const [ssf, setSsf] = useState<Ssf>();
  const [dmy, setDmy] = useState<"dmy" | "mdy">("dmy");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<"parse" | "check" | "import" | null>(null);
  const [error, setError] = useState<unknown>(null);

  const headers = useMemo(() => (raw?.[0] ? Object.keys(raw[0]) : []), [raw]);
  const mapping = useMemo(() => detectColumns(headers), [headers]);
  const missing = REQUIRED.filter((f) => !mapping[f]);
  const rows: ImportRow[] = useMemo(() => (raw && !missing.length ? buildRows(raw, mapping, { dmy: dmy === "dmy", defaultCurrency: me?.baseCurrency ?? "THB", ssf }) : []), [raw, mapping, missing.length, dmy, me?.baseCurrency, ssf]);

  async function choose() {
    setError(null); setReport(null);
    const f = await pick();
    if (!f) return;
    setFileName(f.name); setRaw(null); setBusy("parse");
    try { const r = await parseSpreadsheet(f, read); setRaw(r.rows); setSsf(r.ssf); }
    catch (e) { setError(e instanceof Error ? e : new Error("Could not read the file")); }
    finally { setBusy(null); }
  }
  async function run(dryRun: boolean) {
    setError(null); setBusy(dryRun ? "check" : "import");
    try {
      const r = (await call(client.POST("/imports/transactions", { body: { rows, dryRun } }))).data;
      setReport(r);
      if (!dryRun) { await invalidateLedger(qc); await qc.invalidateQueries({ queryKey: ["categories"] }); toast.success(`Imported ${r.imported.toLocaleString()} transactions`); }
    } catch (e) { setError(e); }
    finally { setBusy(null); }
  }

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 12 }}>
        <T tone="muted" size={14}>Pick your Money Manager export (.xls, .xlsx) or a CSV with the columns <T bold size={14}>Date, Account, Category, Note, Currency, Amount, Income/Expense</T>. Nothing is saved until you press Import, and importing the same file again never creates duplicates.</T>
        <Button title={busy === "parse" ? `Reading ${fileName}…` : raw ? "Choose another file" : "Choose a file"} variant={raw ? "ghost" : "primary"} onPress={choose} loading={busy === "parse"} />
        <ErrorText error={error} />
      </Card>
      {raw && (
        <FadeIn>
          <Card style={{ gap: 12 }}>
            <T bold>{fileName} · {raw.length.toLocaleString()} rows</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(Object.keys(LABELS) as Field[]).map((f) => <Badge key={f} label={`${LABELS[f]}: ${mapping[f] ?? (REQUIRED.includes(f) ? "missing" : "default")}`} tone={mapping[f] ? "income" : REQUIRED.includes(f) ? "expense" : "muted"} />)}
            </View>
            {missing.length > 0 ? <ErrorText error={new Error(`Required column(s) not found: ${missing.map((f) => LABELS[f]).join(", ")}. Columns in the file: ${headers.join(", ")}`)} /> : (
              <>
                <T tone="muted" size={13}>Dates written as text are</T>
                <Segmented value={dmy} onChange={(v) => { setDmy(v); setReport(null); }} options={[{ value: "dmy", label: "Day/Month/Year" }, { value: "mdy", label: "Month/Day/Year" }]} />
                <T tone="muted" size={13} bold>First rows</T>
                {rows.slice(0, 5).map((r, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: 8, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
                    <View style={{ flex: 1 }}><T size={14} numberOfLines={1}>{r.category || "Uncategorised"} · {r.account}</T><T tone="muted" size={12} numberOfLines={1}>{r.date}{r.note ? ` · ${r.note}` : ""}</T></View>
                    <T size={14} bold tone={r.type === "Income" ? "income" : "expense"}>{r.type === "Income" ? "+" : "−"}{r.currency} {r.amount}</T>
                  </View>
                ))}
                <Button variant="ghost" title="Check (nothing is saved)" onPress={() => void run(true)} loading={busy === "check"} disabled={busy !== null} />
                <Button title={`Import ${(report?.imported ?? rows.length).toLocaleString()} rows`} onPress={() => void run(false)} loading={busy === "import"} disabled={busy !== null || !report?.dryRun} />
                {!report && <T tone="muted" size={12}>Run the check first to see what will be created.</T>}
              </>
            )}
          </Card>
        </FadeIn>
      )}
      {report && (
        <FadeIn>
          <Card style={{ gap: 8 }}>
            <T bold>{report.dryRun ? "Check result — nothing saved yet" : "Import finished"}</T>
            {([["Rows in file", report.total], [report.dryRun ? "Will be imported" : "Imported", report.imported], ["Already present (skipped)", report.duplicates], ["Invalid rows", report.invalid.length]] as const).map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}><T tone="muted" size={14}>{k}</T><T bold>{v.toLocaleString()}</T></View>
            ))}
            {report.createdAccounts.length > 0 && <T size={13}><T tone="muted" size={13}>New accounts: </T>{report.createdAccounts.slice(0, 20).join(", ")}</T>}
            {report.createdCategories.length > 0 && <T size={13}><T tone="muted" size={13}>New categories: </T>{report.createdCategories.map((c) => c.replace(/^\w+:/, "")).slice(0, 30).join(", ")}</T>}
            {report.approximateFxRows > 0 && <T tone="muted" size={13}>{report.approximateFxRows} row(s) used an approximate exchange rate.</T>}
            {report.invalid.slice(0, 20).map((i) => <T key={i.row} tone="expense" size={12}>Row {i.row + 1}: {i.reason}</T>)}
            {!report.dryRun && <T tone="income" size={14}>Done. The imported data is now available across the app.</T>}
          </Card>
        </FadeIn>
      )}
    </View>
  );
}

async function defaultPick(): Promise<Picked | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "public.comma-separated-values-text"],
    // Android: read the picker's content:// link directly — the cached copy lands outside this app's readable folders in Expo Go.
    copyToCacheDirectory: Platform.OS !== "android",
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { name: a.name, uri: a.uri, mimeType: a.mimeType, size: a.size };
}

/** All transactions (optionally between two dates) as the same CSV the web app exports. */
export async function transactionsCsv(from: string, to: string, accountName: (id: string) => string, categoryName: (id: string | null) => string) {
  const all: Transaction[] = [];
  let cursor: string | undefined;
  do {
    const page = await call(client.GET("/transactions", { params: { query: { limit: 200, from: from || undefined, to: to || undefined, cursor } } }));
    all.push(...page.data); cursor = page.meta.nextCursor ?? undefined;
  } while (cursor);
  const kind = { income: "Income", expense: "Expense", transfer_out: "Transfer out", transfer_in: "Transfer in" } as const;
  const lines = [["Date", "Time", "Account", "Category", "Note", "Currency", "Amount", "Type"].join(",")];
  for (const x of all) {
    const d = new Date(x.occurredAt);
    lines.push([x.occurredOn, d.toTimeString().slice(0, 8), accountName(x.accountId), categoryName(x.categoryId), x.note ?? "", x.currency, toMajor(x.amountMinor, x.currency), kind[x.kind]].map(csvCell).join(","));
  }
  return { count: all.length, text: "﻿" + lines.join("\n") }; // BOM so Excel reads UTF-8
}

export function ExportCsv() {
  const accounts = useAccounts();
  const categories = useCategories();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function exportNow() {
    setError(null);
    if ((from && !isDate(from)) || (to && !isDate(to))) return setError(new Error("Enter dates as YYYY-MM-DD, or leave them empty"));
    setBusy(true);
    try {
      const acct = new Map(accounts.data?.map((a) => [a.id, a.name]));
      const cat = new Map(categories.data?.map((c) => [c.id, c.name]));
      const { count, text } = await transactionsCsv(from, to, (id) => acct.get(id) ?? "", (id) => (id ? (cat.get(id) ?? "") : ""));
      await shareTextFile(`moneymgr-transactions${from || to ? `-${from || "start"}-to-${to || "now"}` : ""}.csv`, text);
      toast.success(`Exported ${count.toLocaleString()} transactions`);
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  return (
    <Card style={{ gap: 12 }}>
      <T tone="muted" size={14}>Save your transactions as a CSV (opens in Excel, Numbers or Google Sheets) and send it anywhere from the share sheet. Leave the dates empty to export everything.</T>
      <FormField label="From (optional)" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      <FormField label="To (optional)" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      <ErrorText error={error} />
      <Button title="Export CSV" onPress={() => void exportNow()} loading={busy} disabled={accounts.isPending || categories.isPending} />
    </Card>
  );
}

export function ImportExport() {
  const [tab, setTab] = useState<"import" | "export">("import");
  return (
    <View style={{ gap: 16 }}>
      <Segmented value={tab} onChange={setTab} options={[{ value: "import", label: "Import" }, { value: "export", label: "Export CSV" }]} />
      {tab === "import" ? <ImportTransactions /> : <ExportCsv />}
    </View>
  );
}
