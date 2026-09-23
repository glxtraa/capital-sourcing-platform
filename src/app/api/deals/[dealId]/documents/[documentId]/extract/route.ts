import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractFromDocument } from "@/agents/extraction-agent";

/**
 * Extracts ONE document only. Split out from the deal-level extract route
 * specifically because Vercel's Hobby plan hard-caps a serverless function
 * at 60s regardless of the `maxDuration` a route declares -- a single
 * request that ran OCR + an LLM call over every uploaded document at once
 * (via Promise.all) could exceed that ceiling on a real multi-document,
 * heavily-scanned deal, get killed mid-request, and leave the deal stuck in
 * EXTRACTING forever (its own status update never got to run). One document
 * per request gives each individual OCR+LLM call the best realistic chance
 * of finishing inside 60s; the caller (UploadDropzone / DealActions) is
 * responsible for calling this once per document, in sequence, then calling
 * POST /api/deals/:dealId/extract to merge the results -- that route no
 * longer does any LLM work itself, only a fast DB merge, so it can't time
 * out the same way.
 *
 * Idempotent and safe to re-run on just this one document if it fails.
 */
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string; documentId: string }> },
) {
  const { dealId, documentId } = await params;

  const doc = await db.uploadedDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.dealId !== dealId) {
    return NextResponse.json({ error: "document not found on this deal" }, { status: 404 });
  }

  await db.deal.update({ where: { id: dealId }, data: { status: "EXTRACTING" } });

  try {
    const res = await fetch(doc.blobUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const extraction = await extractFromDocument(buffer, doc.mimeType, doc.fileName);
    await db.uploadedDocument.update({
      where: { id: doc.id },
      data: { extractedFieldsRaw: extraction, documentTypes: extraction.documentTypes },
    });
    return NextResponse.json({ documentId, fileName: doc.fileName, ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          `Extraction failed for "${doc.fileName}": ` +
          (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 },
    );
  }
}
