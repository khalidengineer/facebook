import Papa from "papaparse";
import { normalizeDateToISO } from "./date-utils";
import {
  fetchLiveSheetData,
  pushBatchToSheet,
  sendAppsScriptAction,
  RevenueItem,
  ProductItem,
} from "./sheet-db";

export interface CSVPreviewResult {
  detectedType: "cosmofeed" | "facebook_ads" | "generic_revenue" | "generic_expense" | "unknown";
  totalRows: number;
  newRows: number;
  matchedRows: number;
  invalidRows: number;
  totalGrossAmount: number;
  totalNetAmount: number;
  dateRange: { start: string | null; end: string | null };
  detectedProducts: Array<{ name: string; price: number }>;
  headers: string[];
  previewRows: Array<{
    date: string | null;
    productName: string;
    amount: number;
    netAmount: number;
    paymentId: string;
    customerEmail?: string;
    customerPhone?: string;
    status: string;
    action: "insert" | "update" | "skip";
    reason?: string;
  }>;
}

export async function analyzeAndPreviewCSV(csvContent: string): Promise<CSVPreviewResult> {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const headers = (parsed.meta.fields || []).map((h) => h.trim());
  const rows = parsed.data as Record<string, string>[];

  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const isCosmofeed =
    lowerHeaders.some((h) => h.includes("payment id")) &&
    lowerHeaders.some((h) => h.includes("paid by customer") || h.includes("product title"));

  const detectedType = isCosmofeed ? "cosmofeed" : "generic_revenue";

  const db = await fetchLiveSheetData();
  const existingPaymentIds = new Set<string>();
  db.revenues.forEach((r) => {
    if (r.payment_id) existingPaymentIds.add(r.payment_id);
  });

  const detectedProductsMap = new Map<string, number>();
  const previewRows: CSVPreviewResult["previewRows"] = [];
  const validDates: string[] = [];

  let totalGrossAmount = 0;
  let totalNetAmount = 0;
  let newRows = 0;
  let matchedRows = 0;
  let invalidRows = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const paymentId = (row["Payment ID"] || "").trim();
    const rawDate = row["Date"] || "";
    const isoDate = normalizeDateToISO(rawDate);
    const productTitle = (row["Product Title"] || "Digital Product").trim();
    const status = (row["Status"] || "").trim();
    const paidByCustomer = parseFloat(row["Paid By Customer"] || "0") || 0;
    const earnedAmount = parseFloat(row["Earned Amount"] || "0") || 0;
    const email = (row["Customer Email"] || row["Email"] || "").trim();
    const phone = (row["Customer Phone"] || row["Phone"] || row["Phone number"] || "").trim();

    if (productTitle && productTitle !== "--") {
      if (!detectedProductsMap.has(productTitle) || paidByCustomer > (detectedProductsMap.get(productTitle) || 0)) {
        detectedProductsMap.set(productTitle, paidByCustomer);
      }
    }

    const isReceived = status.toLowerCase() === "received";
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
    } else if (existsInDb) {
      action = "update";
      reason = isReceived
        ? "Matches existing Payment ID (Will Replace/Update in Sheet)"
        : `Matches existing (${status || "Cancelled"})`;
      matchedRows++;
      if (isReceived) {
        totalGrossAmount += paidByCustomer;
        totalNetAmount += earnedAmount || paidByCustomer;
      }
      validDates.push(isoDate);
    } else {
      action = "insert";
      reason = isReceived
        ? "New transaction (Will Add to Sheet)"
        : `New Order (${status || "Cancelled by customer"})`;
      newRows++;
      if (isReceived) {
        totalGrossAmount += paidByCustomer;
        totalNetAmount += earnedAmount || paidByCustomer;
      }
      validDates.push(isoDate);
    }

    previewRows.push({
      date: isoDate,
      productName: productTitle,
      amount: paidByCustomer,
      netAmount: isReceived ? (earnedAmount || paidByCustomer) : 0,
      paymentId: paymentId || `ROW-${idx + 1}`,
      customerEmail: email,
      customerPhone: phone,
      status: status || "Received",
      action,
      reason,
    });
  }

  validDates.sort();
  const dateRange = {
    start: validDates.length > 0 ? validDates[0] : null,
    end: validDates.length > 0 ? validDates[validDates.length - 1] : null,
  };

  const detectedProducts = Array.from(detectedProductsMap.entries()).map(([name, price]) => ({
    name,
    price,
  }));

  return {
    detectedType,
    totalRows: rows.length,
    newRows,
    matchedRows,
    invalidRows,
    totalGrossAmount: Math.round(totalGrossAmount * 100) / 100,
    totalNetAmount: Math.round(totalNetAmount * 100) / 100,
    dateRange,
    detectedProducts,
    headers,
    previewRows: previewRows.slice(0, 75),
  };
}

export interface ImportOptions {
  filename: string;
  skipDuplicates?: boolean;
  onlyReceived?: boolean;
}

