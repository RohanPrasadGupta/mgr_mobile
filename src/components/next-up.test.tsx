import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import * as XLSX from "xlsx";
import { baseRoutes } from "../../test/fixtures";
import { errorResponse, mockFetch, renderWithClient } from "../../test/utils";
import { FxField } from "./fx-field";
import { ImportTransactions, parseSpreadsheet, transactionsCsv } from "./import-export";

jest.mock("expo-router", () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() } }));
const mockFiles = new Map<string, string>();
jest.mock("expo-file-system", () => {
  class MockFile {
    uri: string; contentUri: string;
    constructor(...parts: unknown[]) { this.uri = parts.map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri)).join("/"); this.contentUri = `content://${this.uri}`; }
    get exists() { return mockFiles.has(this.uri); }
    delete() { mockFiles.delete(this.uri); }
    async write(t: string) { mockFiles.set(this.uri, t); }
    static downloadFileAsync = jest.fn(async (_url: string, dest: MockFile) => dest);
  }
  return { File: MockFile, Paths: { cache: { uri: "file:///cache" } } };
});
const press = async (name: string | RegExp) => { await fireEvent.press(screen.getByRole("button", { name })); };
const bytes = (s: string) => new TextEncoder().encode(s);

describe("spreadsheet import (mobile)", () => {
  it("reads a UTF-8 CSV without garbling non-Latin text, and refuses oversized or empty files", async () => {
    const csv = "Date,Account,Category,Note,Currency,Amount,Income/Expense\n25/11/2026,Cash,Food,ข้าวผัด 🍛,THB,120,Expense\n";
    const r = await parseSpreadsheet({ name: "x.csv", uri: "u", size: 100 }, async () => bytes(csv));
    expect(r.rows[0]).toMatchObject({ Note: "ข้าวผัด 🍛", Amount: "120" });
    await expect(parseSpreadsheet({ name: "big.xls", uri: "u", size: 20 * 1024 * 1024 }, async () => bytes(""))).rejects.toThrow(/15 MB/);
    await expect(parseSpreadsheet({ name: "e.csv", uri: "u", size: 5 }, async () => bytes("Date,Amount\n"))).rejects.toThrow(/No rows/);
  });

  it("reads a real .xlsx workbook", async () => {
    const ws = XLSX.utils.aoa_to_sheet([["Date", "Amount", "Income/Expense"], ["2026-11-01", 50, "Income"]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const out = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    const r = await parseSpreadsheet({ name: "m.xlsx", uri: "u", size: out.length }, async () => out);
    expect(r.rows).toEqual([{ Date: "2026-11-01", Amount: 50, "Income/Expense": "Income" }]);
  });

  it("checks first, then imports exactly what was checked, and shows the report", async () => {
    const csv = "Date,Account,Category,Note,Currency,Amount,Income/Expense\n25/11/2026,Cash,Food,lunch,THB,120,Expense\n02/11/2026,Bank,Salary,,THB,50000,Income\n";
    const report = (dryRun: boolean) => ({ data: { dryRun, total: 2, imported: 2, duplicates: 0, invalid: [], createdAccounts: ["Bank"], createdCategories: ["income:Salary"], approximateFxRows: 0 } });
    const m = mockFetch({ ...baseRoutes, "POST /imports/transactions": ({ body }: { body: { dryRun: boolean } }) => report(body.dryRun) });
    await renderWithClient(<ImportTransactions pick={async () => ({ name: "export.csv", uri: "u", size: csv.length })} read={async () => bytes(csv)} />);
    await press("Choose a file");
    expect(await screen.findByText("export.csv · 2 rows")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Import 2 rows" })).toBeDisabled(); // check first
    await press("Check (nothing is saved)");
    expect(await screen.findByText("Check result — nothing saved yet")).toBeOnTheScreen();
    const checked = m.last("POST", "/imports/transactions")!.body;
    expect(checked).toMatchObject({ dryRun: true, rows: [{ date: "2026-11-25", account: "Cash", category: "Food", amount: 120, type: "Expense" }, { account: "Bank", amount: 50000, type: "Income" }] });
    await press("Import 2 rows");
    expect(await screen.findByText("Import finished")).toBeOnTheScreen();
    expect(m.last("POST", "/imports/transactions")!.body).toMatchObject({ dryRun: false, rows: checked.rows });
    expect(screen.getByText("New accounts: ")).toBeOnTheScreen(); // the report lists what was created
  });

  it("names the missing required columns", async () => {
    mockFetch(baseRoutes);
    await renderWithClient(<ImportTransactions pick={async () => ({ name: "bad.csv", uri: "u", size: 10 })} read={async () => bytes("When,Value\n1,2\n")} />);
    await press("Choose a file");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Date, Amount, Income\/Expense/);
  });
});

describe("CSV export (mobile)", () => {
  it("pages through every transaction and writes formula-safe rows", async () => {
    let n = 0;
    const tx = (id: string, note: string) => ({ id, accountId: "a-cash", categoryId: "c-food", kind: "expense", amountMinor: 12_345, currency: "THB", occurredAt: "2026-11-20T05:00:00Z", occurredOn: "2026-11-20", note });
    mockFetch({ "GET /transactions": () => (++n === 1 ? { data: [tx("1", "=cmd()")], meta: { nextCursor: "c2" } } : { data: [tx("2", "plain")], meta: { nextCursor: null } }) });
    const { count, text } = await transactionsCsv("", "", () => "Cash", () => "Food");
    expect(count).toBe(2);
    expect(text.startsWith("﻿Date,Time,Account,Category,Note,Currency,Amount,Type")).toBe(true);
    expect(text).toContain("2026-11-20,");
    expect(text).toContain(",Cash,Food,'=cmd(),THB,123.45,Expense");
  });
});

describe("FX field", () => {
  it("shows the stored rate it will use and previews the converted amount", async () => {
    mockFetch({ "GET /fx": { data: { from: "NPR", to: "THB", rate: 0.2285, asOf: "2026-11-24", approximate: false } } });
    await renderWithClient(<FxField from="NPR" to="THB" date="2026-11-25" value="" onChange={() => {}} amount={400} />);
    expect(await screen.findByText(/stored rate 1 NPR = 0\.2285 THB \(as of 2026-11-24\)/)).toBeOnTheScreen();
    expect(screen.getByText(/THB 91\.40/)).toBeOnTheScreen();
  });
  it("says so when no stored rate exists, and uses the typed rate for the preview", async () => {
    mockFetch({ "GET /fx": () => errorResponse(404, "not_found", "FX rate not found") });
    await renderWithClient(<FxField from="NPR" to="THB" date="2026-11-25" value="0.25" onChange={() => {}} amount={400} />);
    expect(await screen.findByText(/No stored NPR→THB rate/)).toBeOnTheScreen();
    expect(screen.getByText(/THB 100\.00/)).toBeOnTheScreen();
    expect(screen.getByText(/at your rate/)).toBeOnTheScreen();
  });
  it("offers the last rate typed for the pair", async () => {
    const store = (globalThis as { __secureStore?: Map<string, string> }).__secureStore!;
    store.set("moneymgr.fx.NPR.THB", "0.24");
    mockFetch({ "GET /fx": () => errorResponse(404, "not_found", "none") });
    const onChange = jest.fn();
    await renderWithClient(<FxField from="NPR" to="THB" date="2026-11-25" value="" onChange={onChange} />);
    await fireEvent.press(await screen.findByRole("button", { name: "Use last: 0.2400" }));
    expect(onChange).toHaveBeenCalledWith("0.24");
  });
});

describe("PDF receipts", () => {
  it("on Android, downloads with the token and hands the file to the PDF viewer", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    const { openPdfOnAndroid } = require("@/lib/files");
    const { File } = require("expo-file-system");
    await openPdfOnAndroid("att1");
    expect(File.downloadFileAsync).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/attachments\/att1\/file$/), expect.anything(), expect.objectContaining({ headers: expect.objectContaining({ authorization: expect.stringMatching(/^Bearer /) }), idempotent: true }));
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith("android.intent.action.VIEW", expect.objectContaining({ type: "application/pdf", flags: 1, data: expect.stringMatching(/^content:\/\//) }));
  });
  it("CSV sharing writes a cache file and opens the share sheet", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const { shareTextFile } = require("@/lib/files");
    await shareTextFile("t.csv", "a,b");
    expect(mockFiles.get("file:///cache/t.csv")).toBe("a,b");
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/t.csv", expect.objectContaining({ mimeType: "text/csv" })));
  });
});
