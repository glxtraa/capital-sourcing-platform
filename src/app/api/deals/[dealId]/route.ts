import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
