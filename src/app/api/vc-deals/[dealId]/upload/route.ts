import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { resolveBlobReadWriteToken } from "@/lib/env";

export async function POST(request: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.startupDeal.findUnique({ where: { id: dealId } });
  if (!deal) {
    return NextResponse.json({ error: "Startup deal not found" }, { status: 404 });
  }

  const body = (await request.json()) as HandleUploadBody;
  resolveBlobReadWriteToken();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/plain",
          "text/markdown",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/octet-stream",
        ],
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ dealId, vc: true }),
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate upload token" },
      { status: 400 },
    );
  }
}
