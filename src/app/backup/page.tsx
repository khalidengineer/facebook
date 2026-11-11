"use client";

import React, { useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import {
  DatabaseBackup,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  HardDrive,
} from "lucide-react";

export default function BackupRestorePage() {
  const { success, error } = useToast();
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const handleDownloadDb = () => {
    window.open("/api/backup", "_blank");
  };

  const handleExportAll = (fmt: "csv" | "xlsx") => {
    window.open(`/api/export?target=all_transactions&format=${fmt}&preset=all_time`, "_blank");
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile || !restoreConfirm) {
      error("Confirmation Required", "Please check the confirmation box and select a backup file.");
      return;
    }

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", restoreFile);
      formData.append("confirm", "true");

      const res = await fetch("/api/backup", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        success("Database Restored", data.message);
        setRestoreFile(null);
        setRestoreConfirm(false);
        window.dispatchEvent(new Event("refresh_data"));
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Restore Failed", err.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <DatabaseBackup className="w-5 h-5 text-primary" />
          <span>Database Backup & Restore</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Download SQLite database snapshots and restore safely with automatic pre-restore safety copies
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-2xl border bg-blue-950/20 border-blue-900/40 text-xs flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-foreground">Zero Data-Loss Architecture</h4>
          <p className="text-muted-foreground mt-0.5 leading-relaxed">
            Your data is stored in the local SQLite database <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-foreground">expense.db</code>. Whenever you trigger a database restore, the system automatically creates a timestamped safety backup of your existing database before applying the new file.
          </p>
        </div>
      </div>

      {/* Download Backups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SQLite Direct Download */}
        <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base">Direct SQLite Database Backup</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Download the complete, untouched <code className="bg-secondary px-1 py-0.5 rounded font-mono">expense.db</code> file. Contains all tables, indexes, Facebook Ads, products, and Cosmofeed revenue records.
            </p>
          </div>

          <button
            onClick={handleDownloadDb}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download expense.db</span>
          </button>
        </div>

        {/* Spreadsheet Export */}
        <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base">Full Spreadsheet Export</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Export all historic records across all time into Excel or CSV formats suitable for accountants, tax filings, or spreadsheet analysis.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleExportAll("csv")}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-secondary border hover:bg-secondary/70 flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExportAll("xlsx")}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-secondary border hover:bg-secondary/70 flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restore Database Section */}
      <div className="p-6 rounded-3xl border bg-card/60 backdrop-blur-md space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">Restore SQLite Database</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload a previously downloaded <code className="bg-secondary px-1 py-0.5 rounded font-mono">.db</code> or SQLite backup file. The system validates the SQLite format before applying.
            </p>
          </div>
        </div>

        <form onSubmit={handleRestoreSubmit} className="space-y-4 pt-2 border-t">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Select SQLite Backup File (.db)
            </label>
            <input
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-border file:text-xs file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-secondary/70 cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-xl bg-secondary/50 border">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
              <span className="leading-relaxed">
                I understand that this will replace the current active database with the contents of the uploaded file. An automatic safety snapshot will be saved.
              </span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!restoreFile || !restoreConfirm || restoring}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 flex items-center gap-2 shadow-sm transition-all"
            >
              {restoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating and Restoring...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Restore Database</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
