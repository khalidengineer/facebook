import { NextResponse } from "next/server";
import { fetchLiveSheetData } from "@/lib/sheet-db";

export async function GET(request: Request, context: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await context.params;
    const db = await fetchLiveSheetData();

    const ads = db.facebookAds.filter((a) => a.date === date);
    const revenues = db.revenues.filter((r) => r.date === date && (!r.status || r.status.toLowerCase() === "received"));
    const otherExpenses = db.otherExpenses.filter((e) => e.date === date);

    const totalAds = ads.reduce((sum, a) => sum + (a.amount || 0), 0);
    const totalGrossRevenue = revenues.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalNetRevenue = revenues.reduce((sum, r) => sum + (r.net_amount || r.amount || 0), 0);
    const totalOther = otherExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalProductCost = revenues.reduce((sum, r) => sum + (r.product_cost || 0), 0);

    const totalOrders = revenues.length;
    const costPerSale = totalOrders > 0 ? Math.round((totalAds / totalOrders) * 100) / 100 : 0;
    const netProfit = Math.round((totalNetRevenue - totalAds - totalOther - totalProductCost) * 100) / 100;
    const roas = totalAds > 0 ? Math.round((totalGrossRevenue / totalAds) * 100) / 100 : 0;

    return NextResponse.json({
      success: true,
      date,
      summary: {
        totalAds: Math.round(totalAds * 100) / 100,
        totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
        totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
        totalOther: Math.round(totalOther * 100) / 100,
        totalProductCost: Math.round(totalProductCost * 100) / 100,
        totalOrders,
        costPerSale,
        netProfit,
        roas,
      },
      ads,
      revenues,
      otherExpenses,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
