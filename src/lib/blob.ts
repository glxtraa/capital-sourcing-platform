import { del } from "@vercel/blob";

/**
 * Uploaded deal documents (contracts, transcripts, corporate docs) live in
 * Vercel Blob rather than the app's own filesystem — required on Vercel's
 * serverless/edge runtime, which has no persistent disk. Requires
 * BLOB_READ_WRITE_TOKEN (Vercel provisions this automatically once you
 * attach a Blob store to the project; see README.md).
 *
 * There's no `uploadDealDocument` helper here: uploads go straight from
 * the browser to Blob via `@vercel/blob/client`'s `upload()` (see
 * UploadDropzone.tsx and src/app/api/deals/[dealId]/upload/route.ts) so
 * they aren't capped by a serverless function's 4.5MB request-body limit.
 * This file only keeps the one server-side operation that has to run on
 * the server: deletion.
 */
export async function deleteDealDocument(blobUrl: string): Promise<void> {
  await del(blobUrl);
}
