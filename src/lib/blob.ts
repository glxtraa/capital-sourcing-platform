import { del, get } from "@vercel/blob";
import { resolveBlobReadWriteToken } from "@/lib/env";

/**
 * Uploaded deal documents (contracts, pitch decks, cap tables) live in
 * Vercel Blob rather than the app's own filesystem — required on Vercel's
 * serverless/edge runtime, which has no persistent disk.
 */
export async function deleteDealDocument(blobUrl: string): Promise<void> {
  resolveBlobReadWriteToken();
  await del(blobUrl);
}

/**
 * Downloads a file buffer from a blob URL or external URL (e.g. Google Sheets export).
 * Correctly authenticates against private Vercel Blob stores using both static
 * BLOB_READ_WRITE_TOKEN and Vercel OIDC tokens, with resilient fallback to direct HTTP fetch.
 */
export async function downloadBlobBuffer(blobUrl: string): Promise<Buffer> {
  const token = resolveBlobReadWriteToken();

  // If not a Vercel Blob URL (e.g. Google Sheet CSV export or public URL), fetch directly
  if (!blobUrl.includes("blob.vercel-storage.com")) {
    const res = await fetch(blobUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch file from URL: ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  // Extract storeId from hostname if available (e.g. storeId.private.blob.vercel-storage.com)
  let storeId: string | undefined;
  try {
    const { hostname } = new URL(blobUrl);
    storeId = hostname.split(".")[0];
  } catch {
    // ignore URL parse failure
  }

  // 1. Try @vercel/blob get with access: "private"
  try {
    const result = await get(blobUrl, {
      access: "private",
      ...(token ? { token } : {}),
      ...(storeId ? { storeId } : {}),
    });
    if (result && result.stream) {
      const resp = new Response(result.stream);
      return Buffer.from(await resp.arrayBuffer());
    }
  } catch (err) {
    // Fall through to other attempts
  }

  // 2. Try @vercel/blob get with access: "public"
  try {
    const result = await get(blobUrl, {
      access: "public",
      ...(token ? { token } : {}),
      ...(storeId ? { storeId } : {}),
    });
    if (result && result.stream) {
      const resp = new Response(result.stream);
      return Buffer.from(await resp.arrayBuffer());
    }
  } catch (err) {
    // Fall through
  }

  // 3. Fallback to direct HTTP fetch with Bearer token if present
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(blobUrl, Object.keys(headers).length > 0 ? { headers } : undefined);
  if (!res.ok) {
    throw new Error(`Failed to download file from blob: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
