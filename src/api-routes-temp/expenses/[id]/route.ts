import { NextResponse } from "next/server";
import { normalizeDateToISO } from "@/lib/date-utils";
import { updateOtherExpense, deleteOtherExpense } from "@/lib/sheet-db";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { date, category, description, amount, notes } = body;

    const normalizedDate = normalizeDateToISO(date);
    if (!normalizedDate) {
      return NextResponse.json({ success: false, error: "Valid date is required" }, { status: 400 });
    }

    const updated = await updateOtherExpense(id, {
      date: normalizedDate,
      category: category?.trim() || "Miscellaneous",
      description: description?.trim() || "",
      amount: parseFloat(amount) || 0,
      notes: notes?.trim() || "",
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, expense: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const success = await deleteOtherExpense(id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
