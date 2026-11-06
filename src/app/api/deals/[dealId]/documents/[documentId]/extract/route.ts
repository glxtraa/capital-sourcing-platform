import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { extractFromDocument } from "@/agents/extraction-agent";
import { mergeSingleDocumentExtractions } from "@/agents/merge";
import { DocumentExtractionSchema, type DocumentExtraction } from "@/dsl/schema";
import { downloadBlobBuffer } from "@/lib/blob";

export interface DocumentExtractionHistoryEntry {
  runNumber: number;
  extractedAt: string;
  extraction: DocumentExtraction;
}

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
 * When re-run on a document that was already extracted, this merges the new
 * extraction with all previously extracted datapoints (never losing previously
 * found parties, fields, asks, or flags) and appends a full snapshot to
 * `_history` + `ResearchRun`.
 */
export const maxDuration = 300;

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

  const startedAt = new Date();

  try {
    const buffer = await downloadBlobBuffer(doc.blobUrl);
    const freshExtraction = await extractFromDocument(buffer, doc.mimeType, doc.fileName);

    // Parse existing extraction & history if this document was extracted before
    const existingRawObj =
      doc.extractedFieldsRaw && typeof doc.extractedFieldsRaw === "object" && !Array.isArray(doc.extractedFieldsRaw)
        ? (doc.extractedFieldsRaw as Record<string, unknown>)
        : null;

    const prevParsed = existingRawObj ? DocumentExtractionSchema.safeParse(existingRawObj) : null;
    const previousHistory: DocumentExtractionHistoryEntry[] = Array.isArray(existingRawObj?._history)
      ? (existingRawObj._history as DocumentExtractionHistoryEntry[])
      : prevParsed?.success
        ? [
            {
              runNumber: 1,
              extractedAt: doc.uploadedAt.toISOString(),
              extraction: prevParsed.data,
            },
          ]
        : [];

    const runNumber = previousHistory.length + 1;
    const mergedExtraction = prevParsed?.success
      ? mergeSingleDocumentExtractions(prevParsed.data, freshExtraction)
      : freshExtraction;

    const updatedHistory: DocumentExtractionHistoryEntry[] = [
      ...previousHistory,
      {
        runNumber,
        extractedAt: new Date().toISOString(),
        extraction: freshExtraction,
      },
    ];

    const storedPayload = {
      ...mergedExtraction,
      _history: updatedHistory,
    } as unknown as Prisma.InputJsonValue;

    const summaryText =
      `Run #${runNumber} on "${doc.fileName}": extracted ${freshExtraction.parties.length} part${freshExtraction.parties.length === 1 ? "y" : "ies"}, ` +
      `${freshExtraction.financingAsks.length} ask(s), ${freshExtraction.riskFlags.length} risk flag(s), ` +
      `types [${freshExtraction.documentTypes.join(", ") || "none"}].` +
      (runNumber > 1
        ? ` Merged cumulative total for file: ${mergedExtraction.parties.length} part${mergedExtraction.parties.length === 1 ? "y" : "ies"}, ${mergedExtraction.financingAsks.length} ask(s), ${mergedExtraction.riskFlags.length} risk flag(s).`
        : "");

    await db.$transaction([
      db.uploadedDocument.update({
        where: { id: doc.id },
        data: {
          extractedFieldsRaw: storedPayload,
          documentTypes: mergedExtraction.documentTypes,
        },
      }),
      db.researchRun.create({
        data: {
          dealId,
          kind: "EXTRACTION",
          status: "SUCCEEDED",
          triggeredBy: runNumber > 1 ? `user:re-extract-run-${runNumber}` : "user:initial-extract",
          inputSummary: doc.fileName,
          outputSummary: summaryText,
          startedAt,
          finishedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      documentId,
      fileName: doc.fileName,
      runNumber,
      ok: true,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await db.researchRun
      .create({
        data: {
          dealId,
          kind: "EXTRACTION",
          status: "FAILED",
          triggeredBy: "user",
          inputSummary: doc.fileName,
          outputSummary: `Extraction failed for "${doc.fileName}": ${errMsg}`,
          startedAt,
          finishedAt: new Date(),
        },
      })
      .catch(() => {});

    return NextResponse.json(
      {
        error: `Extraction failed for "${doc.fileName}": ${errMsg}`,
      },
      { status: 500 },
    );
  }
}
