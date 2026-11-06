import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { TradeCorridorEnum } from "@prisma/client";

export async function GET() {
  const orgId = await getCurrentOrgId();
  const tradeDeals = await db.tradeDeal.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          documents: true,
          matches: true,
          contractLegs: true,
          parties: true,
        },
      },
      contractLegs: true,
      parties: true,
    },
  });
  return NextResponse.json(tradeDeals);
}

export async function POST(req: Request) {
  const orgId = await getCurrentOrgId();
  const body = await req.json();
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const corridor =
    body.corridor && Object.values(TradeCorridorEnum).includes(body.corridor)
      ? body.corridor
      : TradeCorridorEnum.OTHER_CROSS_BORDER;

  const tradeDeal = await db.tradeDeal.create({
    data: {
      orgId,
      name: body.name.trim(),
      corridor,
    },
  });

  return NextResponse.json(tradeDeal, { status: 201 });
}
