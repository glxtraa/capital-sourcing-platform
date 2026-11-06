import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { StartupInvestorType, StartupStage, StartupSector } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const stage = searchParams.get("stage");
  const sector = searchParams.get("sector");

  const where: Record<string, any> = {};

  if (type && Object.values(StartupInvestorType).includes(type as StartupInvestorType)) {
    where.type = type;
  }

  if (stage && Object.values(StartupStage).includes(stage as StartupStage)) {
    where.targetStages = { has: stage as StartupStage };
  }

  if (sector && Object.values(StartupSector).includes(sector as StartupSector)) {
    where.preferredSectors = { has: sector as StartupSector };
  }

  const investors = await db.startupInvestor.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      documentsRequired: true,
      _count: {
        select: {
          matches: true,
        },
      },
    },
  });

  return NextResponse.json(investors);
}
