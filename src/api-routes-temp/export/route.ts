import { NextResponse } from "next/server";
import { getDateWiseReport, getProductWiseReport } from "@/lib/financials";
import { getDateRangeFromPreset } from "@/lib/date-utils";
import { fetchLiveSheetData } from "@/lib/sheet-db";
import * as XLSX from "xlsx";
import Papa from "papaparse";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("target") || "all_transactions";
    const format = searchParams.get("format") || "csv";
    const preset = searchParams.get("preset") || "all_time";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;
    const productIdStr = searchParams.get("productId");
    const productId = productIdStr ? parseInt(productIdStr, 10) : undefined;

    const { startDate, endDate } = getDateRangeFromPreset(preset, customStart, customEnd);
    const db = await fetchLiveSheetData();
    let rows: any[] = [];
    let filename = `export_${target}_${new Date().toISOString().substring(0, 10)}`;

    if (target === "ads") {
      rows = db.facebookAds.filter((a) => a.date >= startDate && a.date <= endDate);
      filename = `fb_ads_${startDate}_to_${endDate}`;
    } else if (target === "revenues") {
      rows = db.revenues.filter((r) => r.date >= startDate && r.date <= endDate);
      filename = `revenue_${startDate}_to_${endDate}`;
    } else if (target === "expenses") {
      rows = db.otherExpenses.filter((e) => e.date >= startDate && e.date <= endDate);
      filename = `other_expenses_${startDate}_to_${endDate}`;
    } else if (target === "date_report") {
      const report = await getDateWiseReport({ startDate, endDate, productId });
      rows = report.map((r) => ({
        Date: r.date,
        "Facebook Ads Spend (INR)": r.adSpend,
        "Gross Revenue (INR)": r.revenue,
        "Net Revenue (INR)": r.netRevenue,
        "Other Expenses (INR)": r.otherExpenses,
        "Product Cost (INR)": r.productCost,
        "Net Profit (INR)": r.profit,
        Orders: r.orders,
        ROAS: r.roas,
      }));
      filename = `date_report_${startDate}_to_${endDate}`;
    } else if (target === "product_report") {
      const report = await getProductWiseReport({ startDate, endDate });
      rows = report.map((p) => ({
        Product: p.productName,
        Category: p.category,
        "Selling Price": p.sellingPrice,
        Orders: p.orders,
        "Total Revenue": p.revenue,
        "Net Revenue": p.netRevenue,
        "Ad Spend": p.adSpend,
        "Product Cost": p.productCost,
        "Net Profit": p.netProfit,
        ROAS: p.roas,
        "Profit Margin (%)": p.marginPercent,
      }));
      filename = `product_report_${startDate}_to_${endDate}`;
    } else {
      // All transactions
      const ads = db.facebookAds
        .filter((a) => a.date >= startDate && a.date <= endDate)
        .map((a) => ({
          Date: a.date,
          Type: "Facebook Ad Expense",
          Description: a.campaign_name,
          Product: a.product_name,
          Amount: -a.amount,
        }));
      const revs = db.revenues
        .filter((r) => r.date >= startDate && r.date <= endDate)
        .map((r) => ({
          Date: r.date,
          Type: "Product Revenue",
          Description: `Payment ID: ${r.payment_id}`,
          Product: r.product_name,
          Amount: r.amount,
        }));
      const exps = db.otherExpenses
        .filter((e) => e.date >= startDate && e.date <= endDate)
        .map((e) => ({
          Date: e.date,
          Type: "Other Expense",
          Description: `${e.category} - ${e.description}`,
          Product: "",
          Amount: -e.amount,
        }));
      rows = [...ads, ...revs, ...exps].sort((a, b) => b.Date.localeCompare(a.Date));
      filename = `all_transactions_${startDate}_to_${endDate}`;
    }

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Export");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    // Default CSV
    const csv = Papa.unparse(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
