"use client";

import { useState, useCallback, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";

/**
 * Two-step flow, both against real API routes:
 *   1. POST /api/deals { name } -> { id }
 *   2. POST /api/deals/:id/upload (multipart) -> fires the extraction
 *      pipeline server-side; this component just navigates to the deal
 *      page afterward, where status polling (see DealStatusPoller) takes
 *      over.
 */
export function UploadDropzone() {
  const router = useRouter();
  const [dealName, setDealName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      const uploadRes = await fetch(`/api/deals/${deal.id}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Failed to upload documents.");

      router.push(`/deals/${deal.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setIsSubmitting(false);
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
        {isSubmitting ? "Uploading…" : "Create deal & start extraction"}
      </Button>
    </div>
  );
}
