import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mergeExtractions } from "@/agents/merge";
import type { DocumentExtraction } from "@/dsl/schema";

/**
 * Finalizes extraction for a deal: merges every document's already-stored
 * `extractedFieldsRaw` (written by POST .../documents/:documentId/extract,
 * one call per document) into the deal-level Party/FinancingAsk/RiskFlag
 * rows. Deliberately does NO LLM/OCR work itself -- that used to happen
 * here directly (via Promise.all over every document in one request), which
 * could exceed Vercel Hobby's 60s hard function-duration cap on a real
 * multi-document, heavily-scanned deal and leave the deal stuck in
 * EXTRACTING with no way to recover. Splitting per-document extraction into
 * its own route means THIS route only ever does a DB read + a deterministic
 * in-memory merge + a DB write, so it should never come close to timing out
 * on any plan.
 *
 * Returns 409 if any document hasn't been extracted yet -- the caller
 * (UploadDropzone / DealActions) is expected to have called the per-document
 * route for every document first.
 */
export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  const documents = await db.uploadedDocument.findMany({ where: { dealId } });
  if (documents.length === 0) {
    return NextResponse.json({ error: "no documents to extract" }, { status: 400 });
  }

  const unprocessed = documents.filter((d) => d.extractedFieldsRaw == null);
  if (unprocessed.length > 0) {
    return NextResponse.json(
      {
        error:
          `${unprocessed.length} document(s) still need extraction before this can be finalized: ` +
          unprocessed.map((d) => d.fileName).join(", "),
      },
      { status: 409 },
    );
  }

  const extractions: DocumentExtraction[] = documents.map((doc) => {
    const extraction = doc.extractedFieldsRaw as unknown as DocumentExtraction;
    return {
      ...extraction,
      parties: extraction.parties.map((p) => ({ ...p, sourceDocuments: [doc.fileName] })),
    };
  });

  const merged = mergeExtractions(extractions);

  await db.$transaction([
    db.party.deleteMany({ where: { dealId } }),
    db.financingAsk.deleteMany({ where: { dealId } }),
    db.riskFlag.deleteMany({ where: { dealId } }),
    db.party.createMany({
      data: merged.parties.map((p) => ({ ...p, dealId, sourceDocuments: undefined })),
    }),
    db.financingAsk.createMany({ data: merged.financingAsks.map((a) => ({ ...a, dealId })) }),
    db.riskFlag.createMany({ data: merged.riskFlags.map((r) => ({ ...r, dealId })) }),
    db.deal.update({
      where: { id: dealId },
      data: {
        status: merged.readyForMatching ? "READY" : "NEEDS_REVIEW",
        reviewerNotes: merged.openQuestions.join("\n"),
      },
    }),
  ]);

  return NextResponse.json({ dealId, readyForMatching: merged.readyForMatching });
}
