import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { deleteDealDocument } from "@/lib/blob";

export async function GET(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      parties: true,
      financingAsks: true,
      riskFlags: true,
      providerMatches: { include: { provider: true }, orderBy: { verdict: "asc" } },
      termSheets: { orderBy: { createdAt: "desc" }, take: 1 },
      researchRuns: { orderBy: { startedAt: "desc" } },
    },
  });
  if (!deal) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const orgId = await getCurrentOrgId();

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: { documents: true },
  });

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  if (deal.orgId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Best-effort cleanup of stored blobs in Vercel Blob
  if (deal.documents.length > 0) {
    await Promise.allSettled(
      deal.documents.map((doc) => {
        if (!doc.blobUrl) return Promise.resolve();
        return deleteDealDocument(doc.blobUrl).catch((err) => {
          console.warn(`Failed to delete blob for doc ${doc.id} (${doc.blobUrl}):`, err);
        });
      })
    );
  }

  // Cascading delete in Prisma cleans up parties, asks, flags, matches, runs, documents
  await db.deal.delete({
    where: { id: dealId },
  });

  return NextResponse.json({ ok: true, deletedId: dealId });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const orgId = await getCurrentOrgId();

  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      parties: true,
      financingAsks: true,
      documents: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  if (deal.orgId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { name, parties, financingAsks } = body;

  await db.$transaction(async (tx) => {
    // 1. Update deal name
    await tx.deal.update({
      where: { id: dealId },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
      },
    });

    // 2. Update parties
    if (Array.isArray(parties)) {
      await tx.party.deleteMany({ where: { dealId } });
      await tx.party.createMany({
        data: parties.map((p: any) => ({
          dealId,
          legalName: p.legalName || p.name || "Unknown Party",
          role: (p.role === "BORROWER" || p.role === "CLIENT"
            ? "BORROWER"
            : p.role === "SUPPLIER"
            ? "SUPPLIER"
            : p.role === "INTERMEDIARY"
            ? "INTERMEDIARY"
            : p.role === "GUARANTOR"
            ? "GUARANTOR"
            : "OBLIGOR") as any,
          jurisdiction: p.jurisdiction || null,
          publicRating: p.publicRating || null,
          isListed: typeof p.isListed === "boolean" ? p.isListed : null,
          primaryRightHolderName: p.primaryRightHolderName || null,
          primaryRightHolderVerified: Boolean(p.primaryRightHolderVerified),
          notes: p.notes || null,
        })),
      });
    }

    // 3. Update financing ask
    if (Array.isArray(financingAsks)) {
      await tx.financingAsk.deleteMany({ where: { dealId } });
      await tx.financingAsk.createMany({
        data: financingAsks.map((a: any) => ({
          dealId,
          structureType: a.structureType || "POST_SHIPMENT_RECEIVABLES_DISCOUNTING",
          amount: typeof a.amount === "number" ? a.amount : (a.amountUsd ?? 250000),
          currency: a.currency || "USD",
          advanceRatePct: typeof a.advanceRatePct === "number" ? a.advanceRatePct : 85,
          tenorDaysMax: typeof a.tenorDaysMax === "number" ? a.tenorDaysMax : (a.targetTenorDays ?? 60),
          tenorDaysMin: typeof a.tenorDaysMin === "number" ? a.tenorDaysMin : 30,
          tenorNote: a.tenorNote || null,
          recurring: Boolean(a.recurring),
        })),
      });
    }
  });

  // Re-run matching automatically
  try {
    const updatedDeal = await db.deal.findUnique({
      where: { id: dealId },
      include: {
        parties: true,
        financingAsks: true,
        documents: true,
      },
    });

    if (updatedDeal) {
      const { buildMatchInputs, matchAllProviders } = await import("@/lib/matching");
      const { dealInput, askInput } = buildMatchInputs(updatedDeal.parties, updatedDeal.financingAsks);
      const providers = await db.provider.findMany();
      const results = matchAllProviders(providers, dealInput, askInput);

      await db.$transaction([
        db.providerMatch.deleteMany({ where: { dealId } }),
        db.providerMatch.createMany({
          data: results.map((r) => ({
            dealId,
            providerId: r.providerId,
            verdict: r.eligibleOnPaper ? "POSSIBLE" : "EXCLUDED",
            rationale: r.reasons.join("; ") || "No disqualifying factors found.",
            isTier1: r.eligibleOnPaper,
          })),
        }),
      ]);
    }
  } catch (err) {
    console.warn("Notice: auto-match refresh on invoice deal edit:", err);
  }

  const finalDeal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      parties: true,
      financingAsks: true,
      documents: true,
      providerMatches: { include: { provider: true } },
    },
  });

  return NextResponse.json(finalDeal);
}

