"use client";

import { useEffect } from "react";

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
        product_name: String(r["Product Title"] || r.product_name || ""),
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
        product_name: String(a["Product"] || a.product_name || ""),
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
  // Enforce baseline minimum date 2026-11-10
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
    .map(([date, val]) => ({ date, ...val }))
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

  // 6. Recent transactions
  const recentTransactions = [
    ...(db.facebookAds || []).slice(0, 5).map((a: any) => ({
      type: "ad",
      id: a.id,
      date: a.date,
      title: a.campaign_name,
      product_name: a.product_name,
      amount: a.amount,
      notes: a.notes,
    })),
    ...(db.revenues || []).slice(0, 8).map((r: any) => ({
      type: "revenue",
      id: r.id,
      date: r.date,
      title: r.product_name,
      product_name: r.product_name,
      amount: r.amount,
      status: r.status || "Received",
      notes: `Payment ID: ${r.payment_id}`,
    })),
  ]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
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
    dailySpendAndRevenue,
    monthlyComparison,
    productRevenue: (db.products || []).map((p: any) => ({
      name: p.name,
      fullName: p.name,
      revenue: (receivedRevs || [])
        .filter((r: any) => r.product_name === p.name)
        .reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0),
      adSpend: (filteredAds || [])
        .filter((a: any) => a.product_name === p.name)
        .reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0),
      netProfit: 0,
      roas: 0,
    })),
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

          // 3. Sync
          if (pathOnly === "/api/sheets/sync" || pathOnly === "/api/sheets/push-all") {
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
