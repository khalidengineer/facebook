import { NextResponse } from "next/server";
import { normalizeDateToISO } from "@/lib/date-utils";
import { fetchLiveSheetData, createOtherExpense } from "@/lib/sheet-db";

export async function GET(request: Request) {
  try {
    const db = await fetchLiveSheetData();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.toLowerCase();
    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;

    let expenses = [...db.otherExpenses];

    if (startDate) {
      expenses = expenses.filter((e) => e.date >= startDate);
    }
    if (endDate) {
      expenses = expenses.filter((e) => e.date <= endDate);
    }
    if (category && category !== "all") {
      expenses = expenses.filter((e) => e.category && e.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      expenses = expenses.filter(
        (e) =>
          (e.description && e.description.toLowerCase().includes(search)) ||
          (e.category && e.category.toLowerCase().includes(search)) ||
          (e.notes && e.notes.toLowerCase().includes(search))
      );
    }

    expenses.sort((a, b) => {
      if (sortBy === "amount") return (a.amount - b.amount) * sortOrder;
      if (sortBy === "category") return (a.category || "").localeCompare(b.category || "") * sortOrder;
      return (a.date || "").localeCompare(b.date || "") * sortOrder;
    });

    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const categories = Array.from(new Set(db.otherExpenses.map((e) => e.category).filter(Boolean))).sort();

    return NextResponse.json({
      success: true,
      expenses,
      totalAmount: Math.round(totalAmount * 100) / 100,
      count: expenses.length,
      categories,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, category, description, amount, notes } = body;

    const normalizedDate = normalizeDateToISO(date);
    if (!normalizedDate) {
      return NextResponse.json({ success: false, error: "Valid date is required" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ success: false, error: "Valid amount is required" }, { status: 400 });
    }

    const result = await createOtherExpense({
      date: normalizedDate,
      category: category?.trim() || "Miscellaneous",
      description: description?.trim() || "",
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
