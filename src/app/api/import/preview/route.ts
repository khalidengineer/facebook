import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { analyzeAndPreviewCSV } from "@/lib/csv-importer";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let csvContent = "";
    let filename = "uploaded.csv";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const useSample = formData.get("useSample") === "true";

      if (useSample) {
        const samplePath = path.join(process.cwd(), "data.csv");
        csvContent = fs.readFileSync(samplePath, "utf8");
        filename = "data.csv";
      } else if (file) {
        csvContent = await file.text();
        filename = file.name;
      }
    } else {
      const body = await request.json();
      if (body.useSampleFile) {
        const samplePath = path.join(process.cwd(), "data.csv");
        csvContent = fs.readFileSync(samplePath, "utf8");
        filename = "data.csv";
      } else if (body.csvContent) {
        csvContent = body.csvContent;
        filename = body.filename || "pasted.csv";
      }
    }

    if (!csvContent || !csvContent.trim()) {
      return NextResponse.json({ success: false, error: "No CSV content provided" }, { status: 400 });
    }

    const preview = await analyzeAndPreviewCSV(csvContent);

    return NextResponse.json({
      success: true,
      filename,
      preview,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
