import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dealId: string; documentId: string }> },
) {
  const { dealId, documentId } = await params;
  const doc = await db.uploadedDocument.findUnique({
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

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal || deal.orgId !== orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const doc = await db.uploadedDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc || doc.dealId !== dealId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const body = await req.json();
  const { extractedFieldsRaw, documentTypes, fileName } = body;

  const updatedDoc = await db.uploadedDocument.update({
    where: { id: documentId },
    data: {
      ...(extractedFieldsRaw !== undefined ? { extractedFieldsRaw } : {}),
      ...(Array.isArray(documentTypes) ? { documentTypes } : {}),
      ...(fileName ? { fileName: String(fileName).trim() } : {}),
    },
  });

  return NextResponse.json(updatedDoc);
}
