"use client";

import { useState, useCallback, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/primitives";

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function getFileExtension(fileName: string): string {
  const dotIdx = fileName.lastIndexOf(".");
  return dotIdx === -1 ? "" : fileName.slice(dotIdx).toLowerCase();
}

function isAllowedAndVisibleFile(file: File): boolean {
  const baseName = file.name.split("/").pop() ?? file.name;
  // Ignore hidden dot-files (.DS_Store, ._*, etc.) and temporary Office lock files (~$*)
  if (baseName.startsWith(".") || baseName.startsWith("~$")) return false;
  if (file.size === 0) return false;
  const ext = getFileExtension(baseName);
  return ext in EXTENSION_MIME_MAP;
}

function normalizeFileForUpload(file: File): File {
  const baseName = file.name.split("/").pop() ?? file.name;
  const ext = getFileExtension(baseName);
  const expectedMime = EXTENSION_MIME_MAP[ext] ?? file.type ?? "application/octet-stream";
  if (file.type === expectedMime) return file;
  return new File([file], file.name, { type: expectedMime, lastModified: file.lastModified });
}

async function readAllEntriesFromDirectory(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise<File[]>((resolve) => {
      fileEntry.file(
        (f) => resolve([f]),
        () => resolve([]),
      );
    });
  }
  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const allChildEntries: FileSystemEntry[] = [];
    // readEntries returns at most ~100 entries per call in Chromium/WebKit, so loop until empty
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(
          (entries) => resolve(entries),
          () => resolve([]),
        );
      });
      if (batch.length === 0) break;
      allChildEntries.push(...batch);
    }
    const nested = await Promise.all(allChildEntries.map((child) => readAllEntriesFromDirectory(child)));
    return nested.flat();
  }
  return [];
}

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
 *      file's OCR + LLM extraction.
 *   5. POST /api/deals/:id/extract once every file has been extracted --
 *      this is a fast DB-only merge (no LLM calls), so it isn't the slow
 *      step. Only once it resolves does this component navigate to the
 *      deal page.
 */
