import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { extractFromDocument } from "@/agents/extraction-agent";
import { mergeExtractions } from "@/agents/merge";
import type { DocumentExtraction } from "@/dsl/schema";

/**
 * Step 1 of the pipeline — the productionized `deal-intake` skill's
 * "Step 0/Step 1" (classify + read the data room), run per-document in
 * parallel and then merged.
 */
export const extractDeal = inngest.createFunction(
  { id: "extract-deal", retries: 2 },
  { event: "deal/documents.uploaded" },
  async ({ event, step }) => {
    const { dealId } = event.data;

    const documents = await step.run("load-documents", async () => {
      return db.uploadedDocument.findMany({ where: { dealId } });
    });

    if (documents.length === 0) {
      throw new Error(`Deal ${dealId} has no uploaded documents to extract.`);
    }

    await step.run("mark-extracting", () =>
      db.deal.update({ where: { id: dealId }, data: { status: "EXTRACTING" } }),
    );

    // One durable step per document — if one fails, Inngest retries just
    // that step, not the whole batch, and a slow/large PDF doesn't block
    // the others from starting.
    const extractions: DocumentExtraction[] = await Promise.all(
      documents.map((doc) =>
        step.run(`extract-${doc.id}`, async () => {
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
      ),
    );

    const merged = await step.run("merge-and-write", async () => {
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

      return merged;
    });

    await step.sendEvent("notify-extraction-complete", {
      name: "deal/extraction.completed",
      data: { dealId, readyForMatching: merged.readyForMatching },
    });

    // Auto-advance to matching only when extraction was confident enough —
    // otherwise a human reviews the NEEDS_REVIEW deal in the UI and
    // triggers matching manually once satisfied (see
    // src/app/api/deals/[dealId]/match/route.ts).
    if (merged.readyForMatching) {
      await step.sendEvent("auto-trigger-matching", {
        name: "deal/matching.requested",
        data: { dealId },
      });
    }

    return { dealId, readyForMatching: merged.readyForMatching };
  },
);
