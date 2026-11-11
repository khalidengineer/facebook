import { NextResponse } from "next/server";
import { deleteRevenue } from "@/lib/sheet-db";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const success = await deleteRevenue(id);
    if (!success) {
      return NextResponse.json({ success: false, error: "Revenue record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
