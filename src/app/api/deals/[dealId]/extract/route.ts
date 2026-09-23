import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mergeExtractions } from "@/agents/merge";
import { DocumentExtractionSchema, type DocumentExtraction } from "@/dsl/schema";

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

  try {
    const extractions: DocumentExtraction[] = documents.map((doc) => {
      const extraction = DocumentExtractionSchema.parse(doc.extractedFieldsRaw);
      return {
        ...extraction,
        parties: extraction.parties.map((p) => ({ ...p, sourceDocuments: [doc.fileName] })),
      };
    });

    const merged = mergeExtractions(extractions);

    // Fields are mapped explicitly rather than spread: the Zod DSL carries
    // fields the Prisma models have no column for (e.g. FinancingAsk's
    // structureTypeConfidence, Party's sourceDocuments), and spreading one
    // into createMany throws "Unknown argument" -- which stayed hidden until
    // a document yielded its first financing ask, since pure sale/purchase
    // contracts produce none and createMany([]) never validates a field.
    await db.$transaction([
      db.party.deleteMany({ where: { dealId } }),
      db.financingAsk.deleteMany({ where: { dealId } }),
      db.riskFlag.deleteMany({ where: { dealId } }),
      db.party.createMany({
        data: merged.parties.map((p) => ({
          dealId,
          role: p.role,
          legalName: p.legalName,
          jurisdiction: p.jurisdiction,
          isListed: p.isListed,
          publicRating: p.publicRating,
          bankName: p.bankName,
          bankAccount: p.bankAccount,
          notes: p.notes,
          primaryRightHolderName: p.primaryRightHolderName,
          primaryRightHolderVerified: p.primaryRightHolderVerified,
        })),
      }),
      db.financingAsk.createMany({
        data: merged.financingAsks.map((a) => ({
          dealId,
          structureType: a.structureType,
          amount: a.amount,
          currency: a.currency,
          advanceRatePct: a.advanceRatePct,
          tenorDaysMin: a.tenorDaysMin,
          tenorDaysMax: a.tenorDaysMax,
          tenorNote: a.tenorNote,
          recurring: a.recurring,
          recurringNote: a.recurringNote,
        })),
      }),
      db.riskFlag.createMany({
        data: merged.riskFlags.map((r) => ({
          dealId,
          category: r.category,
          severity: r.severity,
          description: r.description,
        })),
      }),
      db.deal.update({
        where: { id: dealId },
        data: {
          status: merged.readyForMatching ? "READY" : "NEEDS_REVIEW",
          reviewerNotes: merged.openQuestions.join("\n"),
        },
      }),
    ]);

    return NextResponse.json({ dealId, readyForMatching: merged.readyForMatching });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to finalize the deal spec: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
