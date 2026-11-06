import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const maxDuration = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;

  const capTable = await db.startupCapTable.findUnique({
    where: { dealId },
  });

  const founders = await db.startupFounder.findMany({
    where: { dealId },
  });

  return NextResponse.json({
    capTable,
    founders,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params;
  const body = await req.json().catch(() => ({}));

  const {
    foundersOwnershipPct,
    investorOwnershipPct,
    optionPoolPct,
    safesNotesOutstandingUsd,
    safeHolders,
    commonHolders,
    hasDeadEquity,
    deadEquityNotes,
  } = body;

  const updated = await db.startupCapTable.upsert({
    where: { dealId },
    create: {
      dealId,
      foundersOwnershipPct: typeof foundersOwnershipPct === "number" ? foundersOwnershipPct : 80,
      investorOwnershipPct: typeof investorOwnershipPct === "number" ? investorOwnershipPct : 10,
      optionPoolPct: typeof optionPoolPct === "number" ? optionPoolPct : 10,
      safesNotesOutstandingUsd: typeof safesNotesOutstandingUsd === "number" ? safesNotesOutstandingUsd : 0,
      safeHoldersJson: safeHolders !== undefined ? safeHolders : [],
      commonHoldersJson: commonHolders !== undefined ? commonHolders : [],
      hasDeadEquity: Boolean(hasDeadEquity),
      deadEquityNotes: deadEquityNotes ?? null,
    },
    update: {
      ...(typeof foundersOwnershipPct === "number" ? { foundersOwnershipPct } : {}),
      ...(typeof investorOwnershipPct === "number" ? { investorOwnershipPct } : {}),
      ...(typeof optionPoolPct === "number" ? { optionPoolPct } : {}),
      ...(typeof safesNotesOutstandingUsd === "number" ? { safesNotesOutstandingUsd } : {}),
      ...(safeHolders !== undefined ? { safeHoldersJson: safeHolders } : {}),
      ...(commonHolders !== undefined ? { commonHoldersJson: commonHolders } : {}),
      ...(typeof hasDeadEquity === "boolean" ? { hasDeadEquity } : {}),
      ...(deadEquityNotes !== undefined ? { deadEquityNotes } : {}),
    },
  });

  return NextResponse.json({ ok: true, capTable: updated });
}
