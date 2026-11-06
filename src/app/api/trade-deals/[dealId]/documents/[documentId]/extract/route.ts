import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { extractFromTradeDocument } from "@/agents/trade/trade-extraction-agent";
import { downloadBlobBuffer } from "@/lib/blob";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ dealId: string; documentId: string }> },
) {
  const { dealId, documentId } = await params;

  const doc = await db.uploadedTradeDocument.findUnique({
    where: { id: documentId },
    include: { deal: true },
  });

  if (!doc || doc.dealId !== dealId) {
    return NextResponse.json({ error: "Trade document not found on deal" }, { status: 404 });
  }

  try {
    const buffer = await downloadBlobBuffer(doc.blobUrl);

    const extraction = await extractFromTradeDocument(buffer, doc.mimeType, doc.fileName);

    await db.uploadedTradeDocument.update({
      where: { id: documentId },
      data: {
        tradeLeg: extraction.tradeLeg,
        documentTypes: extraction.documentTypes,
        extractedRaw: JSON.parse(JSON.stringify(extraction)),
      },
    });

    return NextResponse.json({
      documentId,
      tradeLeg: extraction.tradeLeg,
      documentTypes: extraction.documentTypes,
      extraction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Extraction failed for ${doc.fileName}: ${message}` },
      { status: 500 },
    );
  }
}
