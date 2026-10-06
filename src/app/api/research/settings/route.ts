import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, setSetting } from "@/lib/research-runner";

export async function GET() {
  return NextResponse.json({
    cronEnabled: (await getSetting("cronEnabled")) === "true",
    cronConfigured: !!process.env.CRON_SECRET,
    lastCronRun: await getSetting("lastCronRun"),
  });
}

export async function PUT(req: Request) {
  const parsed = z.object({ cronEnabled: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "cronEnabled must be a boolean" }, { status: 400 });
  await setSetting("cronEnabled", String(parsed.data.cronEnabled));
  return NextResponse.json({ cronEnabled: parsed.data.cronEnabled });
}
