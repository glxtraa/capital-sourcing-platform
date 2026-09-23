import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";

/**
 * Kicks off extraction once the client has finished uploading and
 * registering every file for this deal (see documents/route.ts). Split
 * out from the upload/registration routes so the client controls exactly
 * when the batch is "done" rather than the server guessing after each
 * individual file.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) return NextResponse.json({ error: "deal not found" }, { status: 404 });

  await inngest.send({ name: "deal/documents.uploaded", data: { dealId } });
  return NextResponse.json({ ok: true });
}
