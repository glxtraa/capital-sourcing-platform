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

export interface AgenticPipelineConfig {
  reconcile: boolean;
  competitors: boolean;
  commercial: boolean;
  contacts: boolean;
  syndicate: boolean;
  benchmark: boolean;
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

  // End-to-End Autonomous Agentic Process configuration (all checked by default)
  const [pipelineSteps, setPipelineSteps] = useState<AgenticPipelineConfig>({
    reconcile: true,
    competitors: true,
    commercial: true,
    contacts: true,
    syndicate: true,
    benchmark: true,
  });

  const togglePipelineStep = (step: keyof AgenticPipelineConfig) => {
    setPipelineSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const selectAllPipelineSteps = (val: boolean) => {
    setPipelineSteps({
      reconcile: val,
      competitors: val,
      commercial: val,
      contacts: val,
      syndicate: val,
      benchmark: val,
    });
  };

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

      // 2. Extract Document Metadata (Always run for ingested files)
      for (let i = 0; i < registeredDocIds.length; i++) {
        setProgress(`AI extracting startup data: Doc ${i + 1}/${registeredDocIds.length}…`);
        try {
          const extractRes = await fetch(`/api/vc-deals/${dealId}/documents/${registeredDocIds[i]}/extract`, {
            method: "POST",
          });
          if (!extractRes.ok) {
            console.warn(`Extraction notice on doc ${registeredDocIds[i]}`);
          }
        } catch {
          setProgress(`Verifying extraction status for Doc ${i + 1}/${registeredDocIds.length}…`);
          const start = Date.now();
          while (Date.now() - start < 45000) {
            await new Promise((r) => setTimeout(r, 3000));
            try {
              const checkRes = await fetch(`/api/vc-deals/${dealId}/documents/${registeredDocIds[i]}`);
              if (checkRes.ok) {
                const doc = await checkRes.json();
                if (doc && doc.extractedRaw != null) break;
              }
            } catch {
              // ignore
            }
          }
        }
      }

      // 3. Reconcile Deal Spec & Auto-Infer Company, Stage, Vertical, Ask, and Cap Table (Makoto 誠)
      if (pipelineSteps.reconcile) {
        setProgress("AI reconciling & inferring company name, stage, vertical, jurisdiction & cap table…");
        const reconcileRes = await fetch(`/api/vc-deals/${dealId}/reconcile`, { method: "POST" });
        if (!reconcileRes.ok) {
          console.warn("Reconciliation notice");
        }
      }

      // 4. Competitor Intelligence & Market Rivals (Hikari 光)
      if (pipelineSteps.competitors) {
        setProgress("Hikari (光) discovering market rivals, backed VCs & verifying HTTP sources…");
        try {
          const compRes = await fetch(`/api/vc-deals/${dealId}/competitors`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (!compRes.ok) {
            console.warn("Competitor discovery notice");
          }
        } catch (e) {
          console.warn("Competitor intelligence skipped:", e);
        }
      }

      // 5. Commercial Prospects & Enterprise ICP Clients (Hayate 疾風)
      if (pipelineSteps.commercial) {
        setProgress("Hayate (疾風) hunting commercial enterprise buyers, ACV tiers & partnership hooks…");
        try {
          const commRes = await fetch(`/api/vc-deals/${dealId}/commercial`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (!commRes.ok) {
            console.warn("Commercial discovery notice");
          }
        } catch (e) {
          console.warn("Commercial discovery skipped:", e);
        }
      }

      // 6. Executive Contact Discovery & Relevance Hooks (Hayate 疾風)
      if (pipelineSteps.contacts) {
        setProgress("Hayate (疾風) finding verified decision-makers, email patterns & outreach hooks…");
        try {
          const contactRes = await fetch(`/api/vc-deals/${dealId}/commercial/contacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (!contactRes.ok) {
            console.warn("Contact discovery notice");
          }
        } catch (e) {
          console.warn("Contact discovery skipped:", e);
        }
      }

      // 7. 4-Tier Syndicate Matching & Investor Allocation (Daiki 大輝)
      if (pipelineSteps.syndicate) {
        setProgress("Daiki (大輝) synthesizing 4-Tier Syndicate & matching Lead VCs, Angels & Accelerators…");
        const matchRes = await fetch(`/api/vc-deals/${dealId}/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!matchRes.ok) {
          console.warn("Match synthesis notice");
        }
      }

      // 8. Pro-Forma Dilution & Term Sheet Benchmark (Seiji 正司)
      if (pipelineSteps.benchmark) {
        setProgress("Seiji (正司) calculating pro-forma dilution model & term sheet benchmarks…");
        try {
          const benchRes = await fetch(`/api/vc-deals/${dealId}/benchmark`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          if (!benchRes.ok) {
            console.warn("Benchmark calculation notice");
          }
        } catch (e) {
          console.warn("Benchmark calculation skipped:", e);
        }
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

      {/* End-to-End Autonomous Agentic Pipeline Checklist */}
      <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-900/40 pb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-100">
              End-to-End Autonomous Agentic Pipeline
            </h4>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => selectAllPipelineSteps(true)}
              className="text-emerald-700 hover:underline font-semibold dark:text-emerald-300 cursor-pointer"
            >
              Select All (Full Run)
            </button>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <button
              type="button"
              onClick={() => selectAllPipelineSteps(false)}
              className="text-neutral-500 hover:underline dark:text-neutral-400 cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
          The platform will automatically chain and execute every selected agent step in sequence upon upload. Uncheck any step you wish to skip or run manually later.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {/* Step 1: Makoto Reconcile */}
          <label className="flex items-start gap-2.5 p-2 rounded-lg border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900/80 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
            <input
              type="checkbox"
              checked={pipelineSteps.reconcile}
              onChange={() => togglePipelineStep("reconcile")}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                1. Spec &amp; Cap Table (誠 Makoto)
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                Reconcile company, ask, SAFEs, and cap table
              </span>
            </div>
          </label>

          {/* Step 2: Hikari Competitors */}
          <label className="flex items-start gap-2.5 p-2 rounded-lg border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900/80 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
            <input
              type="checkbox"
              checked={pipelineSteps.competitors}
              onChange={() => togglePipelineStep("competitors")}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                2. Market Rivals (光 Hikari)
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                Uncover rivals, backed VCs &amp; HTTP citations
              </span>
            </div>
          </label>

          {/* Step 3: Hayate Commercial */}
          <label className="flex items-start gap-2.5 p-2 rounded-lg border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900/80 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
            <input
              type="checkbox"
              checked={pipelineSteps.commercial}
              onChange={() => togglePipelineStep("commercial")}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                3. ICP Buyers (疾風 Hayate)
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                Enterprise buyers, ACV tiers &amp; synergy fits
              </span>
            </div>
          </label>

          {/* Step 4: Hayate Contacts */}
          <label className="flex items-start gap-2.5 p-2 rounded-lg border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900/80 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
            <input
              type="checkbox"
              checked={pipelineSteps.contacts}
              onChange={() => togglePipelineStep("contacts")}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                4. Executive Contacts (疾風 Hayate)
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                Decision makers, email patterns &amp; outreach hooks
              </span>
            </div>
          </label>

          {/* Step 5: Daiki Syndicate */}
          <label className="flex items-start gap-2.5 p-2 rounded-lg border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900/80 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
            <input
              type="checkbox"
              checked={pipelineSteps.syndicate}
              onChange={() => togglePipelineStep("syndicate")}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                5. 4-Tier Syndicate (大輝 Daiki)
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                Lead VCs, AngelList SPVs &amp; domain angels
              </span>
            </div>
          </label>

          {/* Step 6: Seiji Benchmark */}
          <label className="flex items-start gap-2.5 p-2 rounded-lg border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900/80 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
            <input
              type="checkbox"
              checked={pipelineSteps.benchmark}
              onChange={() => togglePipelineStep("benchmark")}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
            />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                6. Term Benchmark (正司 Seiji)
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                Pro-forma dilution matrix &amp; round term sheet
              </span>
            </div>
          </label>
        </div>
      </div>

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
