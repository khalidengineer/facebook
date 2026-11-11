import Papa from "papaparse";
import { getDb } from "./db";
import { normalizeDateToISO } from "./date-utils";

export const DEFAULT_SHEET_ID = "1LfzTmzaUpybViSZ2g-lKgr7v4NbMoNogIOz_IYtReVA";
export const DEFAULT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/edit?usp=sharing`;

let lastAutoSyncTimestamp = 0;
const AUTO_SYNC_INTERVAL_MS = 15_000; // 15 seconds cache

export function extractSheetId(input: string): string {
  if (!input) return DEFAULT_SHEET_ID;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return input.trim();
}

export function getSheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`;
}

export async function fetchSheetCSV(sheetId: string, tabName: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}&t=${Date.now()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Antigravity/1.0",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tab "${tabName}" from Google Sheet (HTTP ${response.status})`);
  }

  return await response.text();
}

export interface SheetSyncSummary {
  success: boolean;
  sheetId: string;
  sheetUrl: string;
  timestamp: string;
  tabs: {
    revenues: { rows: number; inserted: number; updated: number; skipped: number };
    facebookAds: { rows: number; imported: number; skipped: number };
    otherExpenses: { rows: number; imported: number; skipped: number };
    products: { rows: number; upserted: number };
  };
  errors: string[];
}

