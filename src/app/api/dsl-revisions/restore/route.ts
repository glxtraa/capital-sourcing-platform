import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { applyDslPayloadToDealRecord } from "../route";

export const dynamic = "force-dynamic";

/**
 * POST /api/dsl-revisions/restore
 * Restores a deal specification to an exact historical version, creates an auditable
 * ROLLBACK_RESTORE revision entry, and propagates the fields back to the deal database records.
 */
export async function POST(req: NextRequest) {
  try {
    const { revisionId } = await req.json();
    if (!revisionId) {
      return NextResponse.json({ error: "Missing required revisionId" }, { status: 400 });
    }

    const targetRevision = await db.dealDslRevision.findUnique({
      where: { id: revisionId },
    });

    if (!targetRevision) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }

    // Determine the next version number
    const latestRevision = await db.dealDslRevision.findFirst({
      where: { dealId: targetRevision.dealId, dslType: targetRevision.dslType },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const nextVersion = (latestRevision?.versionNumber ?? 0) + 1;

    // Mark previous revisions as not current
    await db.dealDslRevision.updateMany({
      where: { dealId: targetRevision.dealId, dslType: targetRevision.dslType, isCurrent: true },
      data: { isCurrent: false },
    });

    // Create the new restored revision
    const newRevision = await db.dealDslRevision.create({
      data: {
        assetClass: targetRevision.assetClass,
        dealId: targetRevision.dealId,
        tabKey: targetRevision.tabKey,
        dslType: targetRevision.dslType,
        versionNumber: nextVersion,
        label: `v${nextVersion} (Restored from v${targetRevision.versionNumber})`,
        authorType: "ROLLBACK_RESTORE",
        authorNote: `Restored exact state from version v${targetRevision.versionNumber} ("${targetRevision.label}")`,
        payloadJson: targetRevision.payloadJson as any,
        diffSummary: `Rolled back to snapshot from ${targetRevision.createdAt.toLocaleString()}`,
        isCurrent: true,
      },
    });

    // Apply the restored state back into the relational deal database tables
    await applyDslPayloadToDealRecord(
      targetRevision.assetClass,
      targetRevision.dealId,
      targetRevision.dslType,
      targetRevision.payloadJson as Record<string, unknown>
    );

    return NextResponse.json({ ok: true, revision: newRevision });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
