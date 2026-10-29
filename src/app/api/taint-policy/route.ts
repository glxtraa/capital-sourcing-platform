import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrSeedTaintPolicies } from "@/lib/taint-policy";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assetClass = searchParams.get("assetClass") as "INVOICE" | "TRADE" | "VC" | null;
  const policies = await getOrSeedTaintPolicies(assetClass || undefined);
  return NextResponse.json({ policies });
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    // Case 1: Override taint on a specific uploaded document
    if (body.documentId && body.assetClass) {
      const taintOverride =
        body.taintOverride === "AUDITED_PROOF" || body.taintOverride === "UNVERIFIED_CLAIM"
          ? body.taintOverride
          : null;

      if (body.assetClass === "INVOICE") {
        const updated = await db.uploadedDocument.update({
          where: { id: body.documentId },
          data: { taintOverride },
        });
        return NextResponse.json({ document: updated });
      }
      if (body.assetClass === "TRADE") {
        const updated = await db.uploadedTradeDocument.update({
          where: { id: body.documentId },
          data: { taintOverride },
        });
        return NextResponse.json({ document: updated });
      }
      if (body.assetClass === "VC") {
        const updated = await db.uploadedStartupDocument.update({
          where: { id: body.documentId },
          data: { taintOverride },
        });
        return NextResponse.json({ document: updated });
      }
    }

    // Case 2: Update or add a taxonomy code's defaultTaint in DocumentTaintPolicy
    const { assetClass, taxonomyCode, label, defaultTaint, updatedBy } = body;
    if (!assetClass || !taxonomyCode || !defaultTaint) {
      return NextResponse.json(
        { error: "assetClass, taxonomyCode, and defaultTaint are required" },
        { status: 400 },
      );
    }

    const cleanCode = String(taxonomyCode).trim().toUpperCase().replace(/\s+/g, "_");
    const cleanTaint =
      defaultTaint === "AUDITED_PROOF" ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM";

    const policy = await db.documentTaintPolicy.upsert({
      where: {
        assetClass_taxonomyCode: {
          assetClass,
          taxonomyCode: cleanCode,
        },
      },
      update: {
        defaultTaint: cleanTaint,
        ...(label ? { label } : {}),
        updatedBy: updatedBy || "Human Operator",
      },
      create: {
        assetClass,
        taxonomyCode: cleanCode,
        label: label || cleanCode.replaceAll("_", " "),
        defaultTaint: cleanTaint,
        updatedBy: updatedBy || "Human Operator",
      },
    });

    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update taint policy" },
      { status: 500 },
    );
  }
}
