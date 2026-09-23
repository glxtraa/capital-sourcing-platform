import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractFromDocument } from "@/agents/extraction-agent";
import { mergeExtractions } from "@/agents/merge";
import type { DocumentExtraction } from "@/dsl/schema";

/**
 * Runs extraction directly and synchronously — no background job system.
 * This used to be an Inngest step function; that made sense for a
 * high-volume multi-tenant product needing durable per-step retries, but
 * for this app's actual scale (a handful of documents at a time) it was
 * mostly a source of operational friction (event/signing keys, dashboard
 * syncing that silently didn't happen) for no real benefit. A plain
 * `await` here is fully debuggable in ordinary Vercel function logs and
 * has no separate service to misconfigure.
 *
 * Trade-off, stated plainly: this ties up one serverless function for as
 * long as extraction takes (OCR + an LLM call per document, run in
 * parallel) rather than returning immediately. `maxDuration` below raises
 * the ceiling accordingly — check your Vercel plan's actual function
 * duration limit and adjust if extraction is timing out on a large batch.
 * If a request does time out, this route is safe to just call again: it
 * always re-reads every document for the deal and overwrites the merged
 * result, so nothing needs manual cleanup first.
 */
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  const documents = await db.uploadedDocument.findMany({ where: { dealId } });
  if (documents.length === 0) {
    return NextResponse.json({ error: "no documents to extract" }, { status: 400 });
  }

  await db.deal.update({ where: { id: dealId }, data: { status: "EXTRACTING" } });

  let extractions: DocumentExtraction[];
  try {
    extractions = await Promise.all(
      documents.map(async (doc) => {
        const res = await fetch(doc.blobUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        const extraction = await extractFromDocument(buffer, doc.mimeType, doc.fileName);
        await db.uploadedDocument.update({
          where: { id: doc.id },
          data: { extractedFieldsRaw: extraction },
        });
        return {
          ...extraction,
          parties: extraction.parties.map((p) => ({ ...p, sourceDocuments: [doc.fileName] })),
        };
      }),
    );
  } catch (error) {
    await db.deal.update({ where: { id: dealId }, data: { status: "NEEDS_REVIEW" } });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 },
    );
  }

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
