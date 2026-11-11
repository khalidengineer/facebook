import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { normalizeDateToISO, MIN_DATA_DATE } from "./date-utils";

export const DEFAULT_SHEET_ID = "1LfzTmzaUpybViSZ2g-lKgr7v4NbMoNogIOz_IYtReVA";
export const DEFAULT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/edit?usp=sharing`;

const CONFIG_FILE = path.join(process.cwd(), "sheet-config.json");
const CACHE_FILE = path.join(process.cwd(), "data", "sheet-cache.json");

export interface SheetConfig {
  sheetId: string;
  sheetUrl: string;
  webhookUrl: string;
  lastSync: string | null;
  autoSync: boolean;
}

export interface RevenueItem {
  id: string;
  date: string;
  payment_id: string;
  product_name: string;
  product_id?: number | null;
  amount: number;
  net_amount: number;
  product_cost: number;
  customer_email: string;
  customer_phone?: string;
  status: string;
  row_number?: number;
}

export interface AdExpenseItem {
  id: string;
  date: string;
  campaign_name: string;
  ad_account_name?: string;
  product_name: string;
  product_id?: number | null;
  campaign_type: string;
  amount: number;
  currency: string;
  notes: string;
  row_number?: number;
}

export interface OtherExpenseItem {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  notes: string;
  row_number?: number;
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  product_cost: number;
  row_number?: number;
}

export interface SheetDatabase {
  revenues: RevenueItem[];
  facebookAds: AdExpenseItem[];
  otherExpenses: OtherExpenseItem[];
  products: ProductItem[];
  lastFetchedAt: number;
}

// In-memory cache
let inMemoryDb: SheetDatabase = {
  revenues: [],
  facebookAds: [],
  otherExpenses: [],
  products: [],
  lastFetchedAt: 0,
};

// -------------------------------------------------------------
// CONFIGURATION MANAGEMENT
// -------------------------------------------------------------
export function getSheetConfig(): SheetConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf8");
      const parsed = JSON.parse(raw);
      return {
        sheetId: process.env.GOOGLE_SHEET_ID || parsed.sheetId || DEFAULT_SHEET_ID,
        sheetUrl: process.env.GOOGLE_SHEET_URL || parsed.sheetUrl || DEFAULT_SHEET_URL,
        webhookUrl: process.env.GOOGLE_SHEET_WEBHOOK_URL || parsed.webhookUrl || "",
        lastSync: parsed.lastSync || null,
        autoSync: parsed.autoSync !== undefined ? parsed.autoSync : true,
      };
    }
  } catch {}
  return {
    sheetId: process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID,
    sheetUrl: process.env.GOOGLE_SHEET_URL || DEFAULT_SHEET_URL,
    webhookUrl: process.env.GOOGLE_SHEET_WEBHOOK_URL || "",
    lastSync: null,
    autoSync: true,
  };
}

export function saveSheetConfig(updates: Partial<SheetConfig>): SheetConfig {
  const current = getSheetConfig();
  const next: SheetConfig = { ...current, ...updates };
  if (updates.sheetId && !updates.sheetUrl) {
    next.sheetUrl = `https://docs.google.com/spreadsheets/d/${updates.sheetId}/edit?usp=sharing`;
  }
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not persist sheet-config.json (serverless/read-only environment):", err);
  }
  return next;
}

// -------------------------------------------------------------
// INITIAL LOCAL CACHE PERSISTENCE
// -------------------------------------------------------------
function ensureDataDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadLocalCache(): SheetDatabase | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

