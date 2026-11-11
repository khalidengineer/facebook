import { NextResponse } from "next/server";
import { getProductWiseReport } from "@/lib/financials";
import { getDateRangeFromPreset } from "@/lib/date-utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const preset = searchParams.get("preset") || "last_30_days";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;

    const { startDate, endDate } = getDateRangeFromPreset(preset, customStart, customEnd);
    const report = await getProductWiseReport({ startDate, endDate });

    // Calculate highlights
    let bestPerforming: any = null;
    let highestAdSpend: any = null;
    let mostProfitable: any = null;
    const lossMakingProducts: any[] = [];

    const activeReport = report.filter((p) => p.revenue > 0 || p.adSpend > 0);

    for (const item of activeReport) {
      if (!bestPerforming || item.netProfit > bestPerforming.netProfit) {
        bestPerforming = item;
      }
      if (!highestAdSpend || item.adSpend > highestAdSpend.adSpend) {
        highestAdSpend = item;
      }
      if (!mostProfitable || item.roas > mostProfitable.roas) {
        if (item.adSpend > 0) mostProfitable = item;
      }
      if (item.netProfit < 0) {
        lossMakingProducts.push(item);
      }
    }

    const lowestPerforming = activeReport.length > 0
      ? [...activeReport].sort((a, b) => a.netProfit - b.netProfit)[0]
      : null;

    const totalRevenue = report.reduce((sum, r) => sum + r.revenue, 0);
    const totalAdSpend = report.reduce((sum, r) => sum + r.adSpend, 0);
    const totalProfit = report.reduce((sum, r) => sum + r.netProfit, 0);

    return NextResponse.json({
      success: true,
      filter: { preset, startDate, endDate },
      products: report,
      totals: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalAdSpend: Math.round(totalAdSpend * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
      },
      highlights: {
        bestPerforming,
        lowestPerforming,
        highestAdSpend,
        mostProfitable: mostProfitable || bestPerforming,
        lossMakingCount: lossMakingProducts.length,
        lossMakingProducts,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
