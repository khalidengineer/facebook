import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), "expense.db");
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ success: false, error: "Database file not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const dateStr = new Date().toISOString().substring(0, 10);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="expense_backup_${dateStr}.db"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const confirm = formData.get("confirm") === "true";

    if (!confirm) {
      return NextResponse.json({ success: false, error: "Restore must be explicitly confirmed." }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ success: false, error: "No backup database file provided." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate SQLite magic header: first 16 bytes must start with 'SQLite format 3\0'
    const header = buffer.subarray(0, 16).toString("utf8");
    if (!header.startsWith("SQLite format 3")) {
      return NextResponse.json(
        { success: false, error: "Invalid file format. The file is not a valid SQLite database." },
        { status: 400 }
      );
    }

    const dbPath = path.join(process.cwd(), "expense.db");

    // Automatically create a safety backup before restore
    if (fs.existsSync(dbPath)) {
      const safetyBackupPath = path.join(process.cwd(), `expense_safety_pre_restore_${Date.now()}.db`);
      fs.copyFileSync(dbPath, safetyBackupPath);
    }

    // Write restored database
    fs.writeFileSync(dbPath, buffer);

    return NextResponse.json({
      success: true,
      message: "Database restored successfully. Safety backup was saved.",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
