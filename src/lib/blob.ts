import { put, del } from "@vercel/blob";

/**
 * Uploaded deal documents (contracts, transcripts, corporate docs) go to
 * Vercel Blob rather than the app's own filesystem — required on Vercel's
 * serverless/edge runtime, which has no persistent disk. Requires
 * BLOB_READ_WRITE_TOKEN (Vercel provisions this automatically once you
 * attach a Blob store to the project; see README.md).
 */
export async function uploadDealDocument(
  dealId: string,
  fileName: string,
  file: File,
): Promise<{ url: string; sizeBytes: number }> {
  const blob = await put(`deals/${dealId}/${Date.now()}-${fileName}`, file, {
    access: "public", // scope tightened per-org via signed URLs if this goes beyond a prototype
    addRandomSuffix: false,
  });
  return { url: blob.url, sizeBytes: file.size };
}

export async function deleteDealDocument(blobUrl: string): Promise<void> {
  await del(blobUrl);
}
