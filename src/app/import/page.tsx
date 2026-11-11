"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/date-utils";
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
} from "lucide-react";

export default function CSVImportPage() {
  const { success, error } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Load sample data.csv
  const handleLoadSample = async () => {
    setAnalyzing(true);
    setPreview(null);
    setImportResult(null);
    setFile(null);
    try {
      const res = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useSampleFile: true }),
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data.preview);
        success(
          "data.csv Analyzed",
          `Found ${data.preview.totalRows} rows: ${data.preview.newRows} new, ${data.preview.matchedRows} to update`
        );
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Analysis Failed", err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle uploaded file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setPreview(null);
    setImportResult(null);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      const res = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data.preview);
        success(
          "File Parsed",
          `Found ${data.preview.totalRows} rows: ${data.preview.newRows} new, ${data.preview.matchedRows} to update`
        );
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Parse Error", err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Execute import / upsert
  const handleExecuteImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      let res: Response;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("onlyReceived", "true");
        res = await fetch("/api/import/execute", {
          method: "POST",
          body: formData,
        });
      } else {
        // Sample file from project root
        res = await fetch("/api/import/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            useSampleFile: true,
            onlyReceived: true,
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        setImportResult(data);
        success(
          "Sync Completed Successfully!",
          `Added ${data.insertedCount} new sales, updated/replaced ${data.updatedCount} existing records.`
        );
        window.dispatchEvent(new Event("refresh_data"));
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Import Failed", err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-primary" />
            <span>CSV Import & Sync Engine</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Upload your sales CSV: Existing Payment IDs are updated/replaced; new records are inserted automatically
          </p>
        </div>

        <button
          onClick={handleLoadSample}
          disabled={analyzing}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground border flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Load & Match data.csv</span>
        </button>
      </div>

      {/* Sync Strategy Explanation Notice */}
      <div className="p-4 rounded-2xl border bg-blue-950/20 border-blue-900/40 text-xs flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-foreground">Intelligent Payment ID Matching</h4>
          <p className="text-muted-foreground mt-0.5 leading-relaxed">
            Every row in your Cosmofeed CSV contains a unique <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-foreground">Payment ID</code>.
            If a Payment ID already exists in your <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-foreground">expense.db</code> database, it will be <strong>replaced and updated</strong> with the new CSV row data.
            If the Payment ID is new, it will be <strong>added as a fresh record</strong>. Products and selling prices are synced directly into your product catalog.
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="p-6 sm:p-8 rounded-3xl border-2 border-dashed border-border/80 bg-card/40 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-4 hover:border-primary/50 transition-colors">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <div>
          <h3 className="font-bold text-base">Select or Drop your CSV file here</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Supports Cosmofeed export format with Payment ID, Earned Amount, Paid By Customer, Product Title, Date, etc.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <label className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm active:scale-95 transition-all">
            <span>Browse CSV File</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            onClick={handleLoadSample}
            disabled={analyzing}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-secondary border hover:bg-secondary/70 flex items-center gap-1.5"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
            <span>Preview & Sync data.csv</span>
          </button>
        </div>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div className="p-5 rounded-2xl border bg-emerald-950/20 border-emerald-900/40 text-emerald-300 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm">Database Sync Successful</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Changes safely written to <code className="bg-emerald-900/40 px-1.5 py-0.5 rounded text-emerald-200">expense.db</code> with complete audit trail.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-2.5 rounded-xl bg-card border border-emerald-800/30">
              <span className="text-[10px] text-muted-foreground block">New Records Added</span>
              <span className="text-base font-bold text-emerald-400">+{importResult.insertedCount}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-emerald-800/30">
              <span className="text-[10px] text-muted-foreground block">Matched & Replaced</span>
              <span className="text-base font-bold text-blue-400">↻ {importResult.updatedCount}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-emerald-800/30">
              <span className="text-[10px] text-muted-foreground block">Total Gross Revenue</span>
              <span className="text-base font-bold text-emerald-400">{formatCurrency(importResult.totalGross)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-emerald-800/30">
              <span className="text-[10px] text-muted-foreground block">Net Earned Revenue</span>
              <span className="text-base font-bold text-emerald-300">{formatCurrency(importResult.totalNet)}</span>
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
              <span className="text-[11px] text-muted-foreground block">Matches (Will Replace)</span>
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
              <span className="font-bold text-lg text-foreground">{formatCurrency(preview.totalGrossAmount)}</span>
              <span className="text-[10px] text-muted-foreground block mt-1">Net: {formatCurrency(preview.totalNetAmount)}</span>
            </div>
          </div>

          {/* Detected Products & Date Range */}
          <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-sm">Products in CSV ({preview.detectedProducts.length})</h4>
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

          {/* Confirm Button */}
          <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm">Ready to Sync with expense.db</h4>
              <p className="text-xs text-muted-foreground">
                Matches Payment ID: Existing rows will be updated/replaced, new rows will be inserted.
              </p>
            </div>

            <button
              onClick={handleExecuteImport}
              disabled={importing || (preview.newRows === 0 && preview.matchedRows === 0)}
              className="px-6 py-3 rounded-2xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-95 transition-all"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Syncing Database...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Sync (Add {preview.newRows} & Update {preview.matchedRows})</span>
                </>
              )}
            </button>
          </div>

          {/* Table Preview */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm">Preview Records (First 75 Rows)</h4>
            <div className="overflow-x-auto rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/70 text-muted-foreground border-b uppercase font-semibold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Sync Action</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Product Title</th>
                    <th className="py-3 px-4 text-right">Customer Paid</th>
                    <th className="py-3 px-4 text-right">Net Earned</th>
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.previewRows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        {r.action === "insert" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
                            + New (Will Add)
                          </span>
                        ) : r.action === "update" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500">
                            ↻ Match (Will Replace)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground" title={r.reason}>
                            Cancelled (Skip)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium whitespace-nowrap">{r.date || "N/A"}</td>
                      <td className="py-3 px-4 max-w-[220px] truncate font-medium text-foreground">
                        {r.productName}
                      </td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-500 whitespace-nowrap">
                        {formatCurrency(r.netAmount)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                        {r.paymentId}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status?.toLowerCase() === "received"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {r.status || "Unknown"}
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
