import { NextResponse } from "next/server";
import { fetchLiveSheetData } from "@/lib/sheet-db";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab");
    const db = await fetchLiveSheetData();

    // Check if we have pre-generated CSV files
    let revenuesCsv = "";
    let productsCsv = "";
    let expensesCsv = "";
    let adsCsv = "";

    const revFile = path.join(process.cwd(), "GoogleSheet_Revenues.csv");
    if (fs.existsSync(revFile)) {
      revenuesCsv = fs.readFileSync(revFile, "utf8");
    } else {
      revenuesCsv = Papa.unparse(
        db.revenues.map((r) => ({
          Date: r.date,
          "Payment ID": r.payment_id,
          "Product Title": r.product_name,
          "Paid By Customer": r.amount,
          "Earned Amount": r.net_amount,
          "Customer Email": r.customer_email,
          Status: r.status,
        }))
      );
    }

    const prodFile = path.join(process.cwd(), "GoogleSheet_Products.csv");
    if (fs.existsSync(prodFile)) {
      productsCsv = fs.readFileSync(prodFile, "utf8");
    } else {
      productsCsv = Papa.unparse(
        db.products.map((p) => ({
          "Product Name": p.name,
          Category: p.category,
          "Selling Price": p.selling_price,
          "Product Cost": p.product_cost,
        }))
      );
    }

    const expFile = path.join(process.cwd(), "GoogleSheet_OtherExpenses.csv");
    if (fs.existsSync(expFile)) {
      expensesCsv = fs.readFileSync(expFile, "utf8");
    } else {
      expensesCsv = Papa.unparse(
        db.otherExpenses.map((e) => ({
          Date: e.date,
          Category: e.category,
          Description: e.description,
          Amount: e.amount,
          Notes: e.notes,
        }))
      );
    }

    const adsFile = path.join(process.cwd(), "GoogleSheet_FacebookAds.csv");
    if (fs.existsSync(adsFile)) {
      adsCsv = fs.readFileSync(adsFile, "utf8");
    } else {
      adsCsv = Papa.unparse(
        db.facebookAds.map((a) => ({
          Date: a.date,
          "Campaign Name": a.campaign_name,
          Product: a.product_name,
          "Amount Spent": a.amount,
          "Campaign Type": a.campaign_type,
          Notes: a.notes,
        }))
      );
    }

    if (tab === "revenues") {
      return new NextResponse(revenuesCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="GoogleSheet_Revenues.csv"',
        },
      });
    }

    if (tab === "facebook_ads") {
      return new NextResponse(adsCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="GoogleSheet_FacebookAds.csv"',
        },
      });
    }

    if (tab === "other_expenses") {
      return new NextResponse(expensesCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="GoogleSheet_OtherExpenses.csv"',
        },
      });
    }

    if (tab === "products") {
      return new NextResponse(productsCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="GoogleSheet_Products.csv"',
        },
      });
    }

    const revRows = Papa.parse(revenuesCsv, { header: true, skipEmptyLines: "greedy" }).data.length;
    const prodRows = Papa.parse(productsCsv, { header: true, skipEmptyLines: "greedy" }).data.length;
    const expRows = Papa.parse(expensesCsv, { header: true, skipEmptyLines: "greedy" }).data.length;
    const adsRows = Papa.parse(adsCsv, { header: true, skipEmptyLines: "greedy" }).data.length;

    return NextResponse.json({
      success: true,
      counts: {
        revenues: revRows,
        ads: adsRows,
        otherExpenses: expRows,
        products: prodRows,
      },
      csvData: {
        revenues: revenuesCsv,
        facebookAds: adsCsv,
        otherExpenses: expensesCsv,
        products: productsCsv,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
