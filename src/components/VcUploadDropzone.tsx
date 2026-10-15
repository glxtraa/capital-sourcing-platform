"use client";

import { useState, useCallback, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/primitives";
import {
  FileSpreadsheet,
  FileText,
  Globe,
  Plus,
  Trash2,
  UploadCloud,
  Sparkles,
  AlertCircle,
  Brain,
  ShieldCheck,
} from "lucide-react";

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".md": "text/plain",
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

interface QueuedItem {
  id: string;
  type: "file" | "google_sheet";
  file?: File;
  googleSheetUrl?: string;
  name: string;
  sizeLabel?: string;
}

export function VcUploadDropzone({
  existingDealId,
}: {
  existingDealId?: string;
}) {
  const router = useRouter();
  const [queuedItems, setQueuedItems] = useState<QueuedItem[]>([]);
  const [googleSheetInput, setGoogleSheetInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const newItems: QueuedItem[] = [];
    for (const f of incoming) {
      if (isAllowedAndVisibleFile(f)) {
        const ext = getFileExtension(f.name);
        const expectedMime = EXTENSION_MIME_MAP[ext] ?? f.type ?? "application/octet-stream";
        const normalized =
          f.type === expectedMime
            ? f
            : new File([f], f.name, { type: expectedMime, lastModified: f.lastModified });
        const sizeKb = Math.round(normalized.size / 1024);
        const sizeLabel = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        newItems.push({
          id: `${f.name}-${f.size}-${Date.now()}`,
          type: "file",
          file: normalized,
          name: f.name,
          sizeLabel,
        });
      }
    }
    if (newItems.length > 0) {
      setQueuedItems((prev) => [...prev, ...newItems]);
    }
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles],
  );

  function handleAddGoogleSheet() {
    if (!googleSheetInput.trim()) return;
    const url = googleSheetInput.trim();
    if (!url.includes("docs.google.com/spreadsheets")) {
      setError("Please provide a valid Google Sheets URL (e.g. https://docs.google.com/spreadsheets/d/...)");
      return;
    }
    setError(null);
    setQueuedItems((prev) => [
      ...prev,
      {
        id: `gsheet-${Date.now()}`,
        type: "google_sheet",
        googleSheetUrl: url,
        name: "Google Sheets Model / Cap Table",
        sizeLabel: "Cloud Spreadsheet",
      },
    ]);
    setGoogleSheetInput("");
  }

  async function handleSubmit() {
    setError(null);
    if (queuedItems.length === 0) {
      setError("Add at least one document (Pitch Deck, Cap Table, Financial Model, or Google Sheet).");
      return;
    }

    setIsSubmitting(true);
    try {
      let dealId = existingDealId;
      if (!dealId) {
        setProgress("Initializing startup deal intake…");
        const firstItem = queuedItems[0];
        const res = await fetch("/api/vc-deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstFileName: firstItem?.name ?? "",
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to initialize startup deal");
        }
        const newDeal = await res.json();
        dealId = newDeal.id;
      }

      // 1. Upload & Register Documents
      const registeredDocIds: string[] = [];
      for (let i = 0; i < queuedItems.length; i++) {
        const item = queuedItems[i];
        if (item.type === "file" && item.file) {
          setProgress(`Uploading ${item.file.name} (${i + 1}/${queuedItems.length})…`);
          const blob = await upload(item.file.name, item.file, {
            access: "private",
            handleUploadUrl: `/api/vc-deals/${dealId}/upload`,
          });

          const regRes = await fetch(`/api/vc-deals/${dealId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: item.file.name,
              blobUrl: blob.url,
              mimeType: item.file.type || "application/octet-stream",
              sizeBytes: item.file.size,
            }),
          });
          if (!regRes.ok) throw new Error(`Failed to register document ${item.file.name}`);
          const doc = await regRes.json();
          registeredDocIds.push(doc.id);
        } else if (item.type === "google_sheet" && item.googleSheetUrl) {
          setProgress(`Registering Google Sheets link (${i + 1}/${queuedItems.length})…`);
          const regRes = await fetch(`/api/vc-deals/${dealId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: "Google Sheet Model / Cap Table",
              blobUrl: item.googleSheetUrl,
              mimeType: "text/csv",
              sizeBytes: 0,
            }),
          });
          if (!regRes.ok) throw new Error("Failed to register Google Sheet");
          const doc = await regRes.json();
          registeredDocIds.push(doc.id);
        }
      }

      // 2. Extract Document Metadata
      for (let i = 0; i < registeredDocIds.length; i++) {
        setProgress(`AI extracting startup data: Doc ${i + 1}/${registeredDocIds.length}…`);
        const extractRes = await fetch(`/api/vc-deals/${dealId}/documents/${registeredDocIds[i]}/extract`, {
          method: "POST",
        });
        if (!extractRes.ok) {
          console.warn(`Extraction notice on doc ${registeredDocIds[i]}`);
        }
      }

      // 3. Reconcile Deal Spec & Auto-Infer Company, Stage, Vertical, Ask, and Cap Table
      setProgress("AI reconciling & inferring company name, stage, vertical, jurisdiction & cap table…");
      const reconcileRes = await fetch(`/api/vc-deals/${dealId}/reconcile`, { method: "POST" });
      if (!reconcileRes.ok) {
        console.warn("Reconciliation notice");
      }

      // 4. Initial Syndicate Matching
      setProgress("Synthesizing 4-Tier Syndicate & matching Lead VCs, Angels, and Accelerators…");
      const matchRes = await fetch(`/api/vc-deals/${dealId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!matchRes.ok) {
        console.warn("Match synthesis notice");
      }

      if (existingDealId) {
        setQueuedItems([]);
        setIsSubmitting(false);
        setProgress(null);
        router.refresh();
      } else {
        router.push(`/vc-deals/${dealId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Auto-Inference Notice Banner */}
      {!existingDealId && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-xs text-emerald-950 dark:text-emerald-200">
          <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">Zero-Input Automated Intake:</span> Simply upload your pitch deck, cap table, financial model, or Google Sheets link. The agent automatically infers the <strong>company name</strong>, <strong>funding stage</strong>, <strong>sector vertical</strong>, <strong>jurisdiction</strong>, <strong>target raise</strong>, <strong>valuation cap</strong>, and <strong>founder cap table</strong> directly from your documents.
          </div>
        </div>
      )}

      {/* Drag & Drop File Intake Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed px-6 ${
          existingDealId ? "py-6" : "py-10"
        } text-center transition-all ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20"
            : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600"
        }`}
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 mb-3">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Drop pitch decks, cap tables, and financial models here
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Supports <strong>PDF Pitch Decks</strong>, <strong>Excel Workbooks (.xlsx, .xls)</strong>, and <strong>CSV Models</strong>
        </p>
        <div className="mt-3.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
            Browse files
            <input
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* Google Sheets Link Ingestion */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
            Or Ingest via Google Sheets Link
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={googleSheetInput}
            onChange={(e) => setGoogleSheetInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 shadow-2xs focus:border-emerald-500 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddGoogleSheet}
            className="shrink-0 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Sheet
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          Make sure &quot;Anyone with the link can view&quot; is enabled. All sheets are parsed for cap table allocations and forward projections.
        </p>
      </div>

      {/* Queued Documents List */}
      {queuedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
            <span>{queuedItems.length} document{queuedItems.length === 1 ? "" : "s"} ready for analysis</span>
            {!isSubmitting && (
              <button
                type="button"
                onClick={() => setQueuedItems([])}
                className="text-neutral-400 hover:text-neutral-700 text-xs"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {queuedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {item.type === "google_sheet" ? (
                    <Globe className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : item.name.endsWith(".xlsx") || item.name.endsWith(".xls") || item.name.endsWith(".csv") ? (
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                  )}
                  <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">{item.name}</span>
                  {item.sizeLabel && (
                    <span className="shrink-0 text-neutral-400">({item.sizeLabel})</span>
                  )}
                </div>
                {!isSubmitting && (
                  <button
                    type="button"
                    onClick={() => setQueuedItems((prev) => prev.filter((x) => x.id !== item.id))}
                    className="p-1 text-neutral-400 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Button */}
      {(!existingDealId || queuedItems.length > 0 || isSubmitting) && (
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 shadow-sm"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>{progress ?? "Processing deal & running syndicate match…"}</span>
            </div>
          ) : existingDealId ? (
            `Ingest & Extract ${queuedItems.length} Document${queuedItems.length === 1 ? "" : "s"}`
          ) : (
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span>Upload Data Room &amp; Synthesize Syndicate (AI Inferred)</span>
            </div>
          )}
        </Button>
      )}
    </div>
  );
}
