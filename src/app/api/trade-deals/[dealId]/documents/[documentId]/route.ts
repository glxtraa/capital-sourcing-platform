import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dealId: string; documentId: string }> },
) {
  const { dealId, documentId } = await params;
  const doc = await db.uploadedTradeDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc || doc.dealId !== dealId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ dealId: string; documentId: string }> },
) {
  const { dealId, documentId } = await params;
  const orgId = await getCurrentOrgId();

  const deal = await db.tradeDeal.findUnique({ where: { id: dealId } });
  if (!deal || deal.orgId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const doc = await db.uploadedTradeDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc || doc.dealId !== dealId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const body = await req.json();
  const { extractedRaw, documentTypes, fileName, tradeLeg } = body;

  const updatedDoc = await db.uploadedTradeDocument.update({
    where: { id: documentId },
    data: {
      ...(extractedRaw !== undefined ? { extractedRaw } : {}),
      ...(Array.isArray(documentTypes) ? { documentTypes } : {}),
      ...(tradeLeg !== undefined ? { tradeLeg } : {}),
      ...(fileName ? { fileName: String(fileName).trim() } : {}),
    },
  });

  return NextResponse.json(updatedDoc);
}
