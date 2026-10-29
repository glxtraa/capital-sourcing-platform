"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  X,
  Plus,
  FileText,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { DEFAULT_TAINT_POLICIES, resolveDocumentTaint } from "@/dsl/provenance";

export interface TaintPolicyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assetClass: "INVOICE" | "TRADE" | "VC";
  documents?: Array<{
    id: string;
    fileName: string;
    documentTypes?: string[];
    taintOverride?: string | null;
  }>;
}

interface PolicyRow {
  taxonomyCode: string;
  label: string;
  defaultTaint: "AUDITED_PROOF" | "UNVERIFIED_CLAIM";
}

export function TaintPolicyDrawer({
  isOpen,
  onClose,
  assetClass,
  documents = [],
}: TaintPolicyDrawerProps) {
  const router = useRouter();
  const [policies, setPolicies] = useState<PolicyRow[]>(() =>
    DEFAULT_TAINT_POLICIES.filter((p) => p.assetClass === assetClass).map((p) => ({
      taxonomyCode: p.taxonomyCode,
      label: p.label,
      defaultTaint: p.defaultTaint,
    })),
  );
  const [loading, setLoading] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newTaint, setNewTaint] = useState<"AUDITED_PROOF" | "UNVERIFIED_CLAIM">("AUDITED_PROOF");
  const [docOverrides, setDocOverrides] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const map: Record<string, string | null> = {};
    for (const d of documents) {
      map[d.id] = d.taintOverride ?? null;
    }
    setDocOverrides(map);
  }, [documents]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/taint-policy?assetClass=${assetClass}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.policies) && data.policies.length > 0) {
          setPolicies(
            data.policies.map((p: any) => ({
              taxonomyCode: p.taxonomyCode,
              label: p.label,
              defaultTaint:
                p.defaultTaint === "AUDITED_PROOF" ? "AUDITED_PROOF" : "UNVERIFIED_CLAIM",
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, assetClass]);

  if (!isOpen) return null;

  const policyMap: Record<string, "AUDITED_PROOF" | "UNVERIFIED_CLAIM"> = {};
  for (const p of policies) {
    policyMap[p.taxonomyCode] = p.defaultTaint;
  }

  async function handleTogglePolicy(row: PolicyRow) {
    const nextTaint =
      row.defaultTaint === "AUDITED_PROOF" ? "UNVERIFIED_CLAIM" : "AUDITED_PROOF";
    setSavingCode(row.taxonomyCode);
    try {
      const res = await fetch("/api/taint-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetClass,
          taxonomyCode: row.taxonomyCode,
          label: row.label,
          defaultTaint: nextTaint,
        }),
      });
      if (res.ok) {
        setPolicies((prev) =>
          prev.map((p) =>
            p.taxonomyCode === row.taxonomyCode ? { ...p, defaultTaint: nextTaint } : p,
          ),
        );
        router.refresh();
      }
    } finally {
      setSavingCode(null);
    }
  }

  async function handleAddCustomCode(e: React.FormEvent) {
    e.preventDefault();
    if (!newCode.trim()) return;
    const cleanCode = newCode.trim().toUpperCase().replace(/\s+/g, "_");
    setSavingCode(cleanCode);
    try {
      const res = await fetch("/api/taint-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetClass,
          taxonomyCode: cleanCode,
          label: newLabel.trim() || cleanCode.replaceAll("_", " "),
          defaultTaint: newTaint,
        }),
      });
      if (res.ok) {
        setPolicies((prev) => [
          ...prev.filter((p) => p.taxonomyCode !== cleanCode),
          {
            taxonomyCode: cleanCode,
            label: newLabel.trim() || cleanCode.replaceAll("_", " "),
            defaultTaint: newTaint,
          },
        ]);
        setNewCode("");
        setNewLabel("");
        router.refresh();
      }
    } finally {
      setSavingCode(null);
    }
  }

  async function handleDocumentOverride(
    docId: string,
    overrideVal: "AUDITED_PROOF" | "UNVERIFIED_CLAIM" | null,
  ) {
    setSavingDocId(docId);
    try {
      const res = await fetch("/api/taint-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId,
          assetClass,
          taintOverride: overrideVal,
        }),
      });
      if (res.ok) {
        setDocOverrides((prev) => ({ ...prev, [docId]: overrideVal }));
        router.refresh();
      }
    } finally {
      setSavingDocId(null);
    }
  }

  const auditedList = policies.filter((p) => p.defaultTaint === "AUDITED_PROOF");
  const unverifiedList = policies.filter((p) => p.defaultTaint === "UNVERIFIED_CLAIM");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-[#1a1f3a] px-6 py-4 text-white dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#ff6b4a]" />
              <h2 className="text-base font-bold tracking-tight">
                Document Taint Policy &amp; Provenance Classification
              </h2>
              <Badge tone="blue" className="text-[10px]">
                {assetClass}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-neutral-300">
              Configure which document types are trusted as <strong>AUDITED_PROOF</strong> vs{" "}
              <strong>UNVERIFIED_CLAIM</strong>. Audited Proof automatically wins during DSL reconciliation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Per-Document Overrides for Current Deal */}
          {documents.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-200 mb-2">
                Uploaded Deal Documents — Per-File Taint Override ({documents.length})
              </h3>
              <p className="text-xs text-neutral-500 mb-3">
                Each uploaded file inherits its taint level from its classified Document Taxonomy codes below, unless you explicitly override it here.
              </p>
              <div className="space-y-2">
                {documents.map((doc) => {
                  const override = docOverrides[doc.id] ?? null;
                  const effective = resolveDocumentTaint(doc.documentTypes, override, policyMap);
                  return (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
                        <div className="truncate">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {doc.fileName}
                          </span>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {(doc.documentTypes || []).length > 0 ? (
                              doc.documentTypes!.map((dt) => (
                                <span
                                  key={dt}
                                  className="rounded bg-neutral-100 px-1.5 py-0.2 font-mono text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                                >
                                  {dt}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-neutral-400 italic">
                                Unclassified taxonomy
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            effective === "AUDITED_PROOF"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {effective === "AUDITED_PROOF" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {effective}
                        </span>

                        <select
                          aria-label={`Taint override for ${doc.fileName}`}
                          disabled={savingDocId === doc.id}
                          value={override || "DEFAULT"}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleDocumentOverride(
                              doc.id,
                              val === "DEFAULT"
                                ? null
                                : (val as "AUDITED_PROOF" | "UNVERIFIED_CLAIM"),
                            );
                          }}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                        >
                          <option value="DEFAULT">Policy Default</option>
                          <option value="AUDITED_PROOF">Force AUDITED_PROOF</option>
                          <option value="UNVERIFIED_CLAIM">Force UNVERIFIED_CLAIM</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Custom Taxonomy Code */}
          <form
            onSubmit={handleAddCustomCode}
            className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 space-y-3"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-200">
              Add Document Taxonomy Code to Policy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Code (e.g. VC_BANK_STMT)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800"
              />
              <input
                type="text"
                placeholder="Human label (optional)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newTaint}
                  onChange={(e) =>
                    setNewTaint(e.target.value as "AUDITED_PROOF" | "UNVERIFIED_CLAIM")
                  }
                  className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="AUDITED_PROOF">AUDITED_PROOF</option>
                  <option value="UNVERIFIED_CLAIM">UNVERIFIED_CLAIM</option>
                </select>
                <Button type="submit" size="sm" className="text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>
          </form>

          {/* Two Columns: Audited Proof vs Unverified Claim */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-neutral-500 gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading taint policy...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Audited Proof List */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                      Audited Proof ({auditedList.length})
                    </h4>
                  </div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    Click to move →
                  </span>
                </div>
                <div className="space-y-1.5">
                  {auditedList.map((row) => (
                    <button
                      key={row.taxonomyCode}
                      type="button"
                      disabled={savingCode === row.taxonomyCode}
                      onClick={() => handleTogglePolicy(row)}
                      className="flex w-full items-center justify-between rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-left text-xs hover:border-amber-400 hover:bg-amber-50/40 transition-colors dark:border-emerald-800/60 dark:bg-neutral-900"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-mono text-[11px] font-bold text-emerald-900 dark:text-emerald-300 truncate">
                          {row.taxonomyCode}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">{row.label}</div>
                      </div>
                      <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                        PROOF
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Unverified Claim List */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Unverified Claim ({unverifiedList.length})
                    </h4>
                  </div>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">
                    ← Click to promote
                  </span>
                </div>
                <div className="space-y-1.5">
                  {unverifiedList.map((row) => (
                    <button
                      key={row.taxonomyCode}
                      type="button"
                      disabled={savingCode === row.taxonomyCode}
                      onClick={() => handleTogglePolicy(row)}
                      className="flex w-full items-center justify-between rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-left text-xs hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors dark:border-amber-800/60 dark:bg-neutral-900"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-mono text-[11px] font-bold text-amber-900 dark:text-amber-300 truncate">
                          {row.taxonomyCode}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">{row.label}</div>
                      </div>
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                        CLAIM
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="text-xs text-neutral-500">
            Changes persist to Neon Postgres and apply on the next reconciliation or match pass.
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
