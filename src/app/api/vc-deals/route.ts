import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { StartupStage, StartupSector, StartupInstrumentType } from "@prisma/client";

export async function GET() {
  const orgId = await getCurrentOrgId();
  const deals = await db.startupDeal.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          documents: true,
          matches: true,
          founders: true,
          financingAsks: true,
        },
      },
      founders: true,
      financingAsks: true,
      capTable: true,
    },
  });
  return NextResponse.json(deals);
}

export async function POST(req: Request) {
  const orgId = await getCurrentOrgId();
  const body = (await req.json().catch(() => ({}))) ?? {};

  let companyName = "Analyzing Startup Data Room...";
  if (typeof body?.companyName === "string" && body.companyName.trim()) {
    companyName = body.companyName.trim();
  } else if (typeof body?.firstFileName === "string" && body.firstFileName.trim()) {
    const cleaned = body.firstFileName
      .replace(/\.(pdf|xlsx|xls|csv|docx|doc|txt)$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b(pitch|deck|presentation|model|cap|table|projections|financials|v\d+|\d{4})\b/gi, "")
      .trim();
    if (cleaned.length > 1) {
      companyName = cleaned;
    }
  }

  const stage =
    body.stage && Object.values(StartupStage).includes(body.stage)
      ? body.stage
      : StartupStage.SEED;

  const primaryVertical =
    body.primaryVertical && Object.values(StartupSector).includes(body.primaryVertical)
      ? body.primaryVertical
      : StartupSector.B2B_SAAS;

  const legalEntityJurisdiction =
    typeof body.legalEntityJurisdiction === "string" && body.legalEntityJurisdiction.trim()
      ? body.legalEntityJurisdiction.trim()
      : "Delaware (US)";

  const targetRaiseUsd = typeof body.targetRaiseUsd === "number" && body.targetRaiseUsd > 0
    ? body.targetRaiseUsd
    : 1500000;

  const valuationCapUsd = typeof body.valuationCapUsd === "number" && body.valuationCapUsd > 0
    ? body.valuationCapUsd
    : null;

  const instrumentType =
    body.instrumentType && Object.values(StartupInstrumentType).includes(body.instrumentType)
      ? body.instrumentType
      : StartupInstrumentType.POST_MONEY_SAFE;

  const deal = await db.startupDeal.create({
    data: {
      orgId,
      companyName: body.companyName.trim(),
      stage,
      primaryVertical,
      legalEntityJurisdiction,
      financingAsks: {
        create: {
          targetRaiseUsd,
          instrumentType,
          valuationCapUsd,
          plannedRunwayMonths: typeof body.plannedRunwayMonths === "number" ? body.plannedRunwayMonths : 18,
        },
      },
      capTable: {
        create: {
          foundersOwnershipPct: 80,
          investorOwnershipPct: 10,
          optionPoolPct: 10,
          safesNotesOutstandingUsd: 0,
          hasDeadEquity: false,
        },
      },
    },
    include: {
      financingAsks: true,
      capTable: true,
      founders: true,
    },
  });

  return NextResponse.json(deal, { status: 201 });
}
