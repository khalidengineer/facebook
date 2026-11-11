import { NextResponse } from "next/server";
import { getSheetConfig, saveSheetConfig } from "@/lib/sheet-db";

export async function GET() {
  try {
    const config = getSheetConfig();
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = saveSheetConfig({
      sheetUrl: body.sheetUrl,
      webhookUrl: body.webhookUrl,
      sheetId: body.sheetId,
      autoSync: body.autoSync,
    });
    return NextResponse.json({ success: true, config: updated, message: "Google Sheet settings saved successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
