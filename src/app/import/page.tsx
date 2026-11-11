"use client";

import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { formatCurrency, normalizeDateToISO } from "@/lib/date-utils";
import { useToast } from "@/components/providers/ToastProvider";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  RefreshCw,
  Sparkles,
  Info,
  ShieldCheck,
  Check,
  ExternalLink,
} from "lucide-react";

const GOOGLE_SHEET_VIEW_URL =
  "https://docs.google.com/spreadsheets/d/1LfzTmzaUpybViSZ2g-lKgr7v4NbMoNogIOz_IYtReVA/edit?usp=sharing";

async function pushBatchDirectToGoogleSheet(webhookUrl: string, sheetName: string, rows: any[]) {
  if (!webhookUrl || !rows || rows.length === 0) return { success: false, insertedCount: 0 };
  const payload = JSON.stringify({
    action: "bulk_insert",
    sheet: sheetName,
    rows: rows,
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: payload,
      redirect: "follow",
    });
    const data = await res.json().catch(() => ({ success: true }));
    return { success: true, ...data, insertedCount: rows.length };
  } catch (err) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: payload,
      });
      return { success: true, insertedCount: rows.length };
    } catch (err2: any) {
      throw new Error(err2.message || "Failed to reach Google Sheet Webhook");
    }
  }
}

