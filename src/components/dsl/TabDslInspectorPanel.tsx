"use client";

import { useState, useEffect, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Check,
  History,
  RotateCcw,
  Save,
  Play,
  Info,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import {
  type FieldDocumentation,
  type FieldClassification,
  VC_DEAL_SPEC_FIELDS,
  TRADE_DEAL_SPEC_FIELDS,
  INVOICE_DEAL_SPEC_FIELDS,
} from "@/dsl/field-documentation";
import { resolveZodDslDefinition, type ZodDslSchemaDefinition } from "@/dsl/zod-registry";

export interface DslSectionItem {
  id: string;
  dslType: string;
  title: string;
  subtitle?: string;
  payload: Record<string, unknown> | unknown[];
  fieldsDoc?: FieldDocumentation[];
  onSavePayload?: (updatedPayload: any, note: string) => Promise<void> | void;
  onReRunAgent?: (updatedPayload: any) => Promise<void> | void;
}

export interface TabDslInspectorPanelProps {
  assetClass: "STARTUP" | "TRADE" | "INVOICE";
  dealId: string;
  dealName?: string;
  tabKey: string;
  tabLabel: string;
  items: DslSectionItem[];
  defaultOpen?: boolean;
}

interface DslRevision {
  id: string;
  versionNumber: number;
  label: string;
  authorType: "AGENT_EXTRACTION" | "HUMAN_OVERRIDE" | "ROLLBACK_RESTORE" | string;
  authorNote: string | null;
  payloadJson: any;
  diffSummary: string | null;
  isCurrent: boolean;
  createdAt: string;
}

export function TabDslInspectorPanel({
  assetClass,
  dealId,
  dealName,
  tabKey,
  tabLabel,
  items,
  defaultOpen = false,
}: TabDslInspectorPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [editorText, setEditorText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Versioning state
  const [revisions, setRevisions] = useState<DslRevision[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [versionNote, setVersionNote] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [activeDictionaryTab, setActiveDictionaryTab] = useState<"fields" | "jurisdiction" | "zod">("fields");
  const [copiedZodCode, setCopiedZodCode] = useState(false);

  const currentItem = items[selectedItemIndex] || items[0];

  const zodSchemaDef = useMemo(() => {
    return resolveZodDslDefinition({
      dslType: currentItem?.dslType,
      assetClass,
    });
  }, [currentItem?.dslType, assetClass]);

  // Load revisions when active item or dealId changes
  useEffect(() => {
    if (!dealId || !currentItem) return;

    let isMounted = true;
    setIsLoadingRevisions(true);

    fetch(`/api/dsl-revisions?dealId=${dealId}&dslType=${currentItem.dslType}&tabKey=${tabKey}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && Array.isArray(data.revisions)) {
          setRevisions(data.revisions);
          if (data.revisions.length > 0) {
            const currentRev = data.revisions.find((r: DslRevision) => r.isCurrent) || data.revisions[0];
            setSelectedRevisionId(currentRev.id);
            setEditorText(JSON.stringify(currentRev.payloadJson, null, 2));
            return;
          }
        }
        // Fallback to prop payload if no saved revisions exist yet
        setEditorText(JSON.stringify(currentItem.payload ?? {}, null, 2));
        setSelectedRevisionId(null);
      })
      .catch((err) => {
        console.error("Failed to load revisions:", err);
        setEditorText(JSON.stringify(currentItem.payload ?? {}, null, 2));
      })
      .finally(() => {
        if (isMounted) setIsLoadingRevisions(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dealId, currentItem?.dslType, tabKey]);

  // When switching between items in the tab
  const handleSelectItem = (idx: number) => {
    setSelectedItemIndex(idx);
    const item = items[idx];
    if (item) {
      setEditorText(JSON.stringify(item.payload ?? {}, null, 2));
      setParseError(null);
    }
  };

  // Switch to inspecting an older historical revision
  const handleSelectRevision = (revId: string) => {
    setSelectedRevisionId(revId);
    const rev = revisions.find((r) => r.id === revId);
    if (rev) {
      setEditorText(JSON.stringify(rev.payloadJson, null, 2));
      setParseError(null);
    }
  };

  // Re-format JSON
  const handleFormat = () => {
    try {
      const parsed = JSON.parse(editorText);
      setEditorText(JSON.stringify(parsed, null, 2));
      setParseError(null);
    } catch (e: any) {
      setParseError(e.message);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(editorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save new version
  const handleCommitNewVersion = async () => {
    let parsed: any;
    try {
      parsed = JSON.parse(editorText);
    } catch (e: any) {
      setParseError(`Cannot save invalid JSON: ${e.message}`);
      return;
    }

    setIsSaving(true);
    setParseError(null);

    try {
      const nextVer = (revisions[0]?.versionNumber ?? 0) + 1;
      const res = await fetch("/api/dsl-revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetClass,
          dealId,
          tabKey,
          dslType: currentItem.dslType,
          label: `v${nextVer} - Human Correction${versionNote ? `: ${versionNote}` : ""}`,
          authorType: "HUMAN_OVERRIDE",
          authorNote: versionNote.trim() || "Manual correction in DSL Inspector",
          payloadJson: parsed,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to commit revision");

      // Update local revisions
      const newRev: DslRevision = data.revision;
      setRevisions((prev) => [newRev, ...prev.map((r) => ({ ...r, isCurrent: false }))]);
      setSelectedRevisionId(newRev.id);
      setIsSaveModalOpen(false);
      setVersionNote("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Trigger optional prop callbacks
      if (currentItem.onSavePayload) {
        await currentItem.onSavePayload(parsed, versionNote);
      }
    } catch (err: any) {
      setParseError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Rollback / restore selected historical version
  const handleRestoreRevision = async (revId: string) => {
    if (!confirm("Are you sure you want to restore the deal specification to this exact historical version?")) {
      return;
    }

    setIsRestoring(true);
    try {
      const res = await fetch("/api/dsl-revisions/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId: revId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore revision");

      const restoredRev: DslRevision = data.revision;
      setRevisions((prev) => [restoredRev, ...prev.map((r) => ({ ...r, isCurrent: false }))]);
      setSelectedRevisionId(restoredRev.id);
      setEditorText(JSON.stringify(restoredRev.payloadJson, null, 2));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (currentItem.onSavePayload) {
        await currentItem.onSavePayload(restoredRev.payloadJson, "Restored historical version");
      }
    } catch (err: any) {
      setParseError(err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Determine active revision object
  const activeRevision = revisions.find((r) => r.id === selectedRevisionId);
  const isViewingHistorical = activeRevision && !activeRevision.isCurrent;

  // Resolve field schema documentation
  const fieldsDocumentation: FieldDocumentation[] = useMemo(() => {
    if (currentItem?.fieldsDoc && currentItem.fieldsDoc.length > 0) {
      return currentItem.fieldsDoc;
    }
    if (assetClass === "STARTUP") return VC_DEAL_SPEC_FIELDS;
    if (assetClass === "TRADE") return TRADE_DEAL_SPEC_FIELDS;
    return INVOICE_DEAL_SPEC_FIELDS;
  }, [currentItem, assetClass]);

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-950">
      {/* Collapsible Header Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                🛠️ Tab DSL Specifications, Version Tracking &amp; Field Guide
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {items.length} DSL Payload{items.length === 1 ? "" : "s"}
              </span>
              {revisions.length > 0 && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950/80 dark:text-violet-300">
                  {revisions.length} Version{revisions.length === 1 ? "" : "s"} Tracked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {tabLabel} · Inspect standard vs free-text schemas, edit domain attributes (e.g. sub-industries), and roll back to previous versions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Version Saved &amp; Synced
            </span>
          )}
          <span className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">
            {isOpen ? "Collapse Panel [ - ]" : "Expand Panel [ + ]"}
          </span>
        </div>
      </button>

      {/* Expanded Accordion Body */}
      {isOpen && (
        <div className="border-t border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/40">
          {/* Top Switcher: Select DSL Payload within the Active Tab */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
              {items.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectItem(idx)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    selectedItemIndex === idx
                      ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>

            {/* Version Switcher Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-800 dark:bg-slate-900">
                <History className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-500">Version:</span>
                <select
                  value={selectedRevisionId || ""}
                  onChange={(e) => handleSelectRevision(e.target.value)}
                  className="bg-transparent font-medium text-slate-800 focus:outline-hidden dark:text-slate-200"
                  disabled={isLoadingRevisions || revisions.length === 0}
                >
                  {revisions.length === 0 ? (
                    <option value="">v1 (Live Current State)</option>
                  ) : (
                    revisions.map((rev) => (
                      <option key={rev.id} value={rev.id}>
                        v{rev.versionNumber} {rev.isCurrent ? "★ Active" : "· History"} ({rev.authorType === "HUMAN_OVERRIDE" ? "Human" : rev.authorType === "ROLLBACK_RESTORE" ? "Restored" : "Agent"})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Commit New Version Button */}
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
              >
                <Save className="h-3.5 w-3.5" />
                Save as New Version
              </button>
            </div>
          </div>

          {/* Historical Version Banner with Rollback Option */}
          {isViewingHistorical && activeRevision && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <span className="font-bold">Viewing Historical Snapshot:</span> {activeRevision.label}
                  {activeRevision.authorNote && (
                    <span className="block italic text-amber-800 dark:text-amber-300">
                      Note: &ldquo;{activeRevision.authorNote}&rdquo; (Saved {new Date(activeRevision.createdAt).toLocaleString()})
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRestoreRevision(activeRevision.id)}
                disabled={isRestoring}
                className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-amber-500 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isRestoring ? "Restoring..." : "Restore & Rollback to This Version"}
              </button>
            </div>
          )}

          {/* Two-Column Layout: CodeMirror Live Editor (Left) & Schema Instructions Table (Right) */}
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Left: Code Editor (7 cols) */}
            <div className="space-y-2 lg:col-span-7">
              <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400">{currentItem.dslType}</span>
                  <span className="text-[11px] text-slate-400">({currentItem.title})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFormat}
                    className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
                  >
                    Format JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-b-lg border border-slate-700 text-xs">
                <CodeMirror
                  value={editorText}
                  height="420px"
                  theme={oneDark}
                  extensions={[json()]}
                  onChange={(val) => {
                    setEditorText(val);
                    setParseError(null);
                  }}
                />
              </div>

              {parseError && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-medium text-red-600 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
                  {parseError}
                </p>
              )}
            </div>

            {/* Right: Field-Level Instructions & Schema Dictionary (5 cols) */}
            <div className="space-y-3 lg:col-span-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>Zod DSL Schema &amp; Instructions Guide</span>
                    <span className="rounded bg-violet-100 px-1 py-0.2 text-[9px] font-mono font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                      Runtime Zod
                    </span>
                  </h4>
                </div>
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setActiveDictionaryTab("fields")}
                    className={`rounded px-2 py-0.5 font-semibold ${
                      activeDictionaryTab === "fields"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Field Typing
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDictionaryTab("jurisdiction")}
                    className={`rounded px-2 py-0.5 font-semibold ${
                      activeDictionaryTab === "jurisdiction"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Jurisdiction Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDictionaryTab("zod")}
                    className={`rounded px-2 py-0.5 font-semibold flex items-center gap-1 ${
                      activeDictionaryTab === "zod"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    <span>Underlying Zod DSL</span>
                    <span className="rounded bg-amber-100 px-1 py-0.2 text-[8px] font-mono font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                      Read-Only
                    </span>
                  </button>
                </div>
              </div>

              {activeDictionaryTab === "zod" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                      {zodSchemaDef.title}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(zodSchemaDef.code);
                        setCopiedZodCode(true);
                        setTimeout(() => setCopiedZodCode(false), 2000);
                      }}
                      className="text-[11px] text-violet-600 hover:underline flex items-center gap-1"
                    >
                      {copiedZodCode ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedZodCode ? "Copied" : "Copy Zod"}
                    </button>
                  </div>
                  <div className="h-[390px] overflow-hidden rounded-lg border border-slate-200 shadow-inner dark:border-slate-800 font-mono text-xs">
                    <CodeMirror
                      value={zodSchemaDef.code}
                      height="390px"
                      theme={oneDark}
                      readOnly={true}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Read-only Zod schema boundary validating this tab&apos;s runtime payload.
                  </p>
                </div>
              ) : activeDictionaryTab === "jurisdiction" ? (
                <div className="h-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3.5 text-xs text-slate-700 shadow-inner dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <div className="mb-2.5 rounded-md bg-violet-50 p-2 text-[11px] text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
                    <strong className="block font-bold">What is Legal Entity Jurisdiction?</strong>
                    The corporate incorporation domicile of the top-level holding company issuing equity/SAFEs. Institutional VC mandates strictly check jurisdiction compatibility.
                  </div>
                  <h5 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    16 Canonical Standards &amp; Regional Aliases
                  </h5>
                  <ul className="space-y-1.5 text-[11px]">
                    <li className="rounded bg-slate-50 p-1.5 dark:bg-slate-800/60">
                      <strong>Delaware (US):</strong> Gold standard. Aliases: <em>delaware, us, usa, c-corp, new york, sf</em>.
                    </li>
                    <li className="rounded bg-slate-50 p-1.5 dark:bg-slate-800/60">
                      <strong>United Kingdom:</strong> BVCA / ASA / EIS. Aliases: <em>uk, england, london, great britain, ltd</em>.
                    </li>
                    <li className="rounded bg-slate-50 p-1.5 dark:bg-slate-800/60">
                      <strong>Hong Kong:</strong> Common Law gateway. Aliases: <em>hong kong, hk, hongkong, hksar, apac</em> (Normalized identically to Hong Kong).
                    </li>
                    <li className="rounded bg-slate-50 p-1.5 dark:bg-slate-800/60">
                      <strong>Japan:</strong> Asian finance hub. Aliases: <em>japan, jp, tokyo, kk, kabushiki kaisha</em>.
                    </li>
                    <li className="rounded bg-slate-50 p-1.5 dark:bg-slate-800/60">
                      <strong>Singapore:</strong> VIMA standard. Aliases: <em>singapore, sg, pte ltd, sea</em>.
                    </li>
                    <li className="rounded bg-slate-50 p-1.5 dark:bg-slate-800/60">
                      <strong>Cayman Islands:</strong> Offshore / Web3 foundations. Aliases: <em>cayman, offshore</em>.
                    </li>
                    <li className="rounded bg-slate-50 p-1.5 dark:bg-slate-800/60">
                      <strong>Any / Global:</strong> Borderless funds. Automatically matches any corporate jurisdiction.
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="h-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-inner dark:border-slate-800 dark:bg-slate-900">
                  <div className="space-y-3">
                    {fieldsDocumentation.map((field) => (
                      <div
                        key={field.name}
                        className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 transition-colors hover:border-slate-200 dark:border-slate-800/80 dark:bg-slate-950/40"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <code className="font-bold text-violet-700 dark:text-violet-400">
                            {field.name}
                          </code>
                          <ClassificationBadge classification={field.classification} />
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">
                          {field.description}
                        </p>
                        {field.allowedValues && (
                          <div className="mt-1.5 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              Allowed values:
                            </span>{" "}
                            {field.allowedValues.slice(0, 5).join(", ")}
                            {field.allowedValues.length > 5 && ` (+${field.allowedValues.length - 5} more)`}
                          </div>
                        )}
                        {field.examples && (
                          <div className="mt-1 text-[11px] italic text-slate-500">
                            e.g. {field.examples[0]}
                          </div>
                        )}
                        {field.notes && (
                          <div className="mt-1 rounded bg-slate-100/80 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {field.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Version Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Commit New DSL Version
              </h3>
              <p className="text-xs text-slate-500">
                Save an immutable snapshot of this DSL payload to Neon DB. Changes will also sync to deal tables.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Change Rationale / Version Note:
              </label>
              <textarea
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="e.g. Removed carbon DAC tags from subIndustries; verified water credit taxonomy"
                rows={3}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-violet-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitNewVersion}
                disabled={isSaving}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Commit Version"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassificationBadge({ classification }: { classification: FieldClassification }) {
  switch (classification) {
    case "STRICT_ENUM":
      return (
        <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
          Strict Enum
        </span>
      );
    case "CONTROLLED_TAXONOMY":
      return (
        <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
          Controlled Taxonomy + Aliases
        </span>
      );
    case "PROVENANCE_METRIC":
      return (
        <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
          Provenance-Anchored Metric
        </span>
      );
    case "FREE_TEXT":
      return (
        <span className="rounded bg-sky-100 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:bg-sky-950/70 dark:text-sky-300">
          Free Text (Document-Derived)
        </span>
      );
  }
}
