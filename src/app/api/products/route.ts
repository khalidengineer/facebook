import { NextResponse } from "next/server";
import { fetchLiveSheetData, createProduct } from "@/lib/sheet-db";

export async function GET(request: Request) {
  try {
    const db = await fetchLiveSheetData();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase() || "";

    let products = [...db.products];

    if (search) {
      products = products.filter(
        (p) => p.name.toLowerCase().includes(search) || (p.category && p.category.toLowerCase().includes(search))
      );
    }

    products.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ success: true, products });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, selling_price, product_cost } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Product name is required" }, { status: 400 });
    }

    const result = await createProduct({
      name: name.trim(),
      category: category?.trim() || "Digital Notes",
      selling_price: parseFloat(selling_price) || 0,
      product_cost: parseFloat(product_cost) || 0,
    });

    return NextResponse.json({
      success: true,
      product: result.item,
      sheetSynced: result.sheetSynced,
      warning: result.sheetSynced ? undefined : result.message,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
