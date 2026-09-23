import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";

export async function GET() {
  const orgId = await getCurrentOrgId();
  const deals = await db.deal.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { documents: true, providerMatches: true } } },
  });
  return NextResponse.json(deals);
}

export async function POST(req: Request) {
  const orgId = await getCurrentOrgId();
  const body = await req.json();
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const deal = await db.deal.create({ data: { orgId, name: body.name } });
  return NextResponse.json(deal, { status: 201 });
}