export async function syncFromGoogleSheet(customSheetId?: string): Promise<SheetSyncSummary> {
  const db = getDb();
  const settingSheetId = (db.prepare("SELECT value FROM app_settings WHERE key = 'google_sheet_id'").get() as { value?: string })?.value;
  const sheetId = customSheetId || settingSheetId || DEFAULT_SHEET_ID;
  const sheetUrl = getSheetUrl(sheetId);
  const now = new Date().toISOString();

  const summary: SheetSyncSummary = {
    success: true,
    sheetId,
    sheetUrl,
    timestamp: now,
    tabs: {
      revenues: { rows: 0, inserted: 0, updated: 0, skipped: 0 },
      facebookAds: { rows: 0, imported: 0, skipped: 0 },
      otherExpenses: { rows: 0, imported: 0, skipped: 0 },
      products: { rows: 0, upserted: 0 },
    },
    errors: [],
  };

  // 1. Sync Products Tab
  try {
    const productsCsv = await fetchSheetCSV(sheetId, "Products");
    const parsed = Papa.parse<Record<string, string>>(productsCsv, { header: true, skipEmptyLines: "greedy" });
    const rows = parsed.data;
    summary.tabs.products.rows = rows.length;

    const upsertProductStmt = db.prepare(`
      INSERT INTO products (name, category, selling_price, product_cost, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        category = excluded.category,
        selling_price = excluded.selling_price,
        product_cost = excluded.product_cost,
        updated_at = excluded.updated_at
    `);

    for (const r of rows) {
      const name = (r["Product Name"] || r["Product Title"] || r["name"] || "").trim();
      if (!name) continue;
      const category = (r["Category"] || r["category"] || "Digital Notes").trim();
      const sellingPrice = parseFloat(r["Selling Price"] || r["price"] || "0") || 0;
      const productCost = parseFloat(r["Product Cost"] || r["cost"] || "0") || 0;

      upsertProductStmt.run(name, category, sellingPrice, productCost, now, now);
      summary.tabs.products.upserted++;
    }
  } catch (err: any) {
    summary.errors.push(`Products tab: ${err.message}`);
  }

  // 2. Sync Revenues Tab (Strict Google Sheet Mirror)
  try {
    const revenuesCsv = await fetchSheetCSV(sheetId, "Revenues");
    const parsed = Papa.parse<Record<string, string>>(revenuesCsv, { header: true, skipEmptyLines: "greedy" });
    const rows = parsed.data;
    summary.tabs.revenues.rows = rows.length;

    const sheetPaymentIds = new Set<string>();

    const upsertProductStmt = db.prepare(`
      INSERT INTO products (name, category, selling_price, product_cost, created_at, updated_at)
      VALUES (?, 'Digital Notes', ?, 0, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        selling_price = excluded.selling_price,
        updated_at = excluded.updated_at
    `);

    const selectProductStmt = db.prepare("SELECT id, product_cost FROM products WHERE name = ? COLLATE NOCASE");

    const upsertRevenueStmt = db.prepare(`
      INSERT INTO revenues (
        date, product_id, product_name, campaign_name, order_count,
        amount, net_amount, product_cost, refund_amount, deduction_amount,
        payment_id, customer_email, customer_phone, source, status, raw_data, notes,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, NULL, 1,
        ?, ?, ?, 0, ?,
        ?, ?, NULL, 'google_sheet', ?, ?, 'Synced from Google Sheet',
        ?, ?
      )
      ON CONFLICT(payment_id) DO UPDATE SET
        date = excluded.date,
        product_id = excluded.product_id,
        product_name = excluded.product_name,
        amount = excluded.amount,
        net_amount = excluded.net_amount,
        product_cost = excluded.product_cost,
        deduction_amount = excluded.deduction_amount,
        customer_email = excluded.customer_email,
        status = excluded.status,
        raw_data = excluded.raw_data,
        updated_at = excluded.updated_at
    `);

    const existingPaymentIds = new Set<string>();
    const paymentRows = db.prepare("SELECT payment_id FROM revenues WHERE payment_id IS NOT NULL").all() as { payment_id: string }[];
    for (const p of paymentRows) {
      if (p.payment_id) existingPaymentIds.add(p.payment_id);
    }

    for (const r of rows) {
      const paymentId = (r["Payment ID"] || r["payment_id"] || r["PaymentId"] || "").trim();
      const rawDate = r["Date"] || r["date"] || "";
      const isoDate = normalizeDateToISO(rawDate);
      const productTitle = (r["Product Title"] || r["Product Name"] || r["product"] || "Digital Product").trim();
      const status = (r["Status"] || r["status"] || "Received").trim();
      const paidByCustomer = parseFloat(r["Paid By Customer"] || r["amount"] || r["Amount"] || "0") || 0;
      const earnedAmount = parseFloat(r["Earned Amount"] || r["net_amount"] || "0") || 0;
      const email = (r["Customer Email"] || r["email"] || "").trim();

      const isReceived = !status || status.toLowerCase() === "received";

      if (!isoDate || paidByCustomer <= 0 || !isReceived) {
        summary.tabs.revenues.skipped++;
        continue;
      }

      if (paymentId) sheetPaymentIds.add(paymentId);

      // Upsert product dynamically from row
      if (productTitle && productTitle !== "--") {
        upsertProductStmt.run(productTitle, paidByCustomer, now, now);
      }
      const prodRecord = selectProductStmt.get(productTitle) as { id: number; product_cost: number } | undefined;
      const productId = prodRecord ? prodRecord.id : null;
      const baseProductCost = prodRecord ? prodRecord.product_cost : 0;

      const deductions = Math.max(0, Math.round((paidByCustomer - (earnedAmount || paidByCustomer)) * 100) / 100);
      const netEarned = earnedAmount > 0 ? earnedAmount : paidByCustomer - deductions;

      const isExisting = Boolean(paymentId && existingPaymentIds.has(paymentId));

      upsertRevenueStmt.run(
        isoDate,
        productId,
        productTitle,
        paidByCustomer,
        netEarned,
        baseProductCost,
        deductions,
        paymentId || null,
        email || null,
        status,
        JSON.stringify(r),
        now,
        now
      );

      if (isExisting) {
        summary.tabs.revenues.updated++;
      } else {
        summary.tabs.revenues.inserted++;
        if (paymentId) existingPaymentIds.add(paymentId);
      }
    }

    // Mirroring: Only delete rows if Google Sheet actually provided valid rows
    if (sheetPaymentIds.size > 0) {
      const placeholders = Array.from(sheetPaymentIds).map(() => "?").join(",");
      db.prepare(`DELETE FROM revenues WHERE payment_id IS NOT NULL AND payment_id NOT IN (${placeholders})`).run(
        ...Array.from(sheetPaymentIds)
      );
    }
  } catch (err: any) {
    summary.errors.push(`Revenues tab: ${err.message}`);
  }

  // 3. Sync Facebook Ads Tab (Strict Google Sheet Mirror)
  try {
    const adsCsv = await fetchSheetCSV(sheetId, "Facebook Ads");
    const parsed = Papa.parse<Record<string, string>>(adsCsv, { header: true, skipEmptyLines: "greedy" });
    const rows = parsed.data;
    summary.tabs.facebookAds.rows = rows.length;

    if (rows.length > 0) {
      // Clear and re-populate strictly from Google Sheet!
      db.prepare("DELETE FROM ad_expenses").run();

      const selectProductStmt = db.prepare("SELECT id FROM products WHERE name = ? COLLATE NOCASE");
      const insertAdStmt = db.prepare(`
        INSERT INTO ad_expenses (date, campaign_name, product_id, product_name, campaign_type, amount, currency, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?)
      `);

      for (const r of rows) {
        const rawDate = r["Date"] || r["date"] || "";
        const isoDate = normalizeDateToISO(rawDate);
        const campaign = (r["Campaign Name"] || r["Campaign"] || r["campaign_name"] || "").trim();
        const product = (r["Product"] || r["Product Name"] || "").trim();
        const amount = parseFloat(r["Amount Spent"] || r["Amount"] || r["amount"] || "0") || 0;
        const campaignType = (r["Campaign Type"] || "Sales").trim();
        const notes = (r["Notes"] || r["notes"] || "").trim();

        if (!isoDate || !campaign || amount <= 0) {
          summary.tabs.facebookAds.skipped++;
          continue;
        }

        const prodRecord = product ? (selectProductStmt.get(product) as { id: number } | undefined) : undefined;
        const productId = prodRecord ? prodRecord.id : null;

        insertAdStmt.run(isoDate, campaign, productId, product || null, campaignType, amount, notes, now, now);
        summary.tabs.facebookAds.imported++;
      }
    }
  } catch (err: any) {
    summary.errors.push(`Facebook Ads tab: ${err.message}`);
  }

  // 4. Sync Other Expenses Tab (Strict Google Sheet Mirror)
  try {
    const expensesCsv = await fetchSheetCSV(sheetId, "Other Expenses");
    const parsed = Papa.parse<Record<string, string>>(expensesCsv, { header: true, skipEmptyLines: "greedy" });
    const rows = parsed.data;
    summary.tabs.otherExpenses.rows = rows.length;

    if (rows.length > 0) {
      // Clear and re-populate strictly from Google Sheet!
      db.prepare("DELETE FROM other_expenses").run();

      const insertExpenseStmt = db.prepare(`
        INSERT INTO other_expenses (date, category, description, amount, payment_method, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'UPI', ?, ?, ?)
      `);

      for (const r of rows) {
        const rawDate = r["Date"] || r["date"] || "";
        const isoDate = normalizeDateToISO(rawDate);
        const category = (r["Category"] || r["category"] || "Miscellaneous").trim();
        const description = (r["Description"] || r["description"] || "Expense").trim();
        const amount = parseFloat(r["Amount"] || r["amount"] || "0") || 0;
        const notes = (r["Notes"] || r["notes"] || "").trim();

        if (!isoDate || amount <= 0) {
          summary.tabs.otherExpenses.skipped++;
          continue;
        }

        insertExpenseStmt.run(isoDate, category, description, amount, notes, now, now);
        summary.tabs.otherExpenses.imported++;
      }
    }
  } catch (err: any) {
    summary.errors.push(`Other Expenses tab: ${err.message}`);
  }

  // Save settings in database
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES ('google_sheet_id', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(sheetId);

  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES ('google_sheet_url', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(sheetUrl);

  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES ('last_sheet_sync', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(now);

  return summary;
}

export async function ensureSheetSynced(): Promise<void> {
  const now = Date.now();
  if (now - lastAutoSyncTimestamp < AUTO_SYNC_INTERVAL_MS) {
    return;
  }
  lastAutoSyncTimestamp = now;
  try {
    await syncFromGoogleSheet();
  } catch (err: any) {
    console.warn("Auto-sync from Google Sheet check:", err.message);
  }
}

export function generateGoogleAppsScriptCode(sheetUrl: string): string {
  return `/**
 * Google Apps Script for 2-Way Sync with Facebook Ads Management App
 * Instructions:
 * 1. In Google Sheet, go to Extensions > Apps Script
 * 2. Delete any code and paste this entire code
 * 3. Click "Deploy" > "New deployment"
 * 4. Select type "Web app"
 * 5. Set "Execute as": "Me"
 * 6. Set "Who has access": "Anyone"
 * 7. Click Deploy, copy the Web App URL, and paste it into the App's Google Sheet Settings!
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action || 'add_ad_expense';

    if (action === 'add_ad_expense') {
      var sheet = ss.getSheetByName('Facebook Ads') || ss.insertSheet('Facebook Ads');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Date', 'Campaign Name', 'Product', 'Amount Spent', 'Campaign Type', 'Notes']);
      }
      sheet.appendRow([
        data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        data.campaign_name || '',
        data.product || '',
        data.amount_spent || data.amount || 0,
        data.campaign_type || 'Sales',
        data.notes || ''
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Ad expense added' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'add_other_expense') {
      var sheet = ss.getSheetByName('Other Expenses') || ss.insertSheet('Other Expenses');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Date', 'Category', 'Description', 'Amount', 'Notes']);
      }
      sheet.appendRow([
        data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        data.category || 'Miscellaneous',
        data.description || '',
        data.amount || 0,
        data.notes || ''
      ]);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Expense added' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: 'Google Apps Script Web App is active and ready!'
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
}
