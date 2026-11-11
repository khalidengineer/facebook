import { NextResponse } from "next/server";
import { normalizeDateToISO } from "@/lib/date-utils";
import { updateAdExpense, deleteAdExpense } from "@/lib/sheet-db";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { date, campaign_name, product_name, campaign_type, amount, notes } = body;

    const normalizedDate = normalizeDateToISO(date);
    if (!normalizedDate) {
      return NextResponse.json({ success: false, error: "Valid date is required" }, { status: 400 });
    }

    const updated = await updateAdExpense(id, {
      date: normalizedDate,
      campaign_name: campaign_name?.trim(),
      product_name: product_name?.trim(),
      campaign_type: campaign_type?.trim(),
      amount: parseFloat(amount) || 0,
      notes: notes?.trim(),
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Ad expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, expense: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const success = await deleteAdExpense(id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Ad expense not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
