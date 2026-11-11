import { NextResponse } from "next/server";
import { pushBatchToSheet, getSheetConfig } from "@/lib/sheet-db";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export async function POST() {
  try {
    const config = getSheetConfig();
    if (!config.webhookUrl || !config.webhookUrl.startsWith("http")) {
      return NextResponse.json(
        {
          success: false,
          error: "Google Apps Script Web App URL is required to push data to Google Sheet. Please paste the Web App URL in Settings.",
        },
        { status: 400 }
      );
    }

    const results: Record<string, any> = {};

    // 1. Revenues
    const revFile = path.join(process.cwd(), "GoogleSheet_Revenues.csv");
    if (fs.existsSync(revFile)) {
      const csv = fs.readFileSync(revFile, "utf8");
      const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy" }).data;
      if (rows.length > 0) {
        results.revenues = await pushBatchToSheet("Revenues", rows);
      }
    }

    // 2. Products
    const prodFile = path.join(process.cwd(), "GoogleSheet_Products.csv");
    if (fs.existsSync(prodFile)) {
      const csv = fs.readFileSync(prodFile, "utf8");
      const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy" }).data;
      if (rows.length > 0) {
        results.products = await pushBatchToSheet("Products", rows);
      }
    }

    // 3. Other Expenses
    const expFile = path.join(process.cwd(), "GoogleSheet_OtherExpenses.csv");
    if (fs.existsSync(expFile)) {
      const csv = fs.readFileSync(expFile, "utf8");
      const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy" }).data;
      if (rows.length > 0) {
        results.otherExpenses = await pushBatchToSheet("Other Expenses", rows);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Data successfully pushed to Google Sheet!",
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
