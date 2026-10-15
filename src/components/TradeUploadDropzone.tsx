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

export function TradeUploadDropzone({
  existingDealId,
}: {
  existingDealId?: string;
}) {
  const router = useRouter();
  const [dealName, setDealName] = useState("");
  const [corridor, setCorridor] = useState<string>("IDN_COAL_ASIA");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addDiscoveredFiles = useCallback((incoming: File[]) => {
    const allowed: File[] = [];
    for (const rawFile of incoming) {
      if (isAllowedAndVisibleFile(rawFile)) {
        allowed.push(normalizeFileForUpload(rawFile));
      }
    }
    if (allowed.length > 0) {
      setFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}::${f.size}`));
        const deduped = allowed.filter((f) => !existingKeys.has(`${f.name}::${f.size}`));
        return [...prev, ...deduped];
      });
    }
  }, []);

  const onDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      addDiscoveredFiles(Array.from(e.dataTransfer.files));
    },
    [addDiscoveredFiles],
  );

  async function handleSubmit() {
    setError(null);
    if (!existingDealId && !dealName.trim()) {
      setError("Please specify a deal name (e.g. 'Barito Coal Export / Singapore Offtake').");
      return;
    }
    if (files.length === 0) {
      setError("Add at least one trade contract or cargo document.");
      return;
    }
    setIsSubmitting(true);
    try {
      let dealId = existingDealId;
      if (!dealId) {
        const dealRes = await fetch("/api/trade-deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: dealName.trim(), corridor }),
        });
        if (!dealRes.ok) throw new Error("Failed to create trade deal.");
        const deal = await dealRes.json();
        dealId = deal.id;
      }

      // 1. Upload files directly to Vercel Blob and register them
      const documentIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${file.name} (${i + 1}/${files.length})…`);
        const blob = await upload(file.name, file, {
          access: "private",
          handleUploadUrl: `/api/trade-deals/${dealId}/upload`,
        });

        const registerRes = await fetch(`/api/trade-deals/${dealId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            blobUrl: blob.url,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        if (!registerRes.ok) throw new Error(`Failed to register ${file.name}`);
        const doc = await registerRes.json();
        documentIds.push(doc.id);
      }

      // 2. Sequential extraction
      for (let i = 0; i < documentIds.length; i++) {
        setProgress(`Extracting trade metadata: ${files[i].name} (${i + 1}/${documentIds.length})…`);
        const extractRes = await fetch(`/api/trade-deals/${dealId}/documents/${documentIds[i]}/extract`, {
          method: "POST",
        });
        if (!extractRes.ok) {
          const body = await extractRes.json().catch(() => ({}));
          throw new Error(body.error ?? `Extraction failed for ${files[i].name}`);
        }
      }

      // 3. Reconcile contracts and cashflow gap
      setProgress("Reconciling paired contracts, Incoterms, and cashflow gap…");
      const reconcileRes = await fetch(`/api/trade-deals/${dealId}/reconcile`, { method: "POST" });
      if (!reconcileRes.ok) {
        const body = await reconcileRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to reconcile trade deal contracts.");
      }

      if (existingDealId) {
        setFiles([]);
        setIsSubmitting(false);
        setProgress(null);
        router.refresh();
      } else {
        router.push(`/trade-deals/${dealId}`);
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
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Trade Deal Name</label>
            <input
              type="text"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              placeholder="e.g. PT Mandiri Coal to Shanghai Energy Trading"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Commodity Corridor</label>
            <select
              value={corridor}
              onChange={(e) => setCorridor(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="IDN_COAL_ASIA">Indonesian Coal $\rightarrow$ Asia (IUP Concession, LHV, SIMPONI)</option>
              <option value="SEA_AGRI_GLOBAL">Southeast Asian Agri $\rightarrow$ Global (CPO, Rubber, Rice, RSPO)</option>
              <option value="LATAM_SEAFOOD_ASIA">Latin American Seafood $\rightarrow$ Asia (Shrimp, Squid, Salmon, Cold-Chain)</option>
              <option value="OTHER_CROSS_BORDER">Other Cross-Border Commodity Corridor</option>
            </select>
          </div>
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
          isDragging ? "border-purple-500 bg-purple-50 dark:bg-neutral-800" : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {existingDealId
            ? "Upload additional trade documents (paired sales contracts, BL, surveyor certs):"
            : "Drag trade contracts, purchase orders, LCs, bills of lading, or inspection certs here, or"}
        </p>
        <div className="mt-2 flex items-center justify-center gap-4">
          <label className="cursor-pointer text-sm font-medium text-purple-600 underline dark:text-purple-400">
            browse trade documents
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
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Upload both Buy Leg (Supplier $\rightarrow$ Trader) and Sell Leg (Trader $\rightarrow$ Buyer) contracts for full margin reconciliation.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{files.length} document{files.length === 1 ? "" : "s"} selected</span>
            {!isSubmitting && (
              <button
                type="button"
                onClick={() => setFiles([])}
                className="hover:underline text-neutral-400 hover:text-neutral-700"
              >
                Clear
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
                    className="text-neutral-400 hover:text-neutral-700 text-xs"
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
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-purple-700 hover:bg-purple-800">
          {isSubmitting
            ? (progress ?? "Processing…")
            : existingDealId
              ? `Upload & extract ${files.length} trade doc${files.length === 1 ? "" : "s"}`
              : "Create trade deal & extract contracts"}
        </Button>
      )}
    </div>
  );
}