function saveLocalCache(db: SheetDatabase) {
  try {
    ensureDataDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch {}
}

// -------------------------------------------------------------
// LIVE FETCH FROM GOOGLE SHEET
// -------------------------------------------------------------
export async function fetchLiveSheetData(force = false): Promise<SheetDatabase> {
  const now = Date.now();
  // 10 second memory cache to avoid spamming Google Sheets on rapid renders
  if (!force && inMemoryDb.lastFetchedAt > 0 && now - inMemoryDb.lastFetchedAt < 10_000) {
    return inMemoryDb;
  }

  const config = getSheetConfig();
  const sheetId = config.sheetId || DEFAULT_SHEET_ID;

  // 1. Try Apps Script Webhook (Full JSON) if configured
  if (config.webhookUrl && config.webhookUrl.startsWith("http")) {
    try {
      const res = await fetch(`${config.webhookUrl}?action=read_all`, {
        redirect: "follow",
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const parsed = parseAppsScriptJson(json);
          inMemoryDb = { ...parsed, lastFetchedAt: now };
          saveLocalCache(inMemoryDb);
          saveSheetConfig({ lastSync: new Date().toISOString() });
          return inMemoryDb;
        }
      }
    } catch (err: any) {
      console.warn("Apps Script Webhook fetch error, falling back to public CSV:", err.message);
    }
  }

  // 2. Fetch from Public Google Sheet CSV tabs
  try {
    const [revCsv, adsCsv, expCsv, prodCsv] = await Promise.all([
      fetchSheetTabCSV(sheetId, "Revenues"),
      fetchSheetTabCSV(sheetId, "Facebook Ads"),
      fetchSheetTabCSV(sheetId, "Other Expenses"),
      fetchSheetTabCSV(sheetId, "Products"),
    ]);

    const parsedRevenues = parseRevenuesCSV(revCsv);
    const parsedAds = parseFacebookAdsCSV(adsCsv);
    const parsedExpenses = parseOtherExpensesCSV(expCsv);
    const parsedProducts = parseProductsCSV(prodCsv, parsedRevenues);

    // Pure 1:1 Mirror: Whatever is in Google Sheet is what inMemoryDb will be!
    // But preserve any local unpushed items (created locally when webhook was offline/unconfigured)
    const existingAdIds = new Set(parsedAds.map((a) => a.id));
    const unpushedAds = inMemoryDb.facebookAds.filter(
      (a) => a.id && a.id.startsWith("AD-") && !existingAdIds.has(a.id)
    );

    const existingExpIds = new Set(parsedExpenses.map((e) => e.id));
    const unpushedExpenses = inMemoryDb.otherExpenses.filter(
      (e) => e.id && e.id.startsWith("EXP-") && !existingExpIds.has(e.id)
    );

    const existingRevIds = new Set(parsedRevenues.map((r) => r.id || r.payment_id));
    const unpushedRevs = inMemoryDb.revenues.filter(
      (r) =>
        (r.id?.startsWith("PAY-") || r.payment_id?.startsWith("MANUAL-")) &&
        !existingRevIds.has(r.id) &&
        !existingRevIds.has(r.payment_id)
    );

    const existingProdNames = new Set(parsedProducts.map((p) => p.name.trim().toLowerCase()));
    const unpushedProds = inMemoryDb.products.filter(
      (p) => p.id?.startsWith("PROD-") && !existingProdNames.has(p.name.trim().toLowerCase())
    );

    inMemoryDb = {
      revenues: [...unpushedRevs, ...parsedRevenues],
      facebookAds: [...unpushedAds, ...parsedAds],
      otherExpenses: [...unpushedExpenses, ...parsedExpenses],
      products: [...unpushedProds, ...parsedProducts],
      lastFetchedAt: now,
    };
    saveLocalCache(inMemoryDb);
    saveSheetConfig({ lastSync: new Date().toISOString() });
  } catch (err: any) {
    console.warn("Public CSV fetch error:", err.message);
  }

  return inMemoryDb;
}

async function fetchSheetTabCSV(sheetId: string, tabName: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&t=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Antigravity/1.0",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });
  if (!res.ok) return "";
  return await res.text();
}

function parseRevenuesCSV(csv: string): RevenueItem[] {
  if (!csv || csv.trim().length === 0) return [];
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy" });
  const items: RevenueItem[] = [];

  parsed.data.forEach((r, idx) => {
    const rawDate = r["Date"] || r["date"] || "";
    const isoDate = normalizeDateToISO(rawDate);
    const paymentId = (r["Payment ID"] || r["payment_id"] || r["PaymentId"] || "").trim();
    const productTitle = (r["Product Title"] || r["Product Name"] || r["product"] || "Digital Notes").trim();
    const status = (r["Status"] || r["status"] || "Received").trim();
    const paidByCustomer = parseFloat(r["Paid By Customer"] || r["amount"] || r["Amount"] || "0") || 0;
    const isCancelled = status.toLowerCase().includes("cancelled");
    const parsedEarned = parseFloat(r["Earned Amount"] || r["net_amount"] || "0");
    const earnedAmount = isCancelled ? 0 : (!isNaN(parsedEarned) && parsedEarned > 0 ? parsedEarned : paidByCustomer);

    if (!isoDate || paidByCustomer <= 0 || isoDate < MIN_DATA_DATE) return;

    items.push({
      id: paymentId || `REV-${idx + 2}`,
      date: isoDate,
      payment_id: paymentId || `REV-${idx + 2}`,
      product_name: productTitle,
      amount: paidByCustomer,
      net_amount: earnedAmount,
      product_cost: 0,
      customer_email: (r["Customer Email"] || r["email"] || "").trim(),
      customer_phone: (r["Customer Phone"] || r["phone"] || "").trim(),
      status,
      row_number: idx + 2,
    });
  });

  return items;
}

function parseFacebookAdsCSV(csv: string): AdExpenseItem[] {
  if (!csv || csv.trim().length === 0) return [];
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy" });
  const items: AdExpenseItem[] = [];

  parsed.data.forEach((r, idx) => {
    const rawDate = r["Date"] || r["date"] || "";
    const isoDate = normalizeDateToISO(rawDate);
    const campaign = (r["Campaign Name"] || r["Campaign"] || r["campaign_name"] || "").trim();
    const product = (r["Product"] || r["Product Name"] || "").trim();
    const amount = parseFloat(r["Amount Spent"] || r["Amount"] || r["amount"] || "0") || 0;
    const campaignType = (r["Campaign Type"] || "Sales").trim();
    const notes = (r["Notes"] || r["notes"] || "").trim();

    if (!isoDate || !campaign || amount <= 0 || isoDate < MIN_DATA_DATE) return;

    items.push({
      id: `AD-${idx + 2}`,
      date: isoDate,
      campaign_name: campaign,
      product_name: product,
      campaign_type: campaignType,
      amount,
      currency: "INR",
      notes,
      row_number: idx + 2,
    });
  });

  return items;
}

function parseOtherExpensesCSV(csv: string): OtherExpenseItem[] {
  if (!csv || csv.trim().length === 0) return [];
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy" });
  const items: OtherExpenseItem[] = [];

  parsed.data.forEach((r, idx) => {
    const rawDate = r["Date"] || r["date"] || "";
    const isoDate = normalizeDateToISO(rawDate);
    const category = (r["Category"] || r["category"] || "Miscellaneous").trim();
    const description = (r["Description"] || r["description"] || "Expense").trim();
    const amount = parseFloat(r["Amount"] || r["amount"] || "0") || 0;
    const notes = (r["Notes"] || r["notes"] || "").trim();

    if (!isoDate || amount <= 0 || isoDate < MIN_DATA_DATE) return;

    items.push({
      id: `EXP-${idx + 2}`,
      date: isoDate,
      category,
      description,
      amount,
      notes,
      row_number: idx + 2,
    });
  });

  return items;
}

function parseProductsCSV(csv: string, revenues: RevenueItem[]): ProductItem[] {
  const map = new Map<string, ProductItem>();

  if (csv && csv.trim().length > 0) {
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy" });
    parsed.data.forEach((r, idx) => {
      const name = (r["Product Name"] || r["Product Title"] || r["name"] || "").trim();
      if (!name) return;
      map.set(name.toLowerCase(), {
        id: `PROD-${idx + 2}`,
        name,
        category: (r["Category"] || "Digital Notes").trim(),
        selling_price: parseFloat(r["Selling Price"] || r["price"] || "0") || 0,
        product_cost: parseFloat(r["Product Cost"] || r["cost"] || "0") || 0,
        row_number: idx + 2,
      });
    });
  }

  // Also collect products found in revenues
  revenues.forEach((rev) => {
    const key = rev.product_name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        id: `PROD-REV-${map.size + 1}`,
        name: rev.product_name,
        category: "Digital Notes",
        selling_price: rev.amount,
        product_cost: 0,
      });
    }
  });

  return Array.from(map.values());
}

