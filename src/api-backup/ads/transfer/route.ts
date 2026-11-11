import { NextResponse } from "next/server";
import { normalizeDateToISO } from "@/lib/date-utils";
import { transferAdExpenseAmount } from "@/lib/sheet-db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, transferAmount, targetDate, targetCampaign, targetProduct, notes } = body;

    if (!sourceId) {
      return NextResponse.json({ success: false, error: "Source expense ID is required" }, { status: 400 });
    }

    const parsedAmount = parseFloat(transferAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: "Valid transfer amount is required" }, { status: 400 });
    }

    const normalizedTargetDate = normalizeDateToISO(targetDate);
    if (!normalizedTargetDate) {
      return NextResponse.json({ success: false, error: "Valid target date is required (YYYY-MM-DD)" }, { status: 400 });
    }

    const result = await transferAdExpenseAmount({
      sourceId: String(sourceId),
      transferAmount: parsedAmount,
      targetDate: normalizedTargetDate,
      targetCampaign: targetCampaign?.trim(),
      targetProduct: targetProduct !== undefined ? targetProduct.trim() : undefined,
      notes: notes?.trim(),
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sourceExpense: result.sourceExpense,
      targetExpense: result.targetExpense,
      message: `Successfully transferred ₹${parsedAmount} to ${normalizedTargetDate}. Original expense updated.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