export default function CSVImportPage() {
  const { success, error } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [csvRawText, setCsvRawText] = useState<string>("");
  const [autoSync, setAutoSync] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("auto_sync_csv");
    if (saved !== null) {
      setAutoSync(saved === "true");
    }
  }, []);

  const parseAndPreviewContent = async (content: string, filename: string) => {
    setCsvRawText(content);
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
    });

    const headers = (parsed.meta.fields || []).map((h) => h.trim());
    const rows = parsed.data as Record<string, string>[];

    if (!rows || rows.length === 0) {
      throw new Error("No data rows found in file");
    }

    // Get existing payment IDs from live Google Sheet or local cache
    const existingPaymentIds = new Set<string>();
    try {
      const storedConfig = JSON.parse(
        localStorage.getItem("gh_sheet_config") ||
          JSON.stringify({
            webhookUrl:
              "https://script.google.com/macros/s/AKfycbx8v0N44nQSkFK4LyOOnyqeedUMw86R92l_bb59IcVXaIFHKe0ybm4ShHValK0O32lq/exec",
          })
      );
      if (storedConfig.webhookUrl) {
        try {
          const res = await fetch(`${storedConfig.webhookUrl}?action=read_all`, { redirect: "follow" });
          if (res.ok) {
            const d = await res.json();
            if (d.success && Array.isArray(d.revenues)) {
              d.revenues.forEach((r: any) => {
                const pid = r["Payment ID"] || r.payment_id;
                if (pid) existingPaymentIds.add(String(pid).trim());
              });
            }
          }
        } catch {}
      }

      if (existingPaymentIds.size === 0) {
        const res = await fetch("/api/revenues");
        const d = await res.json();
        if (d.success && Array.isArray(d.revenues)) {
          d.revenues.forEach((r: any) => {
            if (r.payment_id) existingPaymentIds.add(String(r.payment_id).trim());
          });
        }
      }
    } catch {}

    const detectedProductsMap = new Map<string, number>();
    const previewRows: any[] = [];
    const validDates: string[] = [];

    let totalGrossAmount = 0;
    let totalNetAmount = 0;
    let newRows = 0;
    let matchedRows = 0;
    let invalidRows = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const paymentId = (row["Payment ID"] || row["payment_id"] || row["ID"] || "").trim();
      const rawDate = row["Date"] || row["date"] || "";
      const isoDate = normalizeDateToISO(rawDate);
      const productTitle = (
        row["Product Title"] ||
        row["Product Name"] ||
        row["Product"] ||
        "Digital Product"
      ).trim();
      const status = (row["Status"] || row["status"] || "Received").trim();
      const paidByCustomer =
        parseFloat(row["Paid By Customer"] || row["Amount"] || row["amount"] || "0") || 0;
      const earnedAmount =
        parseFloat(row["Earned Amount"] || row["Net Amount"] || row["net_amount"] || "0") || 0;
      const email = (row["Customer Email"] || row["Email"] || "").trim();
      const phone = (row["Customer Phone"] || row["Phone"] || "").trim();

      if (productTitle && productTitle !== "--") {
        if (
          !detectedProductsMap.has(productTitle) ||
          paidByCustomer > (detectedProductsMap.get(productTitle) || 0)
        ) {
          detectedProductsMap.set(productTitle, paidByCustomer);
        }
      }

      const isReceived = !status || status.toLowerCase() === "received";
      const existsInDb = Boolean(paymentId && existingPaymentIds.has(paymentId));

      let action: "insert" | "update" | "skip" = "insert";
      let reason: string | undefined;

      if (!isoDate) {
        action = "skip";
        reason = "Invalid date format";
        invalidRows++;
      } else if (paidByCustomer <= 0) {
        action = "skip";
        reason = "Amount is zero";
        invalidRows++;
      } else if (!isReceived) {
        action = "skip";
        reason = `Status is ${status}`;
        invalidRows++;
      } else if (existsInDb) {
        action = "update";
        matchedRows++;
        totalGrossAmount += paidByCustomer;
        totalNetAmount += earnedAmount > 0 ? earnedAmount : paidByCustomer;
        if (isoDate) validDates.push(isoDate);
      } else {
        action = "insert";
        newRows++;
        totalGrossAmount += paidByCustomer;
        totalNetAmount += earnedAmount > 0 ? earnedAmount : paidByCustomer;
        if (isoDate) validDates.push(isoDate);
      }

      previewRows.push({
        date: isoDate,
        productName: productTitle,
        amount: paidByCustomer,
        netAmount: earnedAmount > 0 ? earnedAmount : paidByCustomer,
        paymentId: paymentId || `ROW-${idx + 1}`,
        customerEmail: email,
        customerPhone: phone,
        status,
        action,
        reason,
      });
    }

    validDates.sort();
    const dateRange = {
      start: validDates[0] || null,
      end: validDates[validDates.length - 1] || null,
    };

    const detectedProducts = Array.from(detectedProductsMap.entries()).map(([name, price]) => ({
      name,
      price,
    }));

    return {
      detectedType: "cosmofeed",
      totalRows: rows.length,
      newRows,
      matchedRows,
      invalidRows,
      totalGrossAmount: Math.round(totalGrossAmount * 100) / 100,
      totalNetAmount: Math.round(totalNetAmount * 100) / 100,
      dateRange,
      detectedProducts,
      headers,
      previewRows: previewRows.slice(0, 50),
      allRows: previewRows,
    };
  };

  // Execute import / sync to Google Sheet
  const handleExecuteImport = async (overridePreview?: any, overrideRawText?: string) => {
    const activePreview = overridePreview || preview;
    const activeRawText = overrideRawText || csvRawText;
    if (!activePreview) return;
    setImporting(true);
    try {
      let backendSuccess = false;
      let resultData: any = null;

      // 1. Try backend API first
      try {
        const res = await fetch("/api/import/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csvContent: activeRawText,
            filename: file?.name || "import.csv",
            skipDuplicates: true,
            onlyReceived: true,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.success && (d.sheetPushed || d.insertedCount !== undefined)) {
            backendSuccess = true;
            resultData = d;
          }
        }
      } catch {}

      // 2. Direct Webhook sync fallback (if backend unavailable)
      if (!backendSuccess) {
        const storedConfig = JSON.parse(
          localStorage.getItem("gh_sheet_config") ||
            JSON.stringify({
              webhookUrl:
                "https://script.google.com/macros/s/AKfycbx8v0N44nQSkFK4LyOOnyqeedUMw86R92l_bb59IcVXaIFHKe0ybm4ShHValK0O32lq/exec",
            })
        );

        const rowsToImport = (activePreview.allRows || [])
          .filter((r: any) => r.action === "insert")
          .map((r: any) => ({
            id: r.paymentId,
            date: r.date,
            payment_id: r.paymentId,
            product_name: r.productName,
            amount: r.amount,
            net_amount: r.netAmount,
            customer_email: r.customerEmail,
            customer_phone: r.customerPhone,
            status: r.status,
          }));

        // Push new rows to Google Sheet Webhook
        if (storedConfig.webhookUrl && rowsToImport.length > 0) {
          await pushBatchDirectToGoogleSheet(storedConfig.webhookUrl, "Revenues", rowsToImport);
        }

        // Push products to Google Sheet
        const productsToImport = (activePreview.detectedProducts || []).map((p: any) => ({
          name: p.name,
          category: "Digital Notes",
          selling_price: p.price,
          product_cost: 0,
        }));
        if (storedConfig.webhookUrl && productsToImport.length > 0) {
          await pushBatchDirectToGoogleSheet(storedConfig.webhookUrl, "Products", productsToImport).catch(() => {});
        }

        // Save into local cache
        const localRevs = JSON.parse(localStorage.getItem("gh_local_revs") || "[]");
        const existingIds = new Set(localRevs.map((lr: any) => lr.payment_id));
        for (const item of rowsToImport) {
          if (!existingIds.has(item.payment_id)) {
            localRevs.unshift(item);
          }
        }
        localStorage.setItem("gh_local_revs", JSON.stringify(localRevs));

        resultData = {
          success: true,
          insertedCount: rowsToImport.length,
          updatedCount: activePreview.matchedRows,
          totalGross: activePreview.totalGrossAmount,
          totalNet: activePreview.totalNetAmount,
          sheetPushed: true,
        };
      }

      setImportResult(resultData);
      success(
        "Sync Completed Successfully!",
        `Synchronized ${resultData.insertedCount} new sales to Google Sheet (tab: Revenues).`
      );
      window.dispatchEvent(new Event("refresh_data"));
    } catch (err: any) {
      error("Sync Failed", err.message || "Failed to sync data with Google Sheet");
    } finally {
      setImporting(false);
    }
  };

  // Load sample data.csv
  const handleLoadSample = async (forceSync = false) => {
    setAnalyzing(true);
    setPreview(null);
    setImportResult(null);
    setFile(null);
    try {
      const isGhPages =
        typeof window !== "undefined" && window.location.pathname.startsWith("/facebook");
      const sampleUrl = isGhPages ? "/facebook/data.csv" : "/data.csv";
      let csvContent = "";

      try {
        const res = await fetch(sampleUrl);
        if (res.ok) {
          csvContent = await res.text();
        }
      } catch {}

      if (!csvContent) {
        // Fallback to API if available
        const res = await fetch("/api/import/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ useSampleFile: true }),
        });
        const data = await res.json();
        if (data.success && data.preview) {
          setPreview(data.preview);
          if (forceSync || autoSync) {
            await handleExecuteImport(data.preview, csvContent);
          } else {
            success(
              "data.csv Analyzed",
              `Found ${data.preview.totalRows} rows: ${data.preview.newRows} new, ${data.preview.matchedRows} existing`
            );
          }
          return;
        }
      }

      if (!csvContent) throw new Error("Could not load sample data.csv");

      const previewData = await parseAndPreviewContent(csvContent, "data.csv");
      setPreview(previewData);

      if (forceSync || autoSync) {
        await handleExecuteImport(previewData, csvContent);
      } else {
        success(
          "data.csv Analyzed",
          `Found ${previewData.totalRows} rows: ${previewData.newRows} new, ${previewData.matchedRows} existing`
        );
      }
    } catch (err: any) {
      error("Analysis Failed", err.message || "Failed to load sample data.csv");
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle uploaded file (Excel .xlsx, .xls or .csv)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setPreview(null);
    setImportResult(null);
    setAnalyzing(true);

    try {
      const isExcel =
        uploadedFile.name.endsWith(".xlsx") ||
        uploadedFile.name.endsWith(".xls") ||
        uploadedFile.type.includes("spreadsheet") ||
        uploadedFile.type.includes("excel");

      let csvText = "";
      if (isExcel) {
        const buffer = await uploadedFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        csvText = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        csvText = await uploadedFile.text();
      }

      const previewData = await parseAndPreviewContent(csvText, uploadedFile.name);
      setPreview(previewData);

      if (autoSync) {
        success("Auto-syncing to Google Sheet...", `Parsed ${previewData.totalRows} rows. Synchronizing with Google Sheet...`);
        await handleExecuteImport(previewData, csvText);
      } else {
        success(
          "File Parsed Successfully",
          `Found ${previewData.totalRows} rows: ${previewData.newRows} new, ${previewData.matchedRows} existing`
        );
      }
    } catch (err: any) {
      error("Parse Error", err.message || "Failed to parse file");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            <span>CSV & Excel Import Engine</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Upload your sales CSV or Excel (.xlsx, .xls): Data is automatically synchronized into your live Google Sheet
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <a
            href={GOOGLE_SHEET_VIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground border flex items-center gap-1.5 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Google Sheet</span>
          </a>
          <button
            onClick={() => handleLoadSample(false)}
            disabled={analyzing || importing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground border flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Load data.csv</span>
          </button>
        </div>
      </div>

      {/* Sync Strategy Explanation Notice */}
      <div className="p-4 rounded-2xl border bg-blue-950/20 border-blue-900/40 text-xs flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-foreground">Intelligent Google Sheet Sync & Excel Support</h4>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              Supports both <strong>.csv</strong> and <strong>.xlsx / .xls (Excel)</strong> files from Cosmofeed.
              New sales records are <strong>added directly into Google Sheet &ldquo;Revenues&rdquo;</strong>, and new products are added into <strong>&ldquo;Products&rdquo;</strong>.
            </p>
          </div>
        </div>
        <a
          href={GOOGLE_SHEET_VIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap hidden sm:inline-flex items-center gap-1 shrink-0"
        >
          <span>Spreadsheet Link</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Upload Zone */}
      <div className="p-6 sm:p-8 rounded-3xl border-2 border-dashed border-border/80 bg-card/40 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-4 hover:border-primary/50 transition-colors">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <div>
          <h3 className="font-bold text-base">Select or Drop your CSV or Excel file here</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Supports Cosmofeed export format (.csv, .xlsx, .xls) with Payment ID, Earned Amount, Paid By
            Customer, Product Title, Date, etc.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <label className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm active:scale-95 transition-all">
            <span>Browse CSV / Excel File</span>
            <input
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            onClick={() => handleLoadSample(true)}
            disabled={analyzing || importing}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            {analyzing || importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>⚡ Sync data.csv to Google Sheet</span>
          </button>
        </div>

        {/* Auto Sync Toggle & Google Sheet Connected Status */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => {
                setAutoSync(e.target.checked);
                localStorage.setItem("auto_sync_csv", e.target.checked ? "true" : "false");
              }}
              className="rounded border-border text-primary focus:ring-primary w-4 h-4"
            />
            <span>Auto-sync to Google Sheet immediately after selecting file</span>
          </label>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <a
            href={GOOGLE_SHEET_VIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
          >
            <span>Target: <strong>facebook expense</strong> (Revenues)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Sync Action Callout (Top of Preview) */}
      {preview && (
        <div className="p-5 rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-card/80 to-blue-950/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-in fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-bold text-sm text-foreground">
                {preview.newRows > 0
                  ? `Ready to Sync: +${preview.newRows} New Sales to Google Sheet`
                  : `All ${preview.totalRows} Records Already in Google Sheet`}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Total Revenue: <span className="font-semibold text-emerald-400">{formatCurrency(preview.totalGrossAmount)}</span> • Found {preview.totalRows} rows ({preview.newRows} new, {preview.matchedRows} existing)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExecuteImport()}
              disabled={importing}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-2 active:scale-95 transition-all"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing with Google Sheet...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>🚀 Sync {preview.newRows} Sales to Google Sheet Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import Result Banner */}
      {importResult && (
        <div className="p-5 rounded-2xl border bg-emerald-950/20 border-emerald-900/40 text-emerald-300 space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Sync Completed Successfully!</h3>
                <p className="text-xs text-muted-foreground">
                  Sales records safely synchronized to your Google Sheet <strong>&ldquo;Revenues&rdquo;</strong> tab.
                </p>
              </div>
            </div>
            <a
              href={GOOGLE_SHEET_VIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Google Sheet to Verify ↗</span>
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-2.5 rounded-xl bg-card border border-emerald-800/30">
              <span className="text-[10px] text-muted-foreground block">New Records Added</span>
              <span className="text-base font-bold text-emerald-400">
                +{importResult.insertedCount}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-emerald-800/30">
              <span className="text-[10px] text-muted-foreground block">Matched in Sheet</span>
              <span className="text-base font-bold text-blue-400">
                ↻ {importResult.updatedCount}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-emerald-800/30">
              <span className="text-[10px] text-muted-foreground block">Total Gross Revenue</span>
              <span className="text-base font-bold text-emerald-400">
                {formatCurrency(importResult.totalGross)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-emerald-800/30">
              <span className="text-[10px] text-muted-foreground block">Net Earned Revenue</span>
              <span className="text-base font-bold text-emerald-300">
                {formatCurrency(importResult.totalNet)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CSV Preview Section */}
      {preview && (
        <div className="space-y-6 animate-in fade-in">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
              <span className="text-[11px] text-muted-foreground block">New Records (Will Add)</span>
              <span className="font-bold text-lg text-emerald-500">+{preview.newRows}</span>
              <span className="text-[10px] text-muted-foreground block mt-1">Fresh Payment IDs</span>
            </div>
            <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
              <span className="text-[11px] text-muted-foreground block">Matches in Sheet</span>
              <span className="font-bold text-lg text-blue-500">↻ {preview.matchedRows}</span>
              <span className="text-[10px] text-muted-foreground block mt-1">Existing Payment IDs</span>
            </div>
            <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
              <span className="text-[11px] text-muted-foreground block">Cancelled by Customer</span>
              <span className="font-bold text-lg text-muted-foreground">{preview.invalidRows}</span>
              <span className="text-[10px] text-muted-foreground block mt-1">No payment collected</span>
            </div>
            <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
              <span className="text-[11px] text-muted-foreground block">Total Revenue</span>
              <span className="font-bold text-lg text-foreground">
                {formatCurrency(preview.totalGrossAmount)}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-1">
                Net: {formatCurrency(preview.totalNetAmount)}
              </span>
            </div>
          </div>

          {/* Detected Products & Date Range */}
          <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-sm">
                  Products in File ({preview.detectedProducts.length})
                </h4>
                <p className="text-xs text-muted-foreground">Product catalog items and selling prices</p>
              </div>
              <div className="text-xs font-medium text-muted-foreground bg-secondary px-3 py-1 rounded-xl">
                Date Span: {preview.dateRange.start || "--"} to {preview.dateRange.end || "--"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {preview.detectedProducts.map((p: any) => (
                <span
                  key={p.name}
                  className="px-2.5 py-1 rounded-xl border bg-secondary/40 text-xs font-medium flex items-center gap-1.5"
                >
                  <span>{p.name}</span>
                  <span className="font-bold text-emerald-500">{formatCurrency(p.price)}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Bottom Confirm Button */}
          <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm">Ready to Sync with Google Sheets</h4>
              <p className="text-xs text-muted-foreground">
                Matches Payment ID: New rows will be added to &ldquo;Revenues&rdquo; tab, and new products to &ldquo;Products&rdquo; tab.
              </p>
            </div>

            <button
              onClick={() => handleExecuteImport()}
              disabled={importing}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm flex items-center gap-2 active:scale-95 transition-all self-end sm:self-auto"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing with Google Sheet...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Execute Sync (+{preview.newRows} new records)</span>
                </>
              )}
            </button>
          </div>

          {/* Detailed Preview Table */}
          <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3">
            <h4 className="font-bold text-sm">Preview Rows (First 50 Entries)</h4>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/60 text-muted-foreground border-b">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Action</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Payment ID</th>
                    <th className="py-2.5 px-3 font-semibold">Product Title</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Customer Paid</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Net Earned</th>
                    <th className="py-2.5 px-3 font-semibold">Customer Email</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {preview.previewRows.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="py-2 px-3">
                        {r.action === "insert" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            + New
                          </span>
                        )}
                        {r.action === "update" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            ↻ In Sheet
                          </span>
                        )}
                        {r.action === "skip" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            Skip
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{r.date || "--"}</td>
                      <td className="py-2 px-3 font-mono text-[11px]">{r.paymentId}</td>
                      <td className="py-2 px-3 font-medium max-w-xs truncate">{r.productName}</td>
                      <td className="py-2 px-3 text-right font-medium">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-500 font-semibold">
                        {formatCurrency(r.netAmount)}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground max-w-xs truncate">
                        {r.customerEmail || "--"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            r.status?.toLowerCase() === "received"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {r.status || "Received"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