function parseAppsScriptJson(json: any): {
  revenues: RevenueItem[];
  facebookAds: AdExpenseItem[];
  otherExpenses: OtherExpenseItem[];
  products: ProductItem[];
} {
  const revenues: RevenueItem[] = (json.revenues || []).map((r: any, idx: number) => {
    const statusStr = String(r["Status"] || r.status || "Received");
    const isCancelledRev = statusStr.toLowerCase().includes("cancelled");
    const grossAmt = parseFloat(r["Paid By Customer"] || r.amount || 0) || 0;
    const rawNet = parseFloat(r["Earned Amount"] || r.net_amount || 0);
    const netAmt = isCancelledRev ? 0 : (!isNaN(rawNet) && rawNet > 0 ? rawNet : grossAmt);
    return {
      id: String(r["Payment ID"] || r.payment_id || `REV-${r._rowNumber || idx + 2}`),
      date: normalizeDateToISO(r["Date"] || r.date) || "",
      payment_id: String(r["Payment ID"] || r.payment_id || ""),
      product_name: String(r["Product Title"] || r.product_title || r.product_name || ""),
      amount: grossAmt,
      net_amount: netAmt,
      product_cost: 0,
      customer_email: String(r["Customer Email"] || r.customer_email || ""),
      status: statusStr,
      row_number: r._rowNumber || idx + 2,
    };
  });

  const facebookAds: AdExpenseItem[] = (json.facebookAds || []).map((r: any, idx: number) => ({
    id: String(r._rowNumber || idx + 2),
    date: normalizeDateToISO(r["Date"] || r.date) || "",
    campaign_name: String(r["Campaign Name"] || r.campaign_name || ""),
    product_name: String(r["Product"] || r.product || r.product_name || ""),
    campaign_type: String(r["Campaign Type"] || r.campaign_type || "Sales"),
    amount: parseFloat(r["Amount Spent"] || r.amount_spent || r.amount || 0) || 0,
    currency: "INR",
    notes: String(r["Notes"] || r.notes || ""),
    row_number: r._rowNumber || idx + 2,
  }));

  const otherExpenses: OtherExpenseItem[] = (json.otherExpenses || []).map((r: any, idx: number) => ({
    id: String(r._rowNumber || idx + 2),
    date: normalizeDateToISO(r["Date"] || r.date) || "",
    category: String(r["Category"] || r.category || "Miscellaneous"),
    description: String(r["Description"] || r.description || ""),
    amount: parseFloat(r["Amount"] || r.amount || 0) || 0,
    notes: String(r["Notes"] || r.notes || ""),
    row_number: r._rowNumber || idx + 2,
  }));

  const products: ProductItem[] = (json.products || []).map((r: any, idx: number) => ({
    id: String(r._rowNumber || idx + 2),
    name: String(r["Product Name"] || r.name || ""),
    category: String(r["Category"] || r.category || "Digital Notes"),
    selling_price: parseFloat(r["Selling Price"] || r.selling_price || 0) || 0,
    product_cost: parseFloat(r["Product Cost"] || r.product_cost || 0) || 0,
    row_number: r._rowNumber || idx + 2,
  }));

  return {
    revenues: revenues.filter((r) => r.date >= MIN_DATA_DATE),
    facebookAds: facebookAds.filter((a) => a.date >= MIN_DATA_DATE),
    otherExpenses: otherExpenses.filter((e) => e.date >= MIN_DATA_DATE),
    products,
  };
}

