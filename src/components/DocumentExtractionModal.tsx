"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { X, Loader2, Save, RefreshCw, FileCode, CheckCircle2, AlertCircle, Copy, Check, Terminal } from "lucide-react";
import { resolveZodDslDefinition } from "@/dsl/zod-registry";

interface DocumentExtractionModalProps {
  dealId: string;
  document: {
    id: string;
    fileName: string;
    documentTypes: string[];
    extractedRaw: any;
  };
  dealType: "invoice" | "trade" | "vc";
  onClose: () => void;
  onExtractionReRun?: () => void;
}

export function DocumentExtractionModal({
  dealId,
  document,
  dealType,
  onClose,
  onExtractionReRun,
}: DocumentExtractionModalProps) {
  const router = useRouter();
  const initialJson = JSON.stringify(document.extractedRaw ?? {}, null, 2);
  const [jsonText, setJsonText] = useState(initialJson);
  const [isSaving, setIsSaving] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"json" | "zod">("json");
  const [copiedZod, setCopiedZod] = useState(false);

  const zodSchemaDef = useMemo(() => {
    return resolveZodDslDefinition({
      dealType,
      dslType: `${dealType.toUpperCase()}_EXTRACTION`,
    });
  }, [dealType]);

  const extractEndpoint =
    dealType === "vc"
      ? `/api/vc-deals/${dealId}/documents/${document.id}/extract`
      : dealType === "trade"
        ? `/api/trade-deals/${dealId}/documents/${document.id}/extract`
        : `/api/deals/${dealId}/documents/${document.id}/extract`;

  const documentPatchEndpoint =
    dealType === "vc"
      ? `/api/vc-deals/${dealId}/documents/${document.id}`
      : dealType === "trade"
        ? `/api/trade-deals/${dealId}/documents/${document.id}`
        : `/api/deals/${dealId}/documents/${document.id}`;

  const reconcileEndpoint =
    dealType === "vc"
      ? `/api/vc-deals/${dealId}/reconcile`
      : dealType === "trade"
        ? `/api/trade-deals/${dealId}/reconcile`
        : `/api/deals/${dealId}/extract`;

  const matchEndpoint =
    dealType === "vc"
      ? `/api/vc-deals/${dealId}/match`
      : dealType === "trade"
        ? `/api/trade-deals/${dealId}/match`
        : `/api/deals/${dealId}/match`;

  async function handleSaveJson() {
    setError(null);
    setNotice(null);
    try {
      const parsed = JSON.parse(jsonText);
      setIsSaving(true);

      const res = await fetch(documentPatchEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedRaw: parsed, extractedFieldsRaw: parsed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save document extraction edits.");
      }

      // Automatically reconcile and refresh matching
      await fetch(reconcileEndpoint, { method: "POST" });
      await fetch(matchEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });

      setNotice("Extraction saved & deal spec reconciled!");
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON format.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReExtract() {
    setError(null);
    setNotice(null);
    setIsReExtracting(true);
    try {
      const res = await fetch(extractEndpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Extraction re-run failed.");
      }

      // Reconcile and re-match
      await fetch(reconcileEndpoint, { method: "POST" });
      await fetch(matchEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });

      setNotice("Document re-extracted & deal spec reconciled!");
      if (onExtractionReRun) onExtractionReRun();
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-extraction failed.");
      setIsReExtracting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                Document Extraction: {document.fileName}
              </h3>
              <p className="text-[11px] text-neutral-500">
                View, edit, or re-run the structured DSL extraction for this data room file.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-neutral-100 bg-neutral-50/50 px-6 pt-2 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={`pb-2.5 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "json"
                  ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300 font-bold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>Extracted DSL JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("zod")}
              className={`pb-2.5 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "zod"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Terminal className="h-3.5 w-3.5 text-amber-500" />
              <span>Underlying Zod DSL</span>
              <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-mono font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Read-Only
              </span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {activeTab === "json" ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Structured DSL JSON</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isReExtracting || isSaving}
                  onClick={handleReExtract}
                  className="h-7 text-xs gap-1 border-neutral-300 dark:border-neutral-700"
                >
                  {isReExtracting ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Re-run Extraction Now
                </Button>
              </div>

              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={18}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 font-mono text-[11px] text-neutral-900 shadow-inner outline-none focus:border-emerald-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
              />
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    <span>{zodSchemaDef.title}</span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-mono font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      No Editing Privileges
                    </span>
                  </h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {zodSchemaDef.summary}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(zodSchemaDef.code);
                    setCopiedZod(true);
                    setTimeout(() => setCopiedZod(false), 2000);
                  }}
                  className="h-7 text-xs gap-1"
                >
                  {copiedZod ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copiedZod ? "Copied" : "Copy Zod Schema"}
                </Button>
              </div>

              <textarea
                value={zodSchemaDef.code}
                readOnly
                rows={18}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-100/70 p-3.5 font-mono text-[11px] text-neutral-800 shadow-inner outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
              />
              <p className="text-[10px] text-neutral-500">
                Authoritative Zod extraction contract enforcing field validation and taint scoring.
              </p>
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving || isReExtracting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveJson}
              disabled={isSaving || isReExtracting}
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Edits &amp; Reconcile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
