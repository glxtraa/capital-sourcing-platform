import { NextResponse } from "next/server";
import { z } from "zod";
import { createBatch } from "@/lib/research-runner";

export const maxDuration = 60;

const BodySchema = z.object({
  mode: z.enum(["all", "stale", "selected"]),
  providerIds: z.array(z.string()).optional(),
  includeDiscovery: z.boolean().default(false),
});

/** Create a research batch (queues tasks only -- no model calls happen here). */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const created = await createBatch({ ...parsed.data, triggeredBy: "user" });
  if (!created) return NextResponse.json({ error: "Nothing to research -- every provider was researched in the last 30 days." }, { status: 409 });
  return NextResponse.json(created);
}