// -------------------------------------------------------------
// CRUD WRITE OPERATIONS (TARGETING GOOGLE SHEETS)
// -------------------------------------------------------------
export async function sendAppsScriptAction(action: string, sheet: string, payload: any): Promise<any> {
  const config = getSheetConfig();
  if (!config.webhookUrl || !config.webhookUrl.startsWith("http")) {
    return { success: false, localOnly: true, message: "Apps Script webhook not configured" };
  }

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sheet, ...payload }),
      redirect: "follow",
    });
    return await res.json();
  } catch (err: any) {
    console.error("Apps Script request failed:", err.message);
    return { success: false, error: err.message };
  }
}

export interface WriteResult<T> {
  item: T;
  sheetSynced: boolean;
  message?: string;
}

// 1. Facebook Ads CRUD
export async function createAdExpense(data: Partial<AdExpenseItem>): Promise<WriteResult<AdExpenseItem>> {
  const db = await fetchLiveSheetData();
  const newId = `AD-${Date.now()}`;
  const item: AdExpenseItem = {
    id: newId,
    date: data.date || new Date().toISOString().split("T")[0],
    campaign_name: data.campaign_name || "New Campaign",
    product_name: data.product_name || "",
    campaign_type: data.campaign_type || "Sales",
    amount: data.amount || 0,
    currency: "INR",
    notes: data.notes || "",
    row_number: db.facebookAds.length + 2,
  };

  db.facebookAds.unshift(item);
  saveLocalCache(db);

  // Send to Google Sheet
  const res = await sendAppsScriptAction("create", "Facebook Ads", { data: item });
  if (res?.success) {
    if (res.rowNumber) item.row_number = res.rowNumber;
    saveLocalCache(db);
    return { item, sheetSynced: true };
  }

  return {
    item,
    sheetSynced: false,
    message: res?.message || res?.error || "Google Apps Script Web App URL not configured",
  };
}

