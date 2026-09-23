import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";

/**
 * Issues a short-lived client upload token so the browser can PUT the file
 * bytes straight to Vercel Blob — not through this (or any) serverless
 * function. That distinction matters: Vercel serverless functions cap
 * request bodies at 4.5MB, and a real multi-document contract upload
 * (e.g. this app's own worked examples — a 4.4MB scanned coal contract)
 * blows past that easily. Routing the file itself through a Route Handler,
 * as an earlier version of this route did, works fine in local testing
 * with small files and then fails opaquely in production the first time
 * someone uploads something real.
 *
 * This route only ever sees a tiny JSON token-request, never the file
 * bytes. After the browser finishes the direct-to-Blob upload, it calls
 * `/api/deals/:id/documents` (a similarly tiny JSON request) to register
 * the resulting blob URL — see UploadDropzone.tsx for the full client-side
 * flow. `onUploadCompleted` is deliberately NOT used here: it's a webhook
 * Vercel Blob calls back on its own, which needs a publicly reachable URL
 * and doesn't fire for local `next dev` without extra tunneling — since
 * our own client code already knows exactly when its own upload finished,
 * having it call the registration route directly is simpler and works
 * identically in local dev and production.
 */
export async function POST(request: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;

  const deal = await db.deal.findUnique({ where: { id: dealId } });
  if (!deal) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/pdf",
          "text/plain",
          "text/csv",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ dealId }),
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
