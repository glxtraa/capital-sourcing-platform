import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ dealId: string; flagId: string }> },
) {
  const { dealId, flagId } = await params;
  const body = await req.json().catch(() => ({}));

  const verificationStatus = body.verificationStatus as
    | "UNVERIFIED"
    | "HUMAN_VERIFIED_SAFE"
    | "WAIVED_WITH_NOTES"
    | "HUMAN_CONFIRMED_RISK"
    | undefined;

  const isResolved =
    verificationStatus === "HUMAN_VERIFIED_SAFE" ||
    verificationStatus === "WAIVED_WITH_NOTES" ||
    body.resolved === true;

  const updated = await db.tradeRiskFlag.update({
    where: { id: flagId, dealId },
    data: {
      ...(verificationStatus ? { verificationStatus } : {}),
      verifiedBy: body.verifiedBy ?? (verificationStatus ? "Analyst Review" : null),
      verifiedAt: verificationStatus && verificationStatus !== "UNVERIFIED" ? new Date() : null,
      verificationNotes: body.verificationNotes ?? null,
      resolved: isResolved,
    },
  });

  return NextResponse.json({ riskFlag: updated });
}
