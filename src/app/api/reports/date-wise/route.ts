import { NextResponse } from "next/server";
import { getDateWiseReport } from "@/lib/financials";
import { getDateRangeFromPreset } from "@/lib/date-utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const preset = searchParams.get("preset") || "last_30_days";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;
    const productIdStr = searchParams.get("productId");
    const productId = productIdStr ? parseInt(productIdStr, 10) : undefined;

    const { startDate, endDate } = getDateRangeFromPreset(preset, customStart, customEnd);
    const report = await getDateWiseReport({ startDate, endDate, productId });

    const totalAdSpend = report.reduce((sum, r) => sum + r.adSpend, 0);
    const totalRevenue = report.reduce((sum, r) => sum + r.revenue, 0);
    const totalNetRevenue = report.reduce((sum, r) => sum + r.netRevenue, 0);
    const totalOtherExpenses = report.reduce((sum, r) => sum + r.otherExpenses, 0);
    const totalProductCost = report.reduce((sum, r) => sum + r.productCost, 0);
    const totalProfit = report.reduce((sum, r) => sum + r.profit, 0);
    const totalOrders = report.reduce((sum, r) => sum + r.orders, 0);
    const overallROAS = totalAdSpend > 0 ? Math.round((totalRevenue / totalAdSpend) * 100) / 100 : 0;
    const overallCostPerSale = totalOrders > 0 ? Math.round((totalAdSpend / totalOrders) * 100) / 100 : 0;

    return NextResponse.json({
      success: true,
      filter: { preset, startDate, endDate, productId },
      report,
      totals: {
        totalAdSpend: Math.round(totalAdSpend * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
        totalOtherExpenses: Math.round(totalOtherExpenses * 100) / 100,
        totalProductCost: Math.round(totalProductCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalOrders,
        overallROAS,
        overallCostPerSale,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
