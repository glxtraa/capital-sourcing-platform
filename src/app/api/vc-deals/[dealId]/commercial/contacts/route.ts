import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { researchProspectContacts } from "@/agents/vc/vc-contact-agent";

export const maxDuration = 180;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      companyName: true,
      stage: true,
      primaryVertical: true,
      industry: true,
      subIndustries: true,
      targetCustomerProfile: true,
      businessModel: true,
      legalEntityJurisdiction: true,
      commercialProspects: {
        include: {
          contacts: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  const allContacts = deal.commercialProspects.flatMap((p) =>
    p.contacts.map((c) => ({
      ...c,
      prospectName: p.name,
      prospectCategory: p.category,
      buyerPersona: p.buyerPersona,
    })),
  );

  const dslInput = {
    agentFlow: "PERSONA_CONTACT_DISCOVERY_AND_OUTREACH_V2",
    companyName: deal.companyName,
    stage: deal.stage,
    primaryVertical: deal.primaryVertical,
    industry: deal.industry,
    subIndustries: deal.subIndustries,
    targetCustomerProfile: deal.targetCustomerProfile,
    businessModel: deal.businessModel,
    jurisdiction: deal.legalEntityJurisdiction,
    targetedAccounts: deal.commercialProspects.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      buyerPersona: p.buyerPersona,
      existingContactsCount: p.contacts.length,
    })),
  };

  return NextResponse.json({
    dealId,
    dslInput,
    totalProspects: deal.commercialProspects.length,
    totalContacts: allContacts.length,
    contacts: allContacts,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const body = await req.json().catch(() => ({}));
  const { prospectId } = body || {};

  const deal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      commercialProspects: {
        include: { contacts: true },
      },
    },
  });

  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  if (deal.commercialProspects.length === 0) {
    return NextResponse.json(
      { error: "No commercial prospects found. Run commercial discovery first before finding contacts." },
      { status: 400 },
    );
  }

  // Filter targets: either the specific prospect, or all prospects
  const targets = prospectId
    ? deal.commercialProspects.filter((p) => p.id === prospectId)
    : deal.commercialProspects;

  if (targets.length === 0) {
    return NextResponse.json(
      { error: "Selected prospect not found for this deal." },
      { status: 404 },
    );
  }

  try {
    const researchResult = await researchProspectContacts({
      companyName: deal.companyName,
      primaryVertical: deal.primaryVertical,
      industryHint: deal.industry || undefined,
      subIndustries: deal.subIndustries,
      targetCustomerProfile: deal.targetCustomerProfile || undefined,
      businessModel: deal.businessModel || undefined,
      targets: targets.map((t) => ({
        id: t.id,
        name: t.name,
        websiteUrl: t.websiteUrl,
        category: t.category,
        buyerPersona: t.buyerPersona,
        useCaseFit: t.useCaseFit,
        strategicSynergy: t.strategicSynergy,
      })),
    });

    // Atomically persist contacts
    const insertedContacts: any[] = [];
    await db.$transaction(async (tx) => {
      for (const target of targets) {
        const found = researchResult.resultsByProspectId[target.id] || [];

        // Clear existing contacts for this prospect
        await tx.startupProspectContact.deleteMany({
          where: { prospectId: target.id },
        });

        // Insert newly discovered contacts
        if (found.length > 0) {
          for (const c of found) {
            const created = await tx.startupProspectContact.create({
              data: {
                prospectId: target.id,
                fullName: c.fullName,
                title: c.title,
                roleCategory: c.roleCategory,
                department: c.department ?? null,
                linkedinUrl: c.linkedinUrl ?? null,
                emailPattern: c.emailPattern ?? null,
                location: c.location ?? null,
                relevanceRationale: c.relevanceRationale ?? null,
                outreachAngle: c.outreachAngle ?? null,
                sourceUrl: c.sourceUrl ?? null,
                sourceVerified: c.sourceVerified,
                sourceHttpStatus: c.sourceHttpStatus ?? null,
                lastVerified: new Date(),
              },
            });
            insertedContacts.push(created);
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      dslInput: researchResult.dslInput,
      totalContactsFound: insertedContacts.length,
      auditSummary: researchResult.auditSummary,
      contacts: insertedContacts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Contact discovery failed: ${message}` },
      { status: 500 },
    );
  }
}
