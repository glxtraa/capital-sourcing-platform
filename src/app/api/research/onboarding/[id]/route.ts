import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({ action: z.enum(["accept", "reject"]) });
type Contact = { channel: string; value: string };

/**
 * Accept or reject an onboarding research result. Accepting supersedes the
 * provider's previously accepted result and fills ONLY empty Provider fields
 * (applicationUrl, contact, applicationProcess) -- it never overwrites one.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "action must be accept or reject" }, { status: 400 });

  const row = await db.providerOnboarding.findUnique({ where: { id }, include: { provider: true } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (parsed.data.action === "reject") {
    await db.providerOnboarding.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  const contacts = (row.contacts as Contact[]) ?? [];
  const contactText = contacts.filter((c) => c.channel !== "WEB_FORM").map((c) => c.value).join("; ");
  const fill: Record<string, string> = {};
  if (!row.provider.applicationUrl && row.applicationUrl) fill.applicationUrl = row.applicationUrl;
  if (!row.provider.contact && contactText) fill.contact = contactText;
  if (!row.provider.applicationProcess && row.steps.length) fill.applicationProcess = row.steps.join(" → ");

  await db.$transaction([
    db.providerOnboarding.updateMany({
      where: { providerId: row.providerId, status: "ACCEPTED", id: { not: id } },
      data: { status: "SUPERSEDED" },
    }),
    db.providerOnboarding.update({ where: { id }, data: { status: "ACCEPTED", reviewedAt: new Date() } }),
    ...(Object.keys(fill).length ? [db.provider.update({ where: { id: row.providerId }, data: fill })] : []),
  ]);
  return NextResponse.json({ ok: true, filledProviderFields: Object.keys(fill) });
}
