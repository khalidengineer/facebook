import { NextResponse } from "next/server";
import { getFinancialSummary, getDateWiseReport, getProductWiseReport } from "@/lib/financials";
import { getDateRangeFromPreset } from "@/lib/date-utils";
import { fetchLiveSheetData } from "@/lib/sheet-db";

export async function GET(request: Request) {
  try {
    const sheetData = await fetchLiveSheetData();

    const { searchParams } = new URL(request.url);
    const preset = searchParams.get("preset") || "all_time";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;
    const productIdStr = searchParams.get("productId");
    const productId = productIdStr ? parseInt(productIdStr, 10) : undefined;

    const { startDate, endDate } = getDateRangeFromPreset(preset, customStart, customEnd);
    const filter = { startDate, endDate, productId };

    const summary = await getFinancialSummary(filter);
    const dailyReport = await getDateWiseReport(filter);
    const productReport = await getProductWiseReport({ startDate, endDate });

    // Format daily data for Recharts (chronological order)
    const dailySpendAndRevenue = [...dailyReport]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        adSpend: d.adSpend,
        revenue: d.revenue,
        netRevenue: d.netRevenue,
        profit: d.profit,
      }));

    // Monthly aggregation
    const monthlyMap = new Map<string, { adSpend: number; revenue: number; profit: number }>();
    for (const d of dailyReport) {
      const monthKey = d.date.substring(0, 7); // YYYY-MM
      const curr = monthlyMap.get(monthKey) || { adSpend: 0, revenue: 0, profit: 0 };
      curr.adSpend += d.adSpend;
      curr.revenue += d.revenue;
      curr.profit += d.profit;
      monthlyMap.set(monthKey, curr);
    }
    const monthlyComparison = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        adSpend: Math.round(data.adSpend),
        revenue: Math.round(data.revenue),
        profit: Math.round(data.profit),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Product breakdown for charts
    const productRevenue = productReport
      .filter((p) => p.revenue > 0 || p.adSpend > 0)
      .map((p) => ({
        name: p.productName.length > 25 ? p.productName.substring(0, 22) + "..." : p.productName,
        fullName: p.productName,
        revenue: p.revenue,
        adSpend: p.adSpend,
        netProfit: p.netProfit,
        roas: p.roas,
      }));

    // Top recent transactions directly from sheet data
    const recentAds = sheetData.facebookAds.slice(0, 5).map((a) => ({
      type: "ad",
      id: a.id,
      date: a.date,
      title: a.campaign_name,
      product_name: a.product_name,
      amount: a.amount,
      notes: a.notes,
    }));

    const recentRevs = sheetData.revenues.slice(0, 8).map((r) => ({
      type: "revenue",
      id: r.id,
      date: r.date,
      title: r.product_name,
      product_name: r.product_name,
      amount: r.amount,
      status: r.status || "Received",
      notes: `Payment ID: ${r.payment_id}`,
    }));

    const recentExps = sheetData.otherExpenses.slice(0, 5).map((e) => ({
      type: "expense",
      id: e.id,
      date: e.date,
      title: `${e.category} - ${e.description}`,
      product_name: "",
      amount: e.amount,
      notes: e.notes,
    }));

    const recentTransactions = [...recentAds, ...recentRevs, ...recentExps]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    // Filtered orders for the complete data table at bottom
    const orders = sheetData.revenues
      .filter((r) => {
        if (r.date < startDate || r.date > endDate) return false;
        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return NextResponse.json({
      success: true,
      filter: { preset, startDate, endDate, productId },
      summary,
      charts: {
        dailySpendAndRevenue,
        monthlyComparison,
        productRevenue,
      },
      orders,
      recentTransactions,
    });
  } catch (err: any) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
