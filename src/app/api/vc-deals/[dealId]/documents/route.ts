import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.startupDeal.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });

  const body = await req.json();
  const { fileName, blobUrl, mimeType, sizeBytes, documentTypes } = body ?? {};
  if (!fileName || !blobUrl) {
    return NextResponse.json({ error: "fileName and blobUrl are required" }, { status: 400 });
  }

  const document = await db.uploadedStartupDocument.create({
    data: {
      dealId,
      fileName,
      blobUrl,
      mimeType: mimeType || "application/octet-stream",
      sizeBytes: typeof sizeBytes === "number" ? sizeBytes : 0,
      documentTypes: Array.isArray(documentTypes) ? documentTypes : [],
    },
  });

  return NextResponse.json(document, { status: 201 });
}