export function UploadDropzone({ existingDealId }: { existingDealId?: string } = {}) {
  const router = useRouter();
  const [dealName, setDealName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [filterNotice, setFilterNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdDealId, setCreatedDealId] = useState<string | null>(existingDealId ?? null);
  const [uploadedDocIds, setUploadedDocIds] = useState<string[]>([]);
  const [extractedDocIds, setExtractedDocIds] = useState<Set<string>>(new Set());

  const addDiscoveredFiles = useCallback((incoming: File[]) => {
    const allowed: File[] = [];
    let skippedCount = 0;

    for (const rawFile of incoming) {
      if (isAllowedAndVisibleFile(rawFile)) {
        allowed.push(normalizeFileForUpload(rawFile));
      } else {
        skippedCount++;
      }
    }

    if (allowed.length > 0) {
      setFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}::${f.size}`));
        const deduped = allowed.filter((f) => !existingKeys.has(`${f.name}::${f.size}`));
        return [...prev, ...deduped];
      });
    }

    if (skippedCount > 0) {
      setFilterNotice(
        `Added ${allowed.length} supported file${allowed.length === 1 ? "" : "s"} (skipped ${skippedCount} unsupported or hidden file${skippedCount === 1 ? "" : "s"}).`,
      );
    } else {
      setFilterNotice(null);
    }
  }, []);

  const onDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const items = Array.from(e.dataTransfer.items ?? []);
      const entries = items
        .map((item) => item.webkitGetAsEntry?.() ?? null)
        .filter((entry): entry is FileSystemEntry => entry !== null);

      if (entries.length > 0) {
        const collected = (await Promise.all(entries.map((entry) => readAllEntriesFromDirectory(entry)))).flat();
        addDiscoveredFiles(collected);
      } else {
        addDiscoveredFiles(Array.from(e.dataTransfer.files));
      }
    },
    [addDiscoveredFiles],
  );

  async function handleSubmit() {
    setError(null);
    if (!existingDealId && !dealName.trim()) {
      setError("Give this deal a name (e.g. the borrower's company name).");
      return;
    }
    if (files.length === 0) {
      setError("Add at least one document.");
      return;
    }
    setIsSubmitting(true);
    try {
      let dealId = existingDealId ?? createdDealId;
      if (!dealId) {
        const dealRes = await fetch("/api/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: dealName.trim() }),
        });
        if (!dealRes.ok) throw new Error("Failed to create deal.");
        const deal = await dealRes.json();
        dealId = deal.id as string;
        setCreatedDealId(dealId);
      }

      const documentIds = [...uploadedDocIds];
      for (let i = documentIds.length; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${file.name} (${i + 1}/${files.length})…`);

        const blob = await upload(file.name, file, {
          access: "private",
          handleUploadUrl: `/api/deals/${dealId}/upload`,
        });

        const registerRes = await fetch(`/api/deals/${dealId}/documents`, {
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
        setUploadedDocIds([...documentIds]);
      }

      const doneSet = new Set(extractedDocIds);
      for (let i = 0; i < documentIds.length; i++) {
        if (doneSet.has(documentIds[i])) continue;
        setProgress(`Extracting ${files[i].name} (${i + 1}/${documentIds.length})…`);
        const extractOneRes = await fetch(`/api/deals/${dealId}/documents/${documentIds[i]}/extract`, {
          method: "POST",
        });
        if (!extractOneRes.ok) {
          const body = await extractOneRes.json().catch(() => ({}));
          throw new Error(body.error ?? `Extraction failed for ${files[i].name}.`);
        }
        doneSet.add(documentIds[i]);
        setExtractedDocIds(new Set(doneSet));
      }

      setProgress("Finalizing & merging deal spec…");
      const finalizeRes = await fetch(`/api/deals/${dealId}/extract`, { method: "POST" });
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Documents extracted, but finalizing the deal spec failed.");
      }

      if (existingDealId) {
        setFiles([]);
        setUploadedDocIds([]);
        setExtractedDocIds(new Set());
        setFilterNotice(null);
        setIsSubmitting(false);
        setProgress(null);
        router.refresh();
      } else {
        router.push(`/deals/${dealId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setIsSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      {!existingDealId && (
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
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-6 ${existingDealId ? "py-6" : "py-10"} text-center transition-colors ${
          isDragging ? "border-neutral-500 bg-neutral-100 dark:bg-neutral-800" : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {existingDealId
            ? "Add more documents to this deal: drag files or a folder here, or"
            : "Drag individual files or an entire folder here, or"}
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <label className="cursor-pointer text-sm font-medium text-neutral-900 underline dark:text-neutral-100">
            browse files
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                addDiscoveredFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-xs text-neutral-400">or</span>
          <label className="cursor-pointer text-sm font-medium text-neutral-900 underline dark:text-neutral-100">
            browse folder
            <input
              type="file"
              multiple
              // @ts-expect-error webkitdirectory is a non-standard attribute supported by all modern browsers
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={(e) => {
                addDiscoveredFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Automatically filters folders to PDF and allowed document files (.pdf, .txt, .md, .csv, .doc, .docx).
        </p>
      </div>

      {filterNotice && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{filterNotice}</p>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{files.length} file{files.length === 1 ? "" : "s"} queued</span>
            {!isSubmitting && (
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setFilterNotice(null);
                }}
                className="hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <ul className="space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800">
                <span className="truncate">{f.name}</span>
                {!isSubmitting && (
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {(!existingDealId || files.length > 0 || isSubmitting) && (
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting
            ? (progress ?? "Uploading…")
            : existingDealId
              ? `Upload & extract ${files.length} document${files.length === 1 ? "" : "s"}`
              : "Create deal & start extraction"}
        </Button>
      )}
    </div>
  );
}
