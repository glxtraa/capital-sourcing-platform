import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ funderId: string }> }
) {
  const { funderId } = await params;

  const funder = await db.tradeFunder.findUnique({
    where: { id: funderId },
    select: {
      id: true,
      name: true,
      type: true,
      indicativePricingGuidance: true,
      rateEvidenceSnippet: true,
      pricingProvenance: true,
      deskContacts: true,
      sources: true,
      applicationUrl: true,
      contact: true,
      confidence: true,
      lastVerified: true,
    },
  });

  if (!funder) {
    return NextResponse.json({ error: `Trade funder "${funderId}" not found` }, { status: 404 });
  }

  const prov = funder.pricingProvenance as any;

  return NextResponse.json({
    funderId: funder.id,
    name: funder.name,
    type: funder.type,
    indicativePricingGuidance: funder.indicativePricingGuidance,
    evidenceSnippet: funder.rateEvidenceSnippet ?? prov?.evidenceSnippet ?? null,
    regulatoryFilingReference: prov?.regulatoryFilingReference ?? null,
    contextParagraph: prov?.contextParagraph ?? null,
    cachedSnapshotText: prov?.cachedSnapshotText ?? null,
    sourceDocumentOrUrl: prov?.sourceDocumentOrUrl ?? funder.sources[0] ?? null,
    archiveUrl: prov?.archiveUrl ?? null,
    spiderEngine: prov?.spiderEngine ?? "Tariff Spider",
    crawledAt: prov?.crawledAt ?? funder.lastVerified,
    cachedAt: prov?.cachedAt ?? funder.lastVerified,
    verificationNavigationGuide: prov?.verificationNavigationGuide ?? null,
    statutoryBenchmarkExplanation: prov?.statutoryBenchmarkExplanation ?? null,
    sources: funder.sources,
    deskContacts: funder.deskContacts,
  });
}
