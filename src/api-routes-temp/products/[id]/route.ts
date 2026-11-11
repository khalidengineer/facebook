import { NextResponse } from "next/server";
import { fetchLiveSheetData, updateProduct, deleteProduct } from "@/lib/sheet-db";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = await fetchLiveSheetData();

    const product = db.products.find((p) => p.id === id || p.name === id || String(p.row_number) === id);
    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    const pName = product.name.toLowerCase();

    const ads = db.facebookAds.filter((a) => a.product_name && a.product_name.toLowerCase() === pName);
    const totalAds = ads.reduce((sum, a) => sum + (a.amount || 0), 0);

    const revs = db.revenues.filter(
      (r) => r.product_name && r.product_name.toLowerCase() === pName && (!r.status || r.status.toLowerCase() === "received")
    );
    const totalRevenue = revs.reduce((sum, r) => sum + (r.amount || 0), 0);
    const netRevenue = revs.reduce((sum, r) => sum + (r.net_amount || r.amount || 0), 0);
    const totalOrders = revs.length;
    const totalCost = product.product_cost * totalOrders;

    const netProfit = Math.round((netRevenue - totalAds - totalCost) * 100) / 100;
    const roas = totalAds > 0 ? Math.round((totalRevenue / totalAds) * 100) / 100 : 0;
    const margin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0;

    return NextResponse.json({
      success: true,
      product,
      stats: {
        totalAds,
        adCount: ads.length,
        totalRevenue,
        netRevenue,
        totalOrders,
        totalCost,
        totalOther: 0,
        netProfit,
        roas,
        margin,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, category, selling_price, product_cost } = body;

    const updated = await updateProduct(id, {
      name: name?.trim(),
      category: category?.trim(),
      selling_price: parseFloat(selling_price) || 0,
      product_cost: parseFloat(product_cost) || 0,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const success = await deleteProduct(id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
