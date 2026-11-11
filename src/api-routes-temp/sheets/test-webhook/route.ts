import { NextResponse } from "next/server";
import { getSheetConfig } from "@/lib/sheet-db";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const config = getSheetConfig();
    const urlToTest = body.webhookUrl || config.webhookUrl;

    if (!urlToTest || !urlToTest.startsWith("http")) {
      return NextResponse.json(
        {
          success: false,
          error: "No Webhook URL provided. Please enter a valid Google Apps Script Web App URL.",
        },
        { status: 400 }
      );
    }

    // Ping the Google Apps Script Web App
    const pingUrl = `${urlToTest}${urlToTest.includes("?") ? "&" : "?"}action=ping&t=${Date.now()}`;
    const res = await fetch(pingUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Google Apps Script returned HTTP status ${res.status}. Please make sure the deployment has 'Who has access' set to 'Anyone'.`,
        },
        { status: 400 }
      );
    }

    const json = await res.json().catch(() => null);

    if (json && json.success) {
      return NextResponse.json({
        success: true,
        sheetName: json.sheetName || "Connected Sheet",
        message: "Successfully connected to Google Sheet via Apps Script Web App!",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Script responded, but unexpected response: " + JSON.stringify(json),
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Could not reach Webhook: ${err.message}. Make sure you deployed as Web App with 'Who has access: Anyone'.`,
      },
      { status: 500 }
    );
  }
}
