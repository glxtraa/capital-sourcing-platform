"use client";

import { useState, useCallback, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/primitives";

/**
 * Five-step flow:
 *   1. POST /api/deals { name } -> { id }
 *   2. For each file: upload() straight to Vercel Blob from the browser
 *      (via a token minted by /api/deals/:id/upload) -- the file bytes
 *      never pass through our own server, which matters because Vercel
 *      serverless functions cap request bodies at 4.5MB and real contracts
 *      routinely exceed that (this app's own worked examples include a
 *      4.4MB scanned coal contract).
 *   3. POST /api/deals/:id/documents with each resulting blob URL (tiny
 *      JSON, not the file itself) to record it.
 *   4. POST /api/deals/:id/documents/:documentId/extract for each file, ONE
 *      AT A TIME (sequential, not Promise.all) -- each call does that one
 *      file's OCR + LLM extraction. Splitting per-file rather than one
 *      request for all of them matters because Vercel's Hobby plan
 *      hard-caps a function at 60s regardless of maxDuration; a single
 *      request handling several documents at once could exceed that and
 *      get killed mid-request, leaving the deal stuck (see that route's own
 *      comment). One file per request gives each the best chance of
 *      finishing in time, and a slow/failing file doesn't take the others
 *      down with it.
 *   5. POST /api/deals/:id/extract once every file has been extracted --
 *      this is a fast DB-only merge (no LLM calls), so it isn't the slow
 *      step. Only once it resolves does this component navigate to the
 *      deal page.
 */
export function UploadDropzone() {
  const router = useRouter();
  const [dealName, setDealName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
  }, []);

  async function handleSubmit() {
    setError(null);
    if (!dealName.trim()) {
      setError("Give this deal a name (e.g. the borrower's company name).");
      return;
    }
    if (files.length === 0) {
      setError("Add at least one document.");
      return;
    }
    setIsSubmitting(true);
    try {
      const dealRes = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: dealName.trim() }),
      });
      if (!dealRes.ok) throw new Error("Failed to create deal.");
      const deal = await dealRes.json();

      const documentIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${file.name} (${i + 1}/${files.length})…`);

        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: `/api/deals/${deal.id}/upload`,
        });

        const registerRes = await fetch(`/api/deals/${deal.id}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            blobUrl: blob.url,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        if (!registerRes.ok) throw new Error(`Uploaded ${file.name} but failed to register it.`);
        const document = await registerRes.json();
        documentIds.push(document.id);
      }

      for (let i = 0; i < documentIds.length; i++) {
        setProgress(`Extracting ${files[i].name} (${i + 1}/${documentIds.length})…`);
        const extractOneRes = await fetch(`/api/deals/${deal.id}/documents/${documentIds[i]}/extract`, {
          method: "POST",
        });
        if (!extractOneRes.ok) {
          const body = await extractOneRes.json().catch(() => ({}));
          throw new Error(body.error ?? `Extraction failed for ${files[i].name}.`);
        }
      }

      setProgress("Finalizing deal spec…");
      const finalizeRes = await fetch(`/api/deals/${deal.id}/extract`, { method: "POST" });
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Documents extracted, but finalizing the deal spec failed.");
      }

      router.push(`/deals/${deal.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setIsSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Deal name</label>
        <input
          type="text"
          value={dealName}
          onChange={(e) => setDealName(e.target.value)}
          placeholder="e.g. Favorite Medium Asia / TISI"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging ? "border-neutral-500 bg-neutral-100 dark:bg-neutral-800" : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Drag contracts, transcripts, or corporate documents here, or
        </p>
        <label className="mt-2 inline-block cursor-pointer text-sm font-medium text-neutral-900 underline dark:text-neutral-100">
          browse files
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
          />
        </label>
        <p className="mt-1 text-xs text-neutral-400">PDF works best — read natively by the extraction agent.</p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800">
              <span className="truncate">{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? (progress ?? "Uploading…") : "Create deal & start extraction"}
      </Button>
    </div>
  );
}