export async function updateAdExpense(id: string, updates: Partial<AdExpenseItem>): Promise<AdExpenseItem | null> {
  const db = await fetchLiveSheetData();
  const index = db.facebookAds.findIndex((a) => a.id === id || String(a.row_number) === id);
  if (index === -1) return null;

  const current = db.facebookAds[index];
  const updated = { ...current, ...updates };
  db.facebookAds[index] = updated;
  saveLocalCache(db);

  await sendAppsScriptAction("update", "Facebook Ads", {
    id,
    rowNumber: current.row_number,
    data: updated,
  });

  return updated;
}

export async function deleteAdExpense(id: string): Promise<boolean> {
  const db = await fetchLiveSheetData();
  const index = db.facebookAds.findIndex((a) => a.id === id || String(a.row_number) === id);
  if (index === -1) return false;

  const removed = db.facebookAds.splice(index, 1)[0];
  saveLocalCache(db);

  await sendAppsScriptAction("delete", "Facebook Ads", {
    id,
    rowNumber: removed.row_number,
  });

  return true;
}

export async function transferAdExpenseAmount({
  sourceId,
  transferAmount,
  targetDate,
  targetCampaign,
  targetProduct,
  notes,
}: {
  sourceId: string;
  transferAmount: number;
  targetDate: string;
  targetCampaign?: string;
  targetProduct?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  sourceExpense?: AdExpenseItem;
  targetExpense?: AdExpenseItem;
  error?: string;
}> {
  const db = await fetchLiveSheetData();
  const sourceIndex = db.facebookAds.findIndex(
    (a) => a.id === sourceId || String(a.row_number) === sourceId
  );
  if (sourceIndex === -1) {
    return { success: false, error: "Source ad expense record not found" };
  }

  const source = db.facebookAds[sourceIndex];
  if (transferAmount <= 0) {
    return { success: false, error: "Transfer amount must be greater than 0" };
  }
  if (transferAmount >= source.amount) {
    return {
      success: false,
      error: `Transfer amount (₹${transferAmount}) must be less than current total (₹${source.amount}). To move entire expense, please edit its date instead.`,
    };
  }

  const remainingAmount = Math.round((source.amount - transferAmount) * 100) / 100;

  // 1. Update source expense with minus remaining amount
  const updatedSource = await updateAdExpense(source.id, {
    amount: remainingAmount,
    notes: source.notes
      ? `${source.notes} (₹${transferAmount} transferred to ${targetDate})`
      : `₹${transferAmount} transferred to ${targetDate}`,
  });

  // 2. Create new target expense on target date
  const createResult = await createAdExpense({
    date: targetDate,
    campaign_name: targetCampaign || source.campaign_name,
    product_name: targetProduct !== undefined ? targetProduct : source.product_name,
    campaign_type: source.campaign_type || "Sales",
    amount: transferAmount,
    currency: "INR",
    notes: notes || `Transferred from ${source.date} (original ₹${source.amount})`,
  });

  return {
    success: true,
    sourceExpense: updatedSource || undefined,
    targetExpense: createResult.item,
  };
}

// 2. Other Expenses CRUD
export async function createOtherExpense(data: Partial<OtherExpenseItem>): Promise<WriteResult<OtherExpenseItem>> {
  const db = await fetchLiveSheetData();
  const newId = `EXP-${Date.now()}`;
  const item: OtherExpenseItem = {
    id: newId,
    date: data.date || new Date().toISOString().split("T")[0],
    category: data.category || "Miscellaneous",
    description: data.description || "",
    amount: data.amount || 0,
    notes: data.notes || "",
    row_number: db.otherExpenses.length + 2,
  };

  db.otherExpenses.unshift(item);
  saveLocalCache(db);

  const res = await sendAppsScriptAction("create", "Other Expenses", { data: item });
  if (res?.success) {
    if (res.rowNumber) item.row_number = res.rowNumber;
    saveLocalCache(db);
    return { item, sheetSynced: true };
  }

  return {
    item,
    sheetSynced: false,
    message: res?.message || res?.error || "Google Apps Script Web App URL not configured",
  };
}

export async function updateOtherExpense(id: string, updates: Partial<OtherExpenseItem>): Promise<OtherExpenseItem | null> {
  const db = await fetchLiveSheetData();
  const index = db.otherExpenses.findIndex((e) => e.id === id || String(e.row_number) === id);
  if (index === -1) return null;

  const current = db.otherExpenses[index];
  const updated = { ...current, ...updates };
  db.otherExpenses[index] = updated;
  saveLocalCache(db);

  await sendAppsScriptAction("update", "Other Expenses", {
    id,
    rowNumber: current.row_number,
    data: updated,
  });

  return updated;
}

export async function deleteOtherExpense(id: string): Promise<boolean> {
  const db = await fetchLiveSheetData();
  const index = db.otherExpenses.findIndex((e) => e.id === id || String(e.row_number) === id);
  if (index === -1) return false;

  const removed = db.otherExpenses.splice(index, 1)[0];
  saveLocalCache(db);

  await sendAppsScriptAction("delete", "Other Expenses", {
    id,
    rowNumber: removed.row_number,
  });

  return true;
}

// 3. Products CRUD
export async function createProduct(data: Partial<ProductItem>): Promise<WriteResult<ProductItem>> {
  const db = await fetchLiveSheetData();
  const newId = `PROD-${Date.now()}`;
  const item: ProductItem = {
    id: newId,
    name: data.name || "New Product",
    category: data.category || "Digital Notes",
    selling_price: data.selling_price || 0,
    product_cost: data.product_cost || 0,
    row_number: db.products.length + 2,
  };

  db.products.push(item);
  saveLocalCache(db);

  const res = await sendAppsScriptAction("create", "Products", { data: item });
  if (res?.success) {
    if (res.rowNumber) item.row_number = res.rowNumber;
    saveLocalCache(db);
    return { item, sheetSynced: true };
  }

  return {
    item,
    sheetSynced: false,
    message: res?.message || res?.error || "Google Apps Script Web App URL not configured",
  };
}

export async function updateProduct(id: string, updates: Partial<ProductItem>): Promise<ProductItem | null> {
  const db = await fetchLiveSheetData();
  const index = db.products.findIndex((p) => p.id === id || p.name === id || String(p.row_number) === id);
  if (index === -1) return null;

  const current = db.products[index];
  const updated = { ...current, ...updates };
  db.products[index] = updated;
  saveLocalCache(db);

  await sendAppsScriptAction("update", "Products", {
    id,
    rowNumber: current.row_number,
    data: updated,
  });

  return updated;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const db = await fetchLiveSheetData();
  const index = db.products.findIndex((p) => p.id === id || p.name === id || String(p.row_number) === id);
  if (index === -1) return false;

  const removed = db.products.splice(index, 1)[0];
  saveLocalCache(db);

  await sendAppsScriptAction("delete", "Products", {
    id,
    rowNumber: removed.row_number,
  });

  return true;
}

// 4. Revenues CRUD
export async function createRevenue(data: Partial<RevenueItem>): Promise<WriteResult<RevenueItem>> {
  const db = await fetchLiveSheetData();
  const newId = data.payment_id || `PAY-${Date.now()}`;
  const item: RevenueItem = {
    id: newId,
    date: data.date || new Date().toISOString().split("T")[0],
    payment_id: newId,
    product_name: data.product_name || "Digital Product",
    amount: data.amount || 0,
    net_amount: data.net_amount || data.amount || 0,
    product_cost: data.product_cost || 0,
    customer_email: data.customer_email || "",
    status: data.status || "Received",
    row_number: db.revenues.length + 2,
  };

  db.revenues.unshift(item);
  saveLocalCache(db);

  const res = await sendAppsScriptAction("create", "Revenues", { data: item });
  if (res?.success) {
    if (res.rowNumber) item.row_number = res.rowNumber;
    saveLocalCache(db);
    return { item, sheetSynced: true };
  }

  return {
    item,
    sheetSynced: false,
    message: res?.message || res?.error || "Google Apps Script Web App URL not configured",
  };
}

export async function deleteRevenue(id: string): Promise<boolean> {
  const db = await fetchLiveSheetData();
  const index = db.revenues.findIndex((r) => r.id === id || r.payment_id === id || String(r.row_number) === id);
  if (index === -1) return false;

  const removed = db.revenues.splice(index, 1)[0];
  saveLocalCache(db);

  await sendAppsScriptAction("delete", "Revenues", {
    id,
    rowNumber: removed.row_number,
  });

  return true;
}

// 5. Bulk Push into Google Sheet (1-Click populate)
export async function pushBatchToSheet(sheetName: string, rows: any[]): Promise<any> {
  return await sendAppsScriptAction("bulk_insert", sheetName, { rows });
}
