import { NextResponse } from "next/server";
import { fetchLiveSheetData, getSheetConfig } from "@/lib/sheet-db";

export async function GET() {
  try {
    const data = await fetchLiveSheetData(true);
    const config = getSheetConfig();

    return NextResponse.json({
      success: true,
      sheetId: config.sheetId,
      sheetUrl: config.sheetUrl,
      timestamp: new Date().toISOString(),
      tabs: {
        revenues: { rows: data.revenues.length, inserted: 0, updated: data.revenues.length, skipped: 0 },
        facebookAds: { rows: data.facebookAds.length, imported: data.facebookAds.length, skipped: 0 },
        otherExpenses: { rows: data.otherExpenses.length, imported: data.otherExpenses.length, skipped: 0 },
        products: { rows: data.products.length, upserted: data.products.length },
      },
      errors: [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
