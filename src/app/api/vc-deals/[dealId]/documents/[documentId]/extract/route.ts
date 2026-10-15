import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractFromVCDocument } from "@/agents/vc/vc-extraction-agent";
import { downloadBlobBuffer } from "@/lib/blob";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string; documentId: string }> },
) {
  const { dealId, documentId } = await params;

  const doc = await db.uploadedStartupDocument.findUnique({
    where: { id: documentId },
    include: { deal: true },
  });

  if (!doc || doc.dealId !== dealId) {
    return NextResponse.json({ error: "Startup document not found on deal" }, { status: 404 });
  }

  try {
    const buffer = await downloadBlobBuffer(doc.blobUrl);

    const extraction = await extractFromVCDocument(buffer, doc.mimeType, doc.fileName);

    await db.uploadedStartupDocument.update({
      where: { id: documentId },
      data: {
        documentTypes: extraction.documentTypes,
        extractedRaw: JSON.parse(JSON.stringify(extraction)),
      },
    });

    return NextResponse.json({
      documentId,
      documentTypes: extraction.documentTypes,
      extraction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `VC document extraction failed for ${doc.fileName}: ${message}` },
      { status: 500 },
    );
  }
}
