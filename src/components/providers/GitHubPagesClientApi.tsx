"use client";

import { useEffect } from "react";
import Papa from "papaparse";
import { normalizeDateToISO } from "@/lib/date-utils";

const DEFAULT_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbx8v0N44nQSkFK4LyOOnyqeedUMw86R92l_bb59IcVXaIFHKe0ybm4ShHValK0O32lq/exec";
const DEFAULT_SHEET_ID = "1LfzTmzaUpybViSZ2g-lKgr7v4NbMoNogIOz_IYtReVA";
const DEFAULT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/edit?usp=sharing`;
const MIN_DATA_DATE = "2026-11-10";

let sheetCache: {
  revenues: any[];
  facebookAds: any[];
  otherExpenses: any[];
  products: any[];
  lastFetchedAt: number;
} | null = null;

function parseAppsScriptData(json: any) {
  const revenues = (json.revenues || [])
    .map((r: any, idx: number) => {
      const grossAmt = parseFloat(r["Paid By Customer"] || r.amount || 0) || 0;
      const rawNet = parseFloat(r["Earned Amount"] || r.net_amount || 0);
      const statusStr = String(r["Status"] || r.status || "Received");
      const isCancelled = statusStr.toLowerCase().includes("cancelled");
      const netAmt = isCancelled ? 0 : !isNaN(rawNet) && rawNet > 0 ? rawNet : grossAmt;
      const rawDate = r["Date"] || r.date || "";
      const cleanDate = typeof rawDate === "string" ? rawDate.split("T")[0] : "";
      return {
        id: String(r["Payment ID"] || r.payment_id || `REV-${idx + 1}`),
        date: cleanDate,
        payment_id: String(r["Payment ID"] || r.payment_id || ""),
        product_name: String(r["Product Title"] || r.product_title || r.product_name || ""),
        amount: grossAmt,
        net_amount: netAmt,
        product_cost: parseFloat(r["Product Cost"] || r.product_cost || 0) || 0,
        customer_email: String(r["Customer Email"] || r.customer_email || ""),
        status: statusStr,
      };
    })
    .filter((r: any) => r.date >= MIN_DATA_DATE);

  const facebookAds = (json.facebookAds || [])
    .map((a: any, idx: number) => {
      const rawDate = a["Date"] || a.date || "";
      const cleanDate = typeof rawDate === "string" ? rawDate.split("T")[0] : "";
      return {
        id: String(a.id || `AD-${idx + 1}`),
        date: cleanDate,
        campaign_name: String(a["Campaign Name"] || a.campaign_name || ""),
        product_name: String(a["Product"] || a.product || a.product_name || ""),
        campaign_type: String(a["Campaign Type"] || a.campaign_type || "Sales"),
        amount: parseFloat(a["Amount Spent"] || a.amount_spent || a.amount || 0) || 0,
        currency: "INR",
        notes: String(a["Notes"] || a.notes || ""),
      };
    })
    .filter((a: any) => a.date >= MIN_DATA_DATE);

  const otherExpenses = (json.otherExpenses || [])
    .map((e: any, idx: number) => {
      const rawDate = e["Date"] || e.date || "";
      const cleanDate = typeof rawDate === "string" ? rawDate.split("T")[0] : "";
      return {
        id: String(e.id || `EXP-${idx + 1}`),
        date: cleanDate,
        category: String(e["Category"] || e.category || "General"),
        description: String(e["Description"] || e.description || ""),
        amount: parseFloat(e["Amount"] || e.amount || 0) || 0,
        notes: String(e["Notes"] || e.notes || ""),
      };
    })
    .filter((e: any) => e.date >= MIN_DATA_DATE);

  const products = (json.products || []).map((p: any, idx: number) => ({
    id: String(p.id || `PROD-${idx + 1}`),
    name: String(p["Product Name"] || p.name || ""),
    category: String(p["Category"] || p.category || "Digital Product"),
    selling_price: parseFloat(p["Selling Price"] || p.selling_price || 0) || 0,
    product_cost: parseFloat(p["Product Cost"] || p.product_cost || 0) || 0,
  }));

  return { revenues, facebookAds, otherExpenses, products };
}

async function getLiveSheetData(webhookUrl: string, force = false) {
  const now = Date.now();
  if (!force && sheetCache && now - sheetCache.lastFetchedAt < 15_000) {
    return sheetCache;
  }

  try {
    const url = `${webhookUrl || DEFAULT_WEBHOOK}?action=read_all`;
    const res = await fetch(url, { redirect: "follow" });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        const parsed = parseAppsScriptData(json);
        const localAds = (JSON.parse(localStorage.getItem("gh_local_ads") || "[]")).filter(
          (a: any) => a.date >= MIN_DATA_DATE
        );
        const localExpenses = (JSON.parse(localStorage.getItem("gh_local_expenses") || "[]")).filter(
          (e: any) => e.date >= MIN_DATA_DATE
        );
        const localRevs = (JSON.parse(localStorage.getItem("gh_local_revs") || "[]")).filter(
          (r: any) => r.date >= MIN_DATA_DATE
        );

        sheetCache = {
          revenues: [...parsed.revenues, ...localRevs],
          facebookAds: [...parsed.facebookAds, ...localAds],
          otherExpenses: [...parsed.otherExpenses, ...localExpenses],
          products: parsed.products,
          lastFetchedAt: now,
        };
        return sheetCache;
      }
    }
  } catch (e) {
    console.warn("Client live sheet fetch error:", e);
  }

  return (
    sheetCache || {
      revenues: [],
      facebookAds: [],
      otherExpenses: [],
      products: [],
      lastFetchedAt: 0,
    }
  );
}

function computeDashboard(db: any, startDate = MIN_DATA_DATE, endDate = "2099-12-31") {
  const effectiveStart = !startDate || startDate < MIN_DATA_DATE ? MIN_DATA_DATE : startDate;
  const effectiveEnd = !endDate ? "2099-12-31" : endDate;

  // 1. Facebook Ads
  const filteredAds = (db.facebookAds || []).filter(
    (a: any) => a.date >= effectiveStart && a.date <= effectiveEnd
  );
  const totalAdSpend = filteredAds.reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
  const uniqueDays = new Set(filteredAds.map((a: any) => a.date)).size || 1;

  // 2. Revenues
  const allFilteredRevs = (db.revenues || []).filter(
    (r: any) => r.date >= effectiveStart && r.date <= effectiveEnd
  );
  const receivedRevs = allFilteredRevs.filter(
    (r: any) => !r.status || r.status.toLowerCase() === "received"
  );
  const cancelledRevs = allFilteredRevs.filter(
    (r: any) => r.status && r.status.toLowerCase().includes("cancelled")
  );

  const totalGrossRevenue = receivedRevs.reduce(
    (sum: number, r: any) => sum + (Number(r.amount) || 0),
    0
  );
  const totalNetRevenue = receivedRevs.reduce(
    (sum: number, r: any) => sum + (Number(r.net_amount) || Number(r.amount) || 0),
    0
  );
  const totalProductCost = receivedRevs.reduce(
    (sum: number, r: any) => sum + (Number(r.product_cost) || 0),
    0
  );
  const totalCancelledOrders = cancelledRevs.length;
  const totalCancelledAmount =
    Math.round(cancelledRevs.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) * 100) / 100;
  const totalReceivedOrders = receivedRevs.length;
  const totalOrders = receivedRevs.length;

  // 3. Other Expenses
  const filteredExpenses = (db.otherExpenses || []).filter(
    (e: any) => e.date >= effectiveStart && e.date <= effectiveEnd
  );
  const totalOtherExpenses = filteredExpenses.reduce(
    (sum: number, e: any) => sum + (Number(e.amount) || 0),
    0
  );

  const totalDeductions = Math.max(0, Math.round((totalGrossRevenue - totalNetRevenue) * 100) / 100);
  const totalRefunds = 0;
  const netProfit = Math.round(
    (totalNetRevenue - totalAdSpend - totalOtherExpenses - totalProductCost) * 100
  ) / 100;
  const roas = totalAdSpend > 0 ? Math.round((totalGrossRevenue / totalAdSpend) * 100) / 100 : 0;
  const avgDailyAdSpend = Math.round((totalAdSpend / uniqueDays) * 100) / 100;
  const costPerSale =
    totalReceivedOrders > 0 ? Math.round((totalAdSpend / totalReceivedOrders) * 100) / 100 : 0;

  // 4. Daily rollup for charts
  const dailyMap = new Map<string, { adSpend: number; revenue: number; netRevenue: number; profit: number }>();
  for (const a of filteredAds) {
    if (!a.date) continue;
    const cur = dailyMap.get(a.date) || { adSpend: 0, revenue: 0, netRevenue: 0, profit: 0 };
    cur.adSpend += Number(a.amount) || 0;
    cur.profit -= Number(a.amount) || 0;
    dailyMap.set(a.date, cur);
  }
  for (const r of receivedRevs) {
    if (!r.date) continue;
    const cur = dailyMap.get(r.date) || { adSpend: 0, revenue: 0, netRevenue: 0, profit: 0 };
    cur.revenue += Number(r.amount) || 0;
    cur.netRevenue += Number(r.net_amount) || Number(r.amount) || 0;
    cur.profit += (Number(r.net_amount) || Number(r.amount) || 0) - (Number(r.product_cost) || 0);
    dailyMap.set(r.date, cur);
  }

  const dailySpendAndRevenue = Array.from(dailyMap.entries())
    .map(([date, val]) => ({
      date,
      adSpend: Math.round(val.adSpend * 100) / 100,
      revenue: Math.round(val.revenue * 100) / 100,
      netRevenue: Math.round(val.netRevenue * 100) / 100,
      profit: Math.round(val.profit * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 5. Monthly comparison
  const monthlyMap = new Map<string, { adSpend: number; revenue: number; profit: number }>();
  for (const d of dailySpendAndRevenue) {
    const month = d.date.substring(0, 7);
    const curr = monthlyMap.get(month) || { adSpend: 0, revenue: 0, profit: 0 };
    curr.adSpend += d.adSpend;
    curr.revenue += d.revenue;
    curr.profit += d.profit;
    monthlyMap.set(month, curr);
  }
  const monthlyComparison = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      adSpend: Math.round(data.adSpend),
      revenue: Math.round(data.revenue),
      profit: Math.round(data.profit),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 6. Product Revenue Breakdown for chart
  const productRevenue = (db.products || [])
    .map((p: any) => {
      const prodRevs = receivedRevs.filter(
        (r: any) => r.product_name && r.product_name.toLowerCase() === p.name.toLowerCase()
      );
      const prodAds = filteredAds.filter(
        (a: any) => a.product_name && a.product_name.toLowerCase() === p.name.toLowerCase()
      );
      const rev = prodRevs.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      const netRev = prodRevs.reduce(
        (sum: number, r: any) => sum + (Number(r.net_amount) || Number(r.amount) || 0),
        0
      );
      const ad = prodAds.reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
      return {
        name: p.name.length > 25 ? p.name.substring(0, 22) + "..." : p.name,
        fullName: p.name,
        revenue: Math.round(rev),
        adSpend: Math.round(ad),
        netProfit: Math.round(netRev - ad),
        roas: ad > 0 ? Math.round((rev / ad) * 100) / 100 : 0,
      };
    })
    .filter((p: any) => p.revenue > 0 || p.adSpend > 0);

  // 7. Orders for the customer sales ledger at the bottom
  const orders = allFilteredRevs
    .slice()
    .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

  // 8. Recent transactions
  const recentAds = (db.facebookAds || []).slice(0, 5).map((a: any) => ({
    type: "ad",
    id: a.id,
    date: a.date,
    title: a.campaign_name,
    product_name: a.product_name,
    amount: a.amount,
    notes: a.notes,
  }));
  const recentRevs = (db.revenues || []).slice(0, 8).map((r: any) => ({
    type: "revenue",
    id: r.id,
    date: r.date,
    title: r.product_name,
    product_name: r.product_name,
    amount: r.amount,
    status: r.status || "Received",
    notes: `Payment ID: ${r.payment_id}`,
  }));
  const recentTransactions = [...recentAds, ...recentRevs]
    .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 10);

  return {
    success: true,
    summary: {
      totalAdSpend,
      totalGrossRevenue,
      totalNetRevenue,
      totalOtherExpenses,
      totalProductCost,
      totalRefunds,
      totalDeductions,
      netProfit,
      totalProducts: (db.products || []).length,
      totalOrders,
      totalReceivedOrders,
      totalCancelledOrders,
      totalCancelledAmount,
      roas,
      avgDailyAdSpend,
      costPerSale,
      currencySymbol: "₹",
    },
    charts: {
      dailySpendAndRevenue,
      monthlyComparison,
      productRevenue,
    },
    orders,
    recentTransactions,
  };
}

export function GitHubPagesClientApi() {
  useEffect(() => {
    const isGitHubPages =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("github.io") || window.location.port === "5000");

    if (!isGitHubPages) return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (urlStr.includes("/api/")) {
        try {
          const method = (init?.method || "GET").toUpperCase();
          const cleanUrl = urlStr.replace(/^https?:\/\/[^\/]+/, "").replace(/^\/facebook/, "");
          const pathOnly = cleanUrl.split("?")[0];
          const searchParams = new URLSearchParams(cleanUrl.split("?")[1] || "");

          const storedConfig = JSON.parse(
            localStorage.getItem("gh_sheet_config") ||
              JSON.stringify({
                sheetId: DEFAULT_SHEET_ID,
                sheetUrl: DEFAULT_SHEET_URL,
                webhookUrl: DEFAULT_WEBHOOK,
                autoSync: true,
              })
          );

          // 1. Sheets Config
          if (pathOnly === "/api/sheets/config") {
            if (method === "POST" && init?.body) {
              const body = JSON.parse(init.body as string);
              const updated = { ...storedConfig, ...body };
              localStorage.setItem("gh_sheet_config", JSON.stringify(updated));
              return new Response(JSON.stringify({ success: true, config: updated }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ success: true, config: storedConfig }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 1b. Import API Preview
          if (pathOnly === "/api/import/preview" && method === "POST") {
            try {
              const body = init?.body ? JSON.parse(init.body as string) : {};
              let csvContent = body.csvContent || "";
              if (!csvContent && body.useSampleFile) {
                const isGh = typeof window !== "undefined" && window.location.pathname.startsWith("/facebook");
                const sampleRes = await originalFetch(isGh ? "/facebook/data.csv" : "/data.csv");
                if (sampleRes.ok) csvContent = await sampleRes.text();
              }
              const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: "greedy" });
              const rows = (parsed.data || []) as Record<string, string>[];
              const liveData = await getLiveSheetData(storedConfig.webhookUrl, true);
              const existingIds = new Set<string>();
              (liveData?.revenues || []).forEach((r: any) => {
                if (r.payment_id) existingIds.add(String(r.payment_id).trim());
              });

              const previewRows: any[] = [];
              const productMap = new Map<string, number>();
              const validDates: string[] = [];
              let totalGross = 0;
              let totalNet = 0;
              let newRows = 0;
              let matchedRows = 0;
              let invalidRows = 0;

              for (let idx = 0; idx < rows.length; idx++) {
                const row = rows[idx];
                const paymentId = (row["Payment ID"] || row["payment_id"] || row["ID"] || "").trim();
                const rawDate = row["Date"] || row["date"] || "";
                const isoDate = normalizeDateToISO(rawDate);
                const productTitle = (row["Product Title"] || row["Product Name"] || row["Product"] || "Digital Notes").trim();
                const status = (row["Status"] || row["status"] || "Received").trim();
                const paidByCustomer = parseFloat(row["Paid By Customer"] || row["Amount"] || row["amount"] || "0") || 0;
                const earnedAmount = parseFloat(row["Earned Amount"] || row["Net Amount"] || row["net_amount"] || "0") || 0;
                const email = (row["Customer Email"] || row["Email"] || "").trim();
                const isReceived = !status || status.toLowerCase() === "received";

                if (productTitle && productTitle !== "--") {
                  if (!productMap.has(productTitle) || paidByCustomer > (productMap.get(productTitle) || 0)) {
                    productMap.set(productTitle, paidByCustomer);
                  }
                }

                let action: "insert" | "update" | "skip" = "insert";
                let reason = "New transaction (Will Add to Sheet)";

                if (!isoDate || paidByCustomer <= 0) {
                  action = "skip";
                  reason = !isoDate ? "Invalid date" : "Amount is zero";
                  invalidRows++;
                } else if (!isReceived) {
                  action = "skip";
                  reason = `Status is ${status}`;
                  invalidRows++;
                } else if (paymentId && existingIds.has(paymentId)) {
                  action = "update";
                  reason = "Matches existing Payment ID";
                  matchedRows++;
                  totalGross += paidByCustomer;
                  totalNet += earnedAmount > 0 ? earnedAmount : paidByCustomer;
                  if (isoDate) validDates.push(isoDate);
                } else {
                  action = "insert";
                  newRows++;
                  totalGross += paidByCustomer;
                  totalNet += earnedAmount > 0 ? earnedAmount : paidByCustomer;
                  if (isoDate) validDates.push(isoDate);
                }

                previewRows.push({
                  date: isoDate,
                  productName: productTitle,
                  amount: paidByCustomer,
                  netAmount: earnedAmount > 0 ? earnedAmount : paidByCustomer,
                  paymentId: paymentId || `ROW-${idx + 1}`,
                  customerEmail: email,
                  status,
                  action,
                  reason,
                });
              }

              validDates.sort();
              return new Response(
                JSON.stringify({
                  success: true,
                  preview: {
                    detectedType: "cosmofeed",
                    totalRows: rows.length,
                    newRows,
                    matchedRows,
                    invalidRows,
                    totalGrossAmount: Math.round(totalGross * 100) / 100,
                    totalNetAmount: Math.round(totalNet * 100) / 100,
                    dateRange: { start: validDates[0] || null, end: validDates[validDates.length - 1] || null },
                    detectedProducts: Array.from(productMap.entries()).map(([name, price]) => ({ name, price })),
                    previewRows: previewRows.slice(0, 50),
                    allRows: previewRows,
                  },
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            } catch (err: any) {
              return new Response(JSON.stringify({ success: false, error: err.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          // 1c. Import API Execute (Real Google Sheet Sync for Client/GH Pages)
          if (pathOnly === "/api/import/execute" && method === "POST") {
            try {
              const body = init?.body ? JSON.parse(init.body as string) : {};
              let csvContent = body.csvContent || "";
              if (!csvContent && body.useSampleFile) {
                const isGh = typeof window !== "undefined" && window.location.pathname.startsWith("/facebook");
                const sampleRes = await originalFetch(isGh ? "/facebook/data.csv" : "/data.csv");
                if (sampleRes.ok) csvContent = await sampleRes.text();
              }

              if (!csvContent || !csvContent.trim()) {
                return new Response(JSON.stringify({ success: false, error: "No CSV content to import" }), {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                });
              }

              const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: "greedy" });
              const rows = (parsed.data || []) as Record<string, string>[];

              // Read live sheet data to detect existing payment IDs
              const liveData = await getLiveSheetData(storedConfig.webhookUrl, true);
              const existingIds = new Set<string>();
              (liveData?.revenues || []).forEach((r: any) => {
                if (r.payment_id) existingIds.add(String(r.payment_id).trim());
              });

              const newRowsToPush: any[] = [];
              const productMap = new Map<string, number>();
              let totalGross = 0;
              let totalNet = 0;
              let updatedCount = 0;

              for (const row of rows) {
                const paymentId = (row["Payment ID"] || row["payment_id"] || row["ID"] || "").trim();
                const rawDate = row["Date"] || row["date"] || "";
                const isoDate = normalizeDateToISO(rawDate);
                const productTitle = (row["Product Title"] || row["Product Name"] || row["Product"] || "Digital Notes").trim();
                const status = (row["Status"] || row["status"] || "Received").trim();
                const paidByCustomer = parseFloat(row["Paid By Customer"] || row["Amount"] || row["amount"] || "0") || 0;
                const earnedAmount = parseFloat(row["Earned Amount"] || row["Net Amount"] || row["net_amount"] || "0") || 0;
                const email = (row["Customer Email"] || row["Email"] || "").trim();
                const isReceived = !status || status.toLowerCase() === "received";

                if (!isoDate || paidByCustomer <= 0) continue;
                if (!isReceived) continue;

                if (productTitle && productTitle !== "--") {
                  if (!productMap.has(productTitle) || paidByCustomer > (productMap.get(productTitle) || 0)) {
                    productMap.set(productTitle, paidByCustomer);
                  }
                }

                const item = {
                  id: paymentId || `PAY-${Date.now()}`,
                  date: isoDate,
                  payment_id: paymentId || `PAY-${Date.now()}`,
                  product_name: productTitle,
                  amount: paidByCustomer,
                  net_amount: earnedAmount > 0 ? earnedAmount : paidByCustomer,
                  product_cost: 0,
                  customer_email: email,
                  status: status || "Received",
                };

                if (paymentId && existingIds.has(paymentId)) {
                  updatedCount++;
                } else {
                  newRowsToPush.push(item);
                  if (paymentId) existingIds.add(paymentId);
                }

                totalGross += paidByCustomer;
                totalNet += earnedAmount > 0 ? earnedAmount : paidByCustomer;
              }

              // Push new rows to Google Sheet Webhook
              if (storedConfig.webhookUrl && newRowsToPush.length > 0) {
                const payload = JSON.stringify({
                  action: "bulk_insert",
                  sheet: "Revenues",
                  rows: newRowsToPush,
                });
                try {
                  await originalFetch(storedConfig.webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: payload,
                    redirect: "follow",
                  });
                } catch {
                  try {
                    await originalFetch(storedConfig.webhookUrl, {
                      method: "POST",
                      mode: "no-cors",
                      headers: { "Content-Type": "text/plain;charset=utf-8" },
                      body: payload,
                    });
                  } catch (e) {
                    console.warn("Webhook direct push fallback error:", e);
                  }
                }
              }

              // Push new products
              const existingProds = new Set((liveData?.products || []).map((p: any) => p.name?.trim().toLowerCase()));
              const prodsToInsert: any[] = [];
              for (const [name, price] of productMap.entries()) {
                if (!existingProds.has(name.toLowerCase())) {
                  prodsToInsert.push({
                    name,
                    category: "Digital Notes",
                    selling_price: price,
                    product_cost: 0,
                  });
                  existingProds.add(name.toLowerCase());
                }
              }
              if (storedConfig.webhookUrl && prodsToInsert.length > 0) {
                const prodPayload = JSON.stringify({
                  action: "bulk_insert",
                  sheet: "Products",
                  rows: prodsToInsert,
                });
                try {
                  await originalFetch(storedConfig.webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: prodPayload,
                    redirect: "follow",
                  });
                } catch {
                  try {
                    await originalFetch(storedConfig.webhookUrl, {
                      method: "POST",
                      mode: "no-cors",
                      headers: { "Content-Type": "text/plain;charset=utf-8" },
                      body: prodPayload,
                    });
                  } catch {}
                }
              }

              // Cache update
              const localRevs = JSON.parse(localStorage.getItem("gh_local_revs") || "[]");
              const localIds = new Set(localRevs.map((lr: any) => lr.payment_id));
              for (const item of newRowsToPush) {
                if (!localIds.has(item.payment_id)) {
                  localRevs.unshift(item);
                  localIds.add(item.payment_id);
                }
              }
              localStorage.setItem("gh_local_revs", JSON.stringify(localRevs));
              sheetCache = null;

              return new Response(
                JSON.stringify({
                  success: true,
                  insertedCount: newRowsToPush.length,
                  updatedCount,
                  totalGross: Math.round(totalGross * 100) / 100,
                  totalNet: Math.round(totalNet * 100) / 100,
                  detectedProductsCount: productMap.size,
                  newProductsCreated: prodsToInsert.length,
                  sheetPushed: true,
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            } catch (err: any) {
              return new Response(JSON.stringify({ success: false, error: err.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          // 2. Test webhook
          if (pathOnly === "/api/sheets/test-webhook") {
            try {
              const pingRes = await originalFetch(`${storedConfig.webhookUrl}?action=ping`, {
                redirect: "follow",
              });
              const json = await pingRes.json();
              return new Response(JSON.stringify(json), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            } catch (e: any) {
              return new Response(JSON.stringify({ success: false, error: e.message }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          // 3. Sync & Push-All
          if (pathOnly === "/api/sheets/push-all") {
            try {
              const isGh = typeof window !== "undefined" && window.location.pathname.startsWith("/facebook");
              const sampleRes = await originalFetch(isGh ? "/facebook/data.csv" : "/data.csv");
              let insertedCount = 0;
              if (sampleRes.ok) {
                const csvText = await sampleRes.text();
                const impRes = await window.fetch("/api/import/execute", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ csvContent: csvText }),
                });
                const impData = await impRes.json();
                insertedCount = impData.insertedCount || 0;
              }
              sheetCache = null;
              return new Response(
                JSON.stringify({
                  success: true,
                  message: `Initial data pushed to Google Sheet! Added ${insertedCount} sales records.`,
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              );
            } catch (e: any) {
              return new Response(JSON.stringify({ success: false, error: e.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
          }

          if (pathOnly === "/api/sheets/sync") {
            const data = await getLiveSheetData(storedConfig.webhookUrl, true);
            return new Response(
              JSON.stringify({
                success: true,
                message: "Synced with Google Sheets!",
                sheetId: storedConfig.sheetId,
                sheetUrl: storedConfig.sheetUrl,
                tabs: {
                  revenues: { rows: (data.revenues || []).length, inserted: 0, updated: (data.revenues || []).length, skipped: 0 },
                  facebookAds: { rows: (data.facebookAds || []).length, imported: (data.facebookAds || []).length, skipped: 0 },
                  otherExpenses: { rows: (data.otherExpenses || []).length, imported: (data.otherExpenses || []).length, skipped: 0 },
                  products: { rows: (data.products || []).length, upserted: (data.products || []).length },
                },
                ...data,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          const db = await getLiveSheetData(storedConfig.webhookUrl);

          // 4. Dashboard
          if (pathOnly === "/api/dashboard") {
            const startDate = searchParams.get("startDate") || MIN_DATA_DATE;
            const endDate = searchParams.get("endDate") || "2099-12-31";
            const dashboard = computeDashboard(db, startDate, endDate);
            return new Response(JSON.stringify(dashboard), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // 5. Ads
          if (pathOnly.startsWith("/api/ads")) {
            if (method === "POST" && init?.body) {
              const body = JSON.parse(init.body as string);
              const newAd = { id: `AD-${Date.now()}`, ...body };
              const localAds = JSON.parse(localStorage.getItem("gh_local_ads") || "[]");
              localAds.push(newAd);
              localStorage.setItem("gh_local_ads", JSON.stringify(localAds));

              originalFetch(storedConfig.webhookUrl, {
                method: "POST",
                body: JSON.stringify({ action: "add_ad", ...body }),
              }).catch(() => {});

              return new Response(JSON.stringify({ success: true, expense: newAd }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
            return new Response(
              JSON.stringify({
                success: true,
                expenses: db.facebookAds || [],
                data: db.facebookAds || [],
                totalSpend: (db.facebookAds || []).reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // 6. Revenues
          if (pathOnly.startsWith("/api/revenues")) {
            return new Response(
              JSON.stringify({
                success: true,
                revenues: db.revenues || [],
                data: db.revenues || [],
                totalRevenue: (db.revenues || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // 7. Expenses
          if (pathOnly.startsWith("/api/expenses")) {
            return new Response(
              JSON.stringify({
                success: true,
                expenses: db.otherExpenses || [],
                data: db.otherExpenses || [],
                totalAmount: (db.otherExpenses || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // 8. Products
          if (pathOnly.startsWith("/api/products")) {
            return new Response(
              JSON.stringify({
                success: true,
                products: db.products || [],
                data: db.products || [],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // 9. Transactions
          if (pathOnly.startsWith("/api/transactions")) {
            const dashboard = computeDashboard(db);
            return new Response(
              JSON.stringify({
                success: true,
                transactions: dashboard.recentTransactions,
                data: dashboard.recentTransactions,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // 10. Settings
          if (pathOnly === "/api/settings") {
            return new Response(
              JSON.stringify({
                success: true,
                settings: { currency: "INR", currencySymbol: "₹" },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
        } catch (err: any) {
          console.warn("Client API mock error:", err);
        }
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
