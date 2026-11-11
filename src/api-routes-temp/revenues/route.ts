import { NextResponse } from "next/server";
import { normalizeDateToISO } from "@/lib/date-utils";
import { fetchLiveSheetData, createRevenue } from "@/lib/sheet-db";

export async function GET(request: Request) {
  try {
    const db = await fetchLiveSheetData();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const productId = searchParams.get("productId");
    const statusFilter = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase();
    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    let revenues = [...db.revenues];

    if (startDate) {
      revenues = revenues.filter((r) => r.date >= startDate);
    }
    if (endDate) {
      revenues = revenues.filter((r) => r.date <= endDate);
    }
    if (productId && productId !== "all") {
      revenues = revenues.filter((r) => r.product_name && r.product_name.toLowerCase().includes(productId.toLowerCase()));
    }
    if (statusFilter && statusFilter !== "all") {
      if (statusFilter.toLowerCase() === "received") {
        revenues = revenues.filter((r) => !r.status || r.status.toLowerCase() === "received");
      } else if (statusFilter.toLowerCase() === "cancelled") {
        revenues = revenues.filter((r) => r.status && r.status.toLowerCase().includes("cancelled"));
      } else {
        revenues = revenues.filter((r) => r.status && r.status.toLowerCase() === statusFilter.toLowerCase());
      }
    }
    if (search) {
      revenues = revenues.filter(
        (r) =>
          (r.product_name && r.product_name.toLowerCase().includes(search)) ||
          (r.payment_id && r.payment_id.toLowerCase().includes(search)) ||
          (r.customer_email && r.customer_email.toLowerCase().includes(search)) ||
          (r.status && r.status.toLowerCase().includes(search))
      );
    }

    revenues.sort((a, b) => {
      if (sortBy === "amount") return (a.amount - b.amount) * sortOrder;
      if (sortBy === "net_amount") return (a.net_amount - b.net_amount) * sortOrder;
      if (sortBy === "product") return (a.product_name || "").localeCompare(b.product_name || "") * sortOrder;
      if (sortBy === "status") return (a.status || "").localeCompare(b.status || "") * sortOrder;
      return (a.date || "").localeCompare(b.date || "") * sortOrder;
    });

    const receivedList = revenues.filter((r) => !r.status || r.status.toLowerCase() === "received");
    const cancelledList = revenues.filter((r) => r.status && r.status.toLowerCase().includes("cancelled"));

    const totalGross = receivedList.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalNet = receivedList.reduce((sum, r) => sum + (r.net_amount || r.amount || 0), 0);
    const totalCancelledAmount = cancelledList.reduce((sum, r) => sum + (r.amount || 0), 0);

    return NextResponse.json({
      success: true,
      revenues,
      totalGross: Math.round(totalGross * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      totalOrders: revenues.length,
      totalReceivedOrders: receivedList.length,
      totalCancelledOrders: cancelledList.length,
      totalCancelledAmount: Math.round(totalCancelledAmount * 100) / 100,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, product_name, amount, net_amount, payment_id, customer_email, notes } = body;

    const normalizedDate = normalizeDateToISO(date);
    if (!normalizedDate) {
      return NextResponse.json({ success: false, error: "Valid date is required" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: "Valid revenue amount is required" }, { status: 400 });
    }

    const result = await createRevenue({
      date: normalizedDate,
      product_name: product_name?.trim() || "Digital Product",
      amount: parsedAmount,
      net_amount: parseFloat(net_amount) || parsedAmount,
      payment_id: payment_id?.trim() || `MANUAL-${Date.now()}`,
      customer_email: customer_email?.trim() || "",
      status: "Received",
    });

    return NextResponse.json({
      success: true,
      revenue: result.item,
      sheetSynced: result.sheetSynced,
      warning: result.sheetSynced ? undefined : result.message,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
