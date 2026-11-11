"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Copy,
  Download,
  Settings,
  Database,
  Code2,
  CloudUpload,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

interface SheetConfig {
  sheetId: string;
  sheetUrl: string;
  webhookUrl: string;
  lastSync: string | null;
  autoSync: boolean;
}

interface ExportCounts {
  revenues: number;
  ads: number;
  otherExpenses: number;
  products: number;
}

export default function GoogleSheetsPage() {
  const { success, error } = useToast();
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);
  const [counts, setCounts] = useState<ExportCounts>({ revenues: 0, ads: 0, otherExpenses: 0, products: 0 });
  const [csvData, setCsvData] = useState<Record<string, string>>({});
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);

  // Settings edit state
  const [editSheetUrl, setEditSheetUrl] = useState("");
  const [editWebhookUrl, setEditWebhookUrl] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  useEffect(() => {
    loadConfigAndCounts();
  }, []);

  const handleTestWebhook = async () => {
    if (!editWebhookUrl || !editWebhookUrl.trim()) {
      error("Please enter a Google Apps Script Web App URL first!");
      return;
    }
    setTestingWebhook(true);
    try {
      const res = await fetch("/api/sheets/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: editWebhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        success("Webhook Connected Successfully!", `Target Spreadsheet: "${data.sheetName}". Real-time writes are verified!`);
      } else {
        error("Connection Failed", data.error || "Could not connect to Apps Script");
      }
    } catch (err: any) {
      error("Connection Test Error", err.message);
    } finally {
      setTestingWebhook(false);
    }
  };

  const loadConfigAndCounts = async () => {
    setLoading(true);
    try {
      const [confRes, exportRes] = await Promise.all([
        fetch("/api/sheets/config"),
        fetch("/api/sheets/export-csvs"),
      ]);
      const confData = await confRes.json();
      const exportData = await exportRes.json();

      if (confData.success) {
        setConfig(confData.config);
        setEditSheetUrl(confData.config.sheetUrl);
        setEditWebhookUrl(confData.config.webhookUrl || "");
      }
      if (exportData.success) {
        setCounts(exportData.counts);
        setCsvData(exportData.csvData);
      }
    } catch {
      error("Failed to load Google Sheets config");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sheets/sync");
      const data = await res.json();
      if (data.success) {
        success(
          "Google Sheet Synced!",
          `Revenues: ${data.tabs.revenues.rows}, Ads: ${data.tabs.facebookAds.rows}, Products: ${data.tabs.products.rows}`
        );
        loadConfigAndCounts();
      } else {
        error(data.error || "Failed to sync from Google Sheet");
      }
    } catch {
      error("Network error syncing Google Sheet");
    } finally {
      setSyncing(false);
    }
  };

  const handlePushAll = async () => {
    if (!config?.webhookUrl) {
      error("Please configure your Google Apps Script Web App URL first!");
      return;
    }

    setPushingAll(true);
    try {
      const res = await fetch("/api/sheets/push-all", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        success("Initial Data Pushed to Google Sheet!", "All 61 orders, products, and expenses are now inside your Google Sheet!");
        handleSync();
      } else {
        error(data.error || "Failed to push data to Google Sheet");
      }
    } catch {
      error("Network error pushing to Google Sheet");
    } finally {
      setPushingAll(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/sheets/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetUrl: editSheetUrl,
          webhookUrl: editWebhookUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        success("Google Sheet configuration saved!");
        loadConfigAndCounts();
      } else {
        error(data.error || "Failed to save configuration");
      }
    } catch {
      error("Network error saving configuration");
    } finally {
      setSavingSettings(false);
    }
  };

  const copyToClipboard = (text: string, tabKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabKey);
    success(`Copied ${tabKey} data!`, "Paste directly into cell A2 of Google Sheet.");
    setTimeout(() => setCopiedTab(null), 3000);
  };

  const appsScriptCode = `function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'read_all';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (action === 'ping') return createJsonResponse({ success: true, status: 'Connected to Google Sheet!' });
  if (action === 'read_all') {
    return createJsonResponse({
      success: true,
      revenues: readSheetData(ss, 'Revenues'),
      facebookAds: readSheetData(ss, 'Facebook Ads'),
      otherExpenses: readSheetData(ss, 'Other Expenses'),
      products: readSheetData(ss, 'Products')
    });
  }
  return createJsonResponse({ success: false, error: 'Unknown action' });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData ? e.postData.contents : '{}');
    var action = payload.action || 'create';
    var sheetName = payload.sheet || 'Facebook Ads';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, sheetName);

    if (action === 'create') {
      var rowData = formatRowForSheet(sheetName, payload.data);
      sheet.appendRow(rowData);
      return createJsonResponse({ success: true, action: 'create', rowNumber: sheet.getLastRow() });
    }
    if (action === 'update') {
      var rowNumber = payload.rowNumber || findRowById(sheet, sheetName, payload.id);
      if (!rowNumber) return createJsonResponse({ success: false, error: 'Row not found' });
      var updated = formatRowForSheet(sheetName, payload.data);
      sheet.getRange(rowNumber, 1, 1, updated.length).setValues([updated]);
      return createJsonResponse({ success: true, action: 'update', rowNumber: rowNumber });
    }
    if (action === 'delete') {
      var rowNumber = payload.rowNumber || findRowById(sheet, sheetName, payload.id);
      if (!rowNumber) return createJsonResponse({ success: false, error: 'Row not found' });
      sheet.deleteRow(rowNumber);
      return createJsonResponse({ success: true, action: 'delete' });
    }
    if (action === 'bulk_insert') {
      var rows = payload.rows || [];
      if (rows.length > 0) {
        var formatted = [];
        for (var i = 0; i < rows.length; i++) formatted.push(formatRowForSheet(sheetName, rows[i]));
        sheet.getRange(sheet.getLastRow() + 1, 1, formatted.length, formatted[0].length).setValues(formatted);
      }
      return createJsonResponse({ success: true, count: rows.length });
    }
    return createJsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function getOrCreateSheet(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(getDefaultHeaders(name));
  }
  return s;
}

function getDefaultHeaders(sheetName) {
  if (sheetName === 'Revenues') return ['Date', 'Payment ID', 'Product Title', 'Paid By Customer', 'Earned Amount', 'Customer Email', 'Status'];
  if (sheetName === 'Facebook Ads') return ['Date', 'Campaign Name', 'Product', 'Amount Spent', 'Campaign Type', 'Notes'];
  if (sheetName === 'Other Expenses') return ['Date', 'Category', 'Description', 'Amount', 'Notes'];
  if (sheetName === 'Products') return ['Product Name', 'Category', 'Selling Price', 'Product Cost'];
  return ['Col1', 'Col2', 'Col3', 'Col4', 'Col5'];
}

function formatRowForSheet(sheetName, data) {
  if (!data) data = {};
  if (sheetName === 'Revenues') {
    return [
      data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      data.payment_id || data.paymentId || ('MANUAL-' + Date.now()),
      data.product_name || data.product_title || data.productTitle || '',
      parseFloat(data.amount || data.paid_by_customer || 0) || 0,
      parseFloat(data.net_amount || data.earned_amount || 0) || 0,
      data.customer_email || data.customerEmail || '',
      data.status || 'Received'
    ];
  }
  if (sheetName === 'Facebook Ads') {
    return [
      data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      data.campaign_name || '',
      data.product_name || data.product || '',
      parseFloat(data.amount || data.amount_spent || 0) || 0,
      data.campaign_type || 'Sales',
      data.notes || ''
    ];
  }
  if (sheetName === 'Other Expenses') {
    return [
      data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      data.category || 'Miscellaneous',
      data.description || '',
      parseFloat(data.amount || 0) || 0,
      data.notes || ''
    ];
  }
  if (sheetName === 'Products') {
    return [
      data.name || data.product_name || '',
      data.category || 'Digital Notes',
      parseFloat(data.selling_price || 0) || 0,
      parseFloat(data.product_cost || 0) || 0
    ];
  }
  return Object.values(data);
}

function readSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var rowObj = { _rowNumber: i + 1 };
    var has = false;
    for (var j = 0; j < headers.length; j++) {
      var val = values[i][j];
      if (val instanceof Date) val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      rowObj[String(headers[j]).trim()] = val;
      if (val !== '' && val !== null && val !== undefined) has = true;
    }
    if (has) rows.push(rowObj);
  }
  return rows;
}

function findRowById(sheet, sheetName, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var rowNumber = i + 2;
    if (String(rowNumber) === String(id)) return rowNumber;
    if (sheetName === 'Revenues' && String(values[i][1]) === String(id)) return rowNumber;
    if (sheetName === 'Products' && String(values[i][0]) === String(id)) return rowNumber;
  }
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;

  const copyAppsScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setScriptCopied(true);
    success("Google Apps Script code copied to clipboard!");
    setTimeout(() => setScriptCopied(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl p-6 lg:p-8 text-white shadow-xl shadow-emerald-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide uppercase">
            <Table className="w-3.5 h-3.5" />
            <span>Google Sheet Cloud Database (100% Exclusively)</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">Google Sheets Integration</h2>
          <p className="text-emerald-100 text-sm max-w-2xl leading-relaxed">
            Your application runs 100% on Google Sheets. All data entry, editing, deletions (CRUD), and dashboard reporting happen directly with your Google Sheet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {config?.sheetUrl && (
            <a
              href={config.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 font-semibold text-xs shadow-md transition-all active:scale-95"
            >
              <span>Open Google Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/60 border border-white/20 font-bold text-xs text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Sync Sheet Now"}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Info */}
      {config && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground block font-medium">Connected Google Sheet</span>
              <span className="text-sm font-bold truncate block">{config.sheetId}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground block font-medium">Last Synchronized</span>
              <span className="text-sm font-bold block">
                {config.lastSync ? new Date(config.lastSync).toLocaleString("en-IN") : "Ready"}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground block font-medium">Data Source</span>
              <span className="text-sm font-bold block text-purple-600 dark:text-purple-400">
                100% Google Sheet (Direct CRUD)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4 Tabs Population & Quick Action Section */}
      <div className="p-6 rounded-3xl border bg-card/70 backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Populate Google Sheet with Initial Records</h3>
            <p className="text-xs text-muted-foreground mt-1">
              If your Google Sheet tabs are empty, copy the formatted data below or download CSV files to paste directly into cell <strong>A2</strong> of each tab.
            </p>
          </div>

          {config?.webhookUrl && (
            <button
              onClick={handlePushAll}
              disabled={pushingAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 shrink-0"
            >
              {pushingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
              <span>{pushingAll ? "Pushing to Sheet..." : "1-Click Push All into Sheet"}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenues Tab Card */}
          <div className="p-4 rounded-2xl border bg-secondary/30 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Tab: Revenues</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                  {counts.revenues} Records
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Cosmofeed sales data with Payment ID, customer email, amount, and net earned.
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <button
                onClick={() => copyToClipboard(csvData.revenues || "", "Revenues")}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-card hover:bg-secondary border text-xs font-semibold shadow-sm transition-all"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{copiedTab === "Revenues" ? "Copied!" : "Copy Data to Paste"}</span>
              </button>
              <a
                href="/api/sheets/export-csvs?tab=revenues"
                download="GoogleSheet_Revenues.csv"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Download CSV</span>
              </a>
            </div>
          </div>

          {/* Facebook Ads Tab Card */}
          <div className="p-4 rounded-2xl border bg-secondary/30 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Tab: Facebook Ads</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">
                  {counts.ads} Records
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Meta Ads spend: Date, Campaign Name, Product, Amount Spent, Campaign Type.
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <button
                onClick={() => copyToClipboard(csvData.facebookAds || "", "Facebook Ads")}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-card hover:bg-secondary border text-xs font-semibold shadow-sm transition-all"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{copiedTab === "Facebook Ads" ? "Copied!" : "Copy Data to Paste"}</span>
              </button>
              <a
                href="/api/sheets/export-csvs?tab=facebook_ads"
                download="GoogleSheet_FacebookAds.csv"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Download CSV</span>
              </a>
            </div>
          </div>

          {/* Other Expenses Tab Card */}
          <div className="p-4 rounded-2xl border bg-secondary/30 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Tab: Other Expenses</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">
                  {counts.otherExpenses} Records
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Hosting, software, Canva, tools, and operational overhead.
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <button
                onClick={() => copyToClipboard(csvData.otherExpenses || "", "Other Expenses")}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-card hover:bg-secondary border text-xs font-semibold shadow-sm transition-all"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{copiedTab === "Other Expenses" ? "Copied!" : "Copy Data to Paste"}</span>
              </button>
              <a
                href="/api/sheets/export-csvs?tab=other_expenses"
                download="GoogleSheet_OtherExpenses.csv"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Download CSV</span>
              </a>
            </div>
          </div>

          {/* Products Tab Card */}
          <div className="p-4 rounded-2xl border bg-secondary/30 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Tab: Products</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600">
                  {counts.products} Records
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Catalog of active products, default selling prices, and unit product costs.
              </p>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <button
                onClick={() => copyToClipboard(csvData.products || "", "Products")}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-card hover:bg-secondary border text-xs font-semibold shadow-sm transition-all"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{copiedTab === "Products" ? "Copied!" : "Copy Data to Paste"}</span>
              </button>
              <a
                href="/api/sheets/export-csvs?tab=products"
                download="GoogleSheet_Products.csv"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Download CSV</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Way Sync / Google Apps Script Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Box */}
        <div className="p-6 rounded-3xl border bg-card/60 backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base">Google Sheet Configuration</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Connect your Google Apps Script Web App URL so that any data entered, edited, or deleted from the dashboard writes directly to your Google Sheet!
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold block mb-1.5">Google Sheet URL</label>
              <input
                type="text"
                value={editSheetUrl}
                onChange={(e) => setEditSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5">
                Google Apps Script Web App URL <span className="text-emerald-500 font-bold">(Enables Full CRUD Write into Google Sheet)</span>
              </label>
              <input
                type="text"
                value={editWebhookUrl}
                onChange={(e) => setEditWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-primary focus:outline-none font-mono text-[11px]"
              />
              <span className="text-[11px] text-muted-foreground block mt-1">
                Deploy the script on the right and paste the Web App URL here.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>

              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={testingWebhook || !editWebhookUrl}
                className="px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 border text-foreground font-semibold text-xs transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {testingWebhook && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{testingWebhook ? "Testing..." : "Test Connection"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Apps Script Guide */}
        <div className="p-6 rounded-3xl border bg-card/60 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Code2 className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-base">Full CRUD Google Apps Script</h3>
            </div>
            <button
              onClick={copyAppsScript}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all active:scale-95"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{scriptCopied ? "Copied!" : "1-Click Copy Script"}</span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            To enable direct Data Entry, Edit &amp; Delete from the Web App into Google Sheet:
          </p>

          <ol className="text-xs space-y-2 text-muted-foreground list-decimal list-inside bg-secondary/30 p-4 rounded-2xl border">
            <li>In your Google Sheet, click <strong>Extensions &gt; Apps Script</strong>.</li>
            <li>Delete existing code and paste this script (click button above).</li>
            <li>Click <strong>Deploy &gt; New deployment</strong>.</li>
            <li>Select type <strong>Web app</strong>. Set <em>Execute as:</em> <strong>Me</strong> and <em>Who has access:</em> <strong>Anyone</strong>.</li>
            <li>Click <strong>Deploy</strong>, copy the generated Web App URL, and paste it into the field on the left!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
