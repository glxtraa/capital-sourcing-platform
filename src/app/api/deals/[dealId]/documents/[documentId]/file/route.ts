import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { downloadBlobBuffer } from "@/lib/blob";

export const maxDuration = 60;

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

  if (!doc.blobUrl.includes("blob.vercel-storage.com")) {
    return NextResponse.redirect(doc.blobUrl);
  }

  try {
    const buffer = await downloadBlobBuffer(doc.blobUrl);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to load document: ${message}` }, { status: 500 });
  }
}
