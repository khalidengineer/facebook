import { NextResponse } from "next/server";
import { normalizeDateToISO } from "@/lib/date-utils";
import { fetchLiveSheetData, createAdExpense } from "@/lib/sheet-db";

export async function GET(request: Request) {
  try {
    const db = await fetchLiveSheetData();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const productId = searchParams.get("productId");
    const campaign = searchParams.get("campaign");
    const search = searchParams.get("search")?.toLowerCase();
    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    let expenses = [...db.facebookAds];

    if (startDate) {
      expenses = expenses.filter((e) => e.date >= startDate);
    }
    if (endDate) {
      expenses = expenses.filter((e) => e.date <= endDate);
    }
    if (productId && productId !== "all") {
      expenses = expenses.filter((e) => e.product_name && e.product_name.toLowerCase().includes(productId.toLowerCase()));
    }
    if (campaign && campaign !== "all") {
      expenses = expenses.filter((e) => e.campaign_name && e.campaign_name.toLowerCase() === campaign.toLowerCase());
    }
    if (search) {
      expenses = expenses.filter(
        (e) =>
          (e.campaign_name && e.campaign_name.toLowerCase().includes(search)) ||
          (e.product_name && e.product_name.toLowerCase().includes(search)) ||
          (e.notes && e.notes.toLowerCase().includes(search))
      );
    }

    expenses.sort((a, b) => {
      if (sortBy === "amount") {
        return (a.amount - b.amount) * sortOrder;
      }
      if (sortBy === "campaign") {
        return (a.campaign_name || "").localeCompare(b.campaign_name || "") * sortOrder;
      }
      if (sortBy === "product") {
        return (a.product_name || "").localeCompare(b.product_name || "") * sortOrder;
      }
      // default: date
      return (a.date || "").localeCompare(b.date || "") * sortOrder;
    });

    const totalAmount = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const campaigns = Array.from(new Set(db.facebookAds.map((a) => a.campaign_name).filter(Boolean))).sort();

    return NextResponse.json({
      success: true,
      expenses,
      totalAmount: Math.round(totalAmount * 100) / 100,
      count: expenses.length,
      campaigns,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, campaign_name, product_name, campaign_type, amount, notes } = body;

    const normalizedDate = normalizeDateToISO(date);
    if (!normalizedDate) {
      return NextResponse.json({ success: false, error: "Valid date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    if (!campaign_name || !campaign_name.trim()) {
      return NextResponse.json({ success: false, error: "Campaign name is required" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ success: false, error: "Valid amount is required" }, { status: 400 });
    }

    const result = await createAdExpense({
      date: normalizedDate,
      campaign_name: campaign_name.trim(),
      product_name: product_name?.trim() || "",
      campaign_type: campaign_type?.trim() || "Sales",
      amount: parsedAmount,
      notes: notes?.trim() || "",
    });

    return NextResponse.json({
      success: true,
      expense: result.item,
      sheetSynced: result.sheetSynced,
      warning: result.sheetSynced ? undefined : result.message,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
