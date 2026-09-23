import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Registers ONE already-uploaded file's metadata after the browser has
 * finished putting it directly into Vercel Blob (see
 * .../upload/route.ts for why the file itself never passes through a
 * server function). Body is small JSON, never file bytes.
 */
export async function POST(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  const body = await req.json();
  const { fileName, blobUrl, mimeType, sizeBytes } = body ?? {};
  if (!fileName || !blobUrl) {
    return NextResponse.json({ error: "fileName and blobUrl are required" }, { status: 400 });
  }

  const document = await db.uploadedDocument.create({
    data: {
      dealId,
      fileName,
      blobUrl,
      mimeType: mimeType || "application/octet-stream",
      sizeBytes: typeof sizeBytes === "number" ? sizeBytes : 0,
    },
  });

  return NextResponse.json(document, { status: 201 });
}
