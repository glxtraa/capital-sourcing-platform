import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const providers = await db.provider.findMany({
    include: { documentsRequired: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(providers);
}
