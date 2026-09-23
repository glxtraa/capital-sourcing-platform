import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadDealDocument } from "@/lib/blob";
import { inngest } from "@/inngest/client";

/**
 * Accepts multipart/form-data with one or more `files` fields. Stores each
 * to Vercel Blob, records an UploadedDocument row, and — once at least one
 * file is uploaded — fires `deal/documents.uploaded`, which kicks off the
 * extraction step (see src/inngest/functions/extract-deal.ts). The caller
 * (the UI) doesn't wait for extraction to finish; it polls/subscribes to
 * deal status instead (see the deal detail page).
 */
export async function POST(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no files provided" }, { status: 400 });
  }

  const created = await Promise.all(
    files.map(async (file) => {
      const { url, sizeBytes } = await uploadDealDocument(dealId, file.name, file);
      return db.uploadedDocument.create({
        data: {
          dealId,
          fileName: file.name,
          blobUrl: url,
          mimeType: file.type || "application/octet-stream",
          sizeBytes,
        },
      });
    }),
  );

  await inngest.send({ name: "deal/documents.uploaded", data: { dealId } });

  return NextResponse.json(created, { status: 201 });
}
