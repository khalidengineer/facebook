import { NextResponse } from "next/server";
import { fetchLiveSheetData } from "@/lib/sheet-db";

export async function GET(request: Request) {
  try {
    const db = await fetchLiveSheetData();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const productId = searchParams.get("productId");
    const search = searchParams.get("search")?.toLowerCase();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const allRecords: any[] = [];

    // 1. Ads
    if (type === "all" || type === "ad") {
      db.facebookAds.forEach((a) => {
        if (startDate && a.date < startDate) return;
        if (endDate && a.date > endDate) return;
        if (productId && productId !== "all" && a.product_name && !a.product_name.toLowerCase().includes(productId.toLowerCase())) return;
        if (search) {
          const match =
            (a.campaign_name && a.campaign_name.toLowerCase().includes(search)) ||
            (a.product_name && a.product_name.toLowerCase().includes(search)) ||
            (a.notes && a.notes.toLowerCase().includes(search));
          if (!match) return;
        }

        allRecords.push({
          type: "ad",
          id: a.id,
          date: a.date,
          title: a.campaign_name,
          product_name: a.product_name,
          amount: a.amount,
          notes: a.notes,
          currency: a.currency || "INR",
        });
      });
    }

    // 2. Revenues
    if (type === "all" || type === "revenue") {
      db.revenues.forEach((r) => {
        if (startDate && r.date < startDate) return;
        if (endDate && r.date > endDate) return;
        if (productId && productId !== "all" && r.product_name && !r.product_name.toLowerCase().includes(productId.toLowerCase())) return;
        if (search) {
          const match =
            (r.product_name && r.product_name.toLowerCase().includes(search)) ||
            (r.payment_id && r.payment_id.toLowerCase().includes(search)) ||
            (r.customer_email && r.customer_email.toLowerCase().includes(search));
          if (!match) return;
        }

        allRecords.push({
          type: "revenue",
          id: r.id,
          date: r.date,
          title: r.product_name,
          product_name: r.product_name,
          amount: r.amount,
          net_amount: r.net_amount,
          customer_email: r.customer_email,
          payment_id: r.payment_id,
          status: r.status || "Received",
          notes: `Payment ID: ${r.payment_id}`,
        });
      });
    }

    // 3. Other Expenses
    if (type === "all" || type === "expense") {
      db.otherExpenses.forEach((e) => {
        if (startDate && e.date < startDate) return;
        if (endDate && e.date > endDate) return;
        if (search) {
          const match =
            (e.description && e.description.toLowerCase().includes(search)) ||
            (e.category && e.category.toLowerCase().includes(search)) ||
            (e.notes && e.notes.toLowerCase().includes(search));
          if (!match) return;
        }

        allRecords.push({
          type: "expense",
          id: e.id,
          date: e.date,
          title: `${e.category} - ${e.description}`,
          product_name: "",
          amount: e.amount,
          notes: e.notes,
        });
      });
    }

    allRecords.sort((a, b) => b.date.localeCompare(a.date));

    const total = allRecords.length;
    const startIndex = (page - 1) * limit;
    const records = allRecords.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
