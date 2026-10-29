import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { deleteDealDocument } from "@/lib/blob";

export async function GET(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: { orderBy: { uploadedAt: "asc" } },
      founders: true,
      capTable: true,
      financingAsks: true,
      riskFlags: { orderBy: { severity: "desc" } },
      competitors: { orderBy: { createdAt: "asc" } },
      commercialProspects: {
        include: {
          contacts: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      matches: {
        include: {
          investor: {
            include: { documentsRequired: true },
          },
        },
        orderBy: [{ isLeadCandidate: "desc" }, { thesisResonanceScore: "desc" }],
      },
      syndicateBlueprints: { orderBy: { createdAt: "desc" }, take: 1 },
      researchRuns: { orderBy: { startedAt: "desc" } },
    },
  });

  if (!deal) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(deal);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const orgId = await getCurrentOrgId();

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: { documents: true },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  if (deal.orgId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (deal.documents.length > 0) {
    await Promise.allSettled(
      deal.documents.map((doc) => {
        if (!doc.blobUrl || doc.blobUrl.startsWith("http://docs.google.com") || doc.blobUrl.startsWith("https://docs.google.com")) {
          return Promise.resolve();
        }
        return deleteDealDocument(doc.blobUrl).catch((err) => {
          console.warn(`Failed to delete blob for doc ${doc.id} (${doc.blobUrl}):`, err);
        });
      })
    );
  }

  await db.startupDeal.delete({
    where: { id: dealId },
  });

  return NextResponse.json({ ok: true, deletedId: dealId });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const orgId = await getCurrentOrgId();

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      founders: true,
      capTable: true,
      financingAsks: true,
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  if (deal.orgId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();

  const {
    companyName,
    legalEntityJurisdiction,
    stage,
    primaryVertical,
    targetRaiseUsd,
    valuationCapUsd,
    instrumentType,
    plannedRunwayMonths,
    leadCommitted,
    foundersOwnershipPct,
    investorOwnershipPct,
    optionPoolPct,
    safesNotesOutstandingUsd,
    safeHolders,
    commonHolders,
    hasDeadEquity,
    founders,
  } = body;

  await db.$transaction(async (tx) => {
    // 1. Update core deal metadata including jurisdiction
    await tx.startupDeal.update({
      where: { id: dealId },
      data: {
        ...(companyName ? { companyName: String(companyName).trim() } : {}),
        ...(legalEntityJurisdiction !== undefined ? { legalEntityJurisdiction: legalEntityJurisdiction ? String(legalEntityJurisdiction).trim() : null } : {}),
        ...(stage ? { stage } : {}),
        ...(primaryVertical ? { primaryVertical } : {}),
      },
    });

    // 2. Update financing ask
    if (deal.financingAsks.length > 0) {
      await tx.startupFinancingAsk.update({
        where: { id: deal.financingAsks[0].id },
        data: {
          ...(targetRaiseUsd !== undefined ? { targetRaiseUsd: targetRaiseUsd != null ? Number(targetRaiseUsd) : null } : {}),
          ...(valuationCapUsd !== undefined ? { valuationCapUsd: valuationCapUsd ? Number(valuationCapUsd) : null } : {}),
          ...(instrumentType !== undefined ? { instrumentType: instrumentType || null } : {}),
          ...(plannedRunwayMonths !== undefined ? { plannedRunwayMonths: plannedRunwayMonths != null ? Number(plannedRunwayMonths) : null } : {}),
          ...(typeof leadCommitted === "boolean" ? { leadCommitted } : {}),
        },
      });
    }

    // 3. Update cap table
    if (deal.capTable) {
      await tx.startupCapTable.update({
        where: { id: deal.capTable.id },
        data: {
          ...(foundersOwnershipPct !== undefined ? { foundersOwnershipPct: foundersOwnershipPct != null ? Number(foundersOwnershipPct) : null } : {}),
          ...(investorOwnershipPct !== undefined ? { investorOwnershipPct: investorOwnershipPct != null ? Number(investorOwnershipPct) : null } : {}),
          ...(optionPoolPct !== undefined ? { optionPoolPct: optionPoolPct != null ? Number(optionPoolPct) : null } : {}),
          ...(typeof safesNotesOutstandingUsd === "number" ? { safesNotesOutstandingUsd } : {}),
          ...(safeHolders !== undefined ? { safeHoldersJson: safeHolders } : {}),
          ...(commonHolders !== undefined ? { commonHoldersJson: commonHolders } : {}),
          ...(typeof hasDeadEquity === "boolean" ? { hasDeadEquity } : {}),
        },
      });
    }

    // 4. Update founders if provided
    if (Array.isArray(founders)) {
      await tx.startupFounder.deleteMany({ where: { dealId } });
      await tx.startupFounder.createMany({
        data: founders.map((f: any) => ({
          dealId,
          name: f.name || "Founder",
          role: f.role || "Founder",
          equityOwnershipPct: typeof f.equityOwnershipPct === "number" ? f.equityOwnershipPct : 0,
          isTechnical: Boolean(f.isTechnical),
          isRepeatFounder: Boolean(f.isRepeatFounder),
          vestingConfirmed: f.vestingConfirmed ?? true,
          priorExits: Array.isArray(f.priorExits) ? f.priorExits : [],
        })),
      });
    }
  });

  // Re-run matching automatically so rankings reflect the user's edits
  try {
    const updatedDeal = await db.startupDeal.findUnique({
      where: { id: dealId },
      include: {
        documents: true,
        founders: true,
        capTable: true,
        financingAsks: true,
      },
    });

    if (updatedDeal) {
      const { matchStartupDeal } = await import("@/lib/vc-matching");
      const { reconcileStartupExtractions } = await import("@/agents/vc/vc-reconciliation");
      const extractions = updatedDeal.documents.map((d) => d.extractedRaw).filter(Boolean) as any[];
      const recon = reconcileStartupExtractions(dealId, updatedDeal.companyName, extractions);
      if (recon.startupDealSpec) {
        const investors = await db.startupInvestor.findMany({ include: { documentsRequired: true } });
        const matchResult = matchStartupDeal(recon.startupDealSpec, investors, updatedDeal.documents);

        const allCandidates = [
          ...matchResult.leadCandidates,
          ...matchResult.coInvestorCandidates,
          ...matchResult.angelCandidates,
          ...matchResult.acceleratorOptions,
        ];
        const unique = Array.from(new Map(allCandidates.map((c) => [c.investorId, c])).values());

        await db.$transaction(async (tx) => {
          await tx.startupInvestorMatch.deleteMany({ where: { dealId } });
          await tx.startupInvestorMatch.createMany({
            data: unique.map((c) => ({
              dealId,
              investorId: c.investorId,
              tier: c.tier,
              verdict: c.verdict,
              rationale: c.rationale,
              isLeadCandidate: c.isLeadCandidate,
              thesisResonanceScore: c.thesisResonanceScore,
              portfolioConflictDetected: c.portfolioConflictDetected,
            })),
          });
        });
      }
    }
  } catch (err) {
    console.warn("Notice: auto-match refresh on deal edit:", err);
  }

  const finalDeal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      documents: true,
      founders: true,
      capTable: true,
      financingAsks: true,
      riskFlags: true,
      matches: { include: { investor: true } },
    },
  });

  return NextResponse.json(finalDeal);
}
