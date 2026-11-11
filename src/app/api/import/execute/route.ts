import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { executeCosmofeedImport } from "@/lib/csv-importer";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let csvContent = "";
    let filename = "uploaded.csv";
    let skipDuplicates = true;
    let onlyReceived = false;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const useSample = formData.get("useSample") === "true";
      skipDuplicates = formData.get("skipDuplicates") !== "false";
      onlyReceived = formData.get("onlyReceived") === "true";

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
      skipDuplicates = body.skipDuplicates !== false;
      onlyReceived = body.onlyReceived === true;

      if (body.useSampleFile) {
        const samplePath = path.join(process.cwd(), "data.csv");
        csvContent = fs.readFileSync(samplePath, "utf8");
        filename = "data.csv";
      } else if (body.csvContent) {
        csvContent = body.csvContent;
        filename = body.filename || "import.csv";
      }
    }

    if (!csvContent || !csvContent.trim()) {
      return NextResponse.json({ success: false, error: "No CSV content to import" }, { status: 400 });
    }

    const result = await executeCosmofeedImport(csvContent, {
      filename,
      skipDuplicates,
      onlyReceived,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Execute import error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