export async function executeCosmofeedImport(csvContent: string, options: ImportOptions) {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
  });
  const rows = parsed.data as Record<string, string>[];
  const db = await fetchLiveSheetData();

  const existingPaymentMap = new Map<string, RevenueItem>();
  db.revenues.forEach((r) => {
    if (r.payment_id) existingPaymentMap.set(r.payment_id, r);
  });

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let totalGross = 0;
  let totalNet = 0;

  const newRowsToPush: RevenueItem[] = [];
  const existingRowsToUpdate: RevenueItem[] = [];

  for (const row of rows) {
    const paymentId = (row["Payment ID"] || "").trim();
    const rawDate = row["Date"] || "";
    const isoDate = normalizeDateToISO(rawDate);
    const productTitle = (row["Product Title"] || "Notes").trim();
    const status = (row["Status"] || "").trim();
    const paidByCustomer = parseFloat(row["Paid By Customer"] || "0") || 0;
    const earnedAmount = parseFloat(row["Earned Amount"] || "0") || 0;
    const email = (row["Customer Email"] || row["Email"] || "").trim();

    const isReceived = status.toLowerCase() === "received";

    if (!isoDate || paidByCustomer <= 0) {
      skippedCount++;
      continue;
    }

    if (options.onlyReceived === true && !isReceived) {
      skippedCount++;
      continue;
    }

    const finalStatus = status || "Received";
    const netEarned = isReceived ? (earnedAmount > 0 ? earnedAmount : paidByCustomer) : 0;
    const existingRecord = paymentId ? existingPaymentMap.get(paymentId) : undefined;

    const item: RevenueItem = {
      id: paymentId || `PAY-${Date.now()}`,
      date: isoDate,
      payment_id: paymentId || `PAY-${Date.now()}`,
      product_name: productTitle,
      amount: paidByCustomer,
      net_amount: netEarned,
      product_cost: 0,
      customer_email: email,
      status: finalStatus,
      row_number: existingRecord?.row_number,
    };

    if (existingRecord) {
      // Replace / Update existing record in memory
      const idx = db.revenues.findIndex((r) => r.payment_id === paymentId);
      if (idx !== -1) {
        db.revenues[idx] = { ...existingRecord, ...item };
      }
      updatedCount++;
      if (existingRecord.row_number) {
        existingRowsToUpdate.push(item);
      }
    } else {
      // Add new record
      db.revenues.unshift(item);
      insertedCount++;
      if (paymentId) existingPaymentMap.set(paymentId, item);
      newRowsToPush.push(item);
    }

    totalGross += paidByCustomer;
    totalNet += netEarned;
  }

  // 1. Push NEW rows to Google Sheet via Webhook
  let sheetPushed = false;
  if (newRowsToPush.length > 0) {
    try {
      const res = await pushBatchToSheet("Revenues", newRowsToPush);
      if (res?.success) sheetPushed = true;
    } catch (e) {
      console.warn("Google Sheet bulk push error:", e);
    }
  }

  // 2. Update existing rows in Google Sheet in place
  for (const updatedItem of existingRowsToUpdate) {
    sendAppsScriptAction("update", "Revenues", {
      id: updatedItem.payment_id,
      rowNumber: updatedItem.row_number,
      data: updatedItem,
    }).catch(() => {});
  }

  // 3. Automatically extract and push new products to Products tab in Google Sheet
  const productPriceMap = new Map<string, number>();
  for (const row of rows) {
    const title = (row["Product Title"] || "").trim();
    const paid = parseFloat(row["Paid By Customer"] || "0") || 0;
    if (title && title !== "--" && paid > 0) {
      if (!productPriceMap.has(title) || paid > (productPriceMap.get(title) || 0)) {
        productPriceMap.set(title, paid);
      }
    }
  }

  const existingProductNames = new Set(db.products.map((p) => p.name.trim().toLowerCase()));
  const newProductsToPush: ProductItem[] = [];

  for (const [name, price] of productPriceMap.entries()) {
    if (!existingProductNames.has(name.toLowerCase())) {
      const prodItem: ProductItem = {
        id: `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name,
        category: "Digital Notes",
        selling_price: price,
        product_cost: 0,
        row_number: db.products.length + newProductsToPush.length + 2,
      };
      db.products.push(prodItem);
      newProductsToPush.push(prodItem);
      existingProductNames.add(name.toLowerCase());
    }
  }

  if (newProductsToPush.length > 0) {
    await pushBatchToSheet("Products", newProductsToPush).catch((e) =>
      console.warn("Google Sheet products push error:", e)
    );
  }

  return {
    success: true,
    totalRows: rows.length,
    insertedCount,
    updatedCount,
    skippedCount,
    totalGross: Math.round(totalGross * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
    detectedProductsCount: productPriceMap.size,
    newProductsCreated: newProductsToPush.length,
    sheetPushed,
  };
}
