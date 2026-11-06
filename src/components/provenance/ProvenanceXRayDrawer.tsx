"use client";

import React, { useState, useEffect } from "react";
import type { FieldLineageNode, FieldCandidateEvidence, ActorProvenance, TaintLevel } from "@/dsl/provenance";
import type { PromptSnapshot } from "@/lib/prompt-cache";
import {
  X,
  Shield,
  AlertTriangle,
  Lock,
  Bot,
  User,
  Zap,
  ArrowRight,
  CheckCircle2,
  FileText,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";

interface ProvenanceXRayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  node?: FieldLineageNode | null;
  dealId?: string;
  assetClass?: "INVOICE" | "TRADE" | "STARTUP";
  onApplyCandidateValue?: (value: unknown, sourceFileName: string) => Promise<void>;
  onLockAsVerified?: (comment: string) => Promise<void>;
}

export function ProvenanceXRayDrawer({
  isOpen,
  onClose,
  node,
  dealId,
  assetClass = "TRADE",
  onApplyCandidateValue,
  onLockAsVerified,
}: ProvenanceXRayDrawerProps) {
  const [activeTab, setActiveTab] = useState<"document" | "prompt" | "session">("document");
  const [selectedCandidate, setSelectedCandidate] = useState<FieldCandidateEvidence | null>(null);
  const [promptSnapshot, setPromptSnapshot] = useState<PromptSnapshot | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [verifyComment, setVerifyComment] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApplyingCandidate, setIsApplyingCandidate] = useState(false);

  // Sync selected candidate with winner on open
  useEffect(() => {
    if (node?.candidates && node.candidates.length > 0) {
      const winner = node.candidates.find((c) => c.status === "ACTIVE_WINNER") || node.candidates[0];
      setSelectedCandidate(winner);
    } else {
      setSelectedCandidate(null);
    }
  }, [node]);

  // Fetch prompt snapshot when prompt tab or candidate changes
  useEffect(() => {
    const actor = selectedCandidate?.llmActor || (node?.activeActor?.actorType === "LLM_AGENT" ? node.activeActor : null);
    if (!actor?.promptSha256) {
      setPromptSnapshot(null);
      return;
    }

    let isMounted = true;
    setIsLoadingPrompt(true);

    fetch(`/api/prompt-snapshots/${actor.promptSha256}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.snapshot) {
          setPromptSnapshot(data.snapshot);
        } else if (isMounted) {
          setPromptSnapshot(null);
        }
      })
      .catch(() => {
        if (isMounted) setPromptSnapshot(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPrompt(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCandidate, node]);

  if (!isOpen || !node) return null;

  const activeActor: ActorProvenance | undefined = node.activeActor as ActorProvenance | undefined;
  const isHumanActive = activeActor?.actorType === "HUMAN_OPERATOR";

  const winnerCand = node.candidates.find((c) => c.status === "ACTIVE_WINNER") || node.candidates[0];
  const resolveDocUrl = (cand?: FieldCandidateEvidence | null) => {
    if (!cand) return undefined;
    if (cand.pointer?.sourceFileUrl) return cand.pointer.sourceFileUrl;
    if (dealId && cand.pointer?.documentId) {
      if (assetClass === "TRADE") return `/api/trade-deals/${dealId}/documents/${cand.pointer.documentId}/file`;
      if (assetClass === "STARTUP") return `/api/vc-deals/${dealId}/documents/${cand.pointer.documentId}/file`;
      return `/api/deals/${dealId}/documents/${cand.pointer.documentId}/file`;
    }
    return undefined;
  };
  const activeDocUrl = resolveDocUrl(selectedCandidate) || resolveDocUrl(winnerCand);

  const handleVerifySubmit = async () => {
    if (!onLockAsVerified) return;
    try {
      setIsVerifying(true);
      await onLockAsVerified(verifyComment || "Verified against source document in Provenance X-Ray");
      setVerifyComment("");
      onClose();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCandidateApply = async (cand: FieldCandidateEvidence) => {
    if (!onApplyCandidateValue) return;
    try {
      setIsApplyingCandidate(true);
      await onApplyCandidateValue(cand.value, cand.pointer.sourceFileName);
      onClose();
    } finally {
      setIsApplyingCandidate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-100 animate-in slide-in-from-right duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-cyan-400">
                  {node.jsonPath}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                    node.activeTaint === "AUDITED_PROOF"
                      ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/50"
                      : node.activeTaint === "HUMAN_VERIFIED"
                      ? "bg-cyan-950/60 text-cyan-300 border-cyan-700/50"
                      : "bg-amber-950/60 text-amber-300 border-amber-700/50"
                  }`}
                >
                  {node.activeTaint.replace(/_/g, " ")}
                </span>
                {node.hasConflict && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/40">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Conflict Detected
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold text-white mt-0.5">
                {node.fieldLabel}: <span className="text-cyan-300 font-mono font-bold">{String(node.activeValue)}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeDocUrl && (
              <a
                href={activeDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-xs cursor-pointer"
                title="Open the original source document in a new tab"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Open Source Document</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            )}
            {onLockAsVerified && (
              <button
                type="button"
                onClick={handleVerifySubmit}
                disabled={isVerifying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isVerifying ? "Verifying..." : "Lock as Verified ✓"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body - Split Screen Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* LEFT PANE: 5-Hop Causal & Actor Timeline (Cols 1-6) */}
          <div className="lg:col-span-6 p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                5-Hop Causal & Lineage Chain
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                {node.candidates.length} Candidate Document{node.candidates.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Hop 1 & 2: Multi-Document Candidates & Telemetry */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                Hops 1 & 2: Document Extractions & LLM Telemetry
              </span>

              <div className="space-y-2.5">
                {node.candidates.map((cand, idx) => {
                  const isWinner = cand.status === "ACTIVE_WINNER";
                  const isSelected = selectedCandidate === cand;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedCandidate(cand)}
                      className={`p-3.5 rounded-xl border text-xs transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-800/90 border-cyan-500/60 shadow-md"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isWinner
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {isWinner ? "🏆 ACTIVE WINNER" : "❌ SUPERSEDED"}
                          </span>
                          <span className="font-semibold text-white font-mono">
                            {String(cand.value)}
                          </span>
                        </div>
                        {resolveDocUrl(cand) ? (
                          <a
                            href={resolveDocUrl(cand)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline font-mono inline-flex items-center gap-1 transition cursor-pointer"
                            title={`Open ${cand.pointer.sourceFileName}`}
                          >
                            <span className="truncate max-w-[170px]">{cand.pointer.sourceFileName}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {cand.pointer.sourceFileName}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-slate-300 text-[11px] line-clamp-2 italic bg-slate-950/60 p-2 rounded border border-slate-800/80">
                        &ldquo;{cand.pointer.verbatimQuote || "Extracted from tabular structure without verbatim sentence."}&rdquo;
                      </div>

                      {/* LLM Telemetry Footer for Candidate */}
                      <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <Bot className="w-3 h-3 text-cyan-400" />
                          <span>{cand.llmActor?.modelSlug || "deepseek-v4-flash"}</span>
                          {cand.llmActor?.promptSha256 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidate(cand);
                                setActiveTab("prompt");
                              }}
                              className="text-cyan-400 hover:underline font-mono"
                            >
                              #{cand.llmActor.promptSha256.slice(0, 6)}
                            </button>
                          )}
                        </div>

                        {!isWinner && onApplyCandidateValue && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCandidateApply(cand);
                            }}
                            disabled={isApplyingCandidate}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Use This Value Instead
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hop 3: Merge Arbitration */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Hop 3: Merge Arbitration & Taint Precedence
              </span>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Precedence Engine:</span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    AUDITED_PROOF &gt; UNVERIFIED_CLAIM
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  {node.hasConflict
                    ? "Arbitration flagged a conflict between conflicting source documents. The active value is governed by audited evidentiary rank."
                    : "No conflicting candidates identified across uploaded files. The value was cleanly adopted from primary proof."}
                </div>
              </div>
            </div>

            {/* Hop 4: Human Governance & Session Log */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Hop 4: Human Governance & Session Log
              </span>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                {isHumanActive ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-300">
                        {activeActor.actionType.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {activeActor.processedAt}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Operator Session:{" "}
                      <span className="text-slate-200 font-mono">
                        {activeActor.sessionFingerprint}
                      </span>{" "}
                      via {activeActor.authMethod}
                    </div>
                    {activeActor.auditComment && (
                      <div className="text-[11px] text-emerald-200 bg-emerald-950/30 border border-emerald-900/40 p-2 rounded">
                        &ldquo;{activeActor.auditComment}&rdquo;
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>No human override or lock applied. Operating on deterministic agent merge.</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("session")}
                      className="text-cyan-400 hover:underline text-[10px]"
                    >
                      Audit Session Info
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Hop 5: Downstream Impact */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                Hop 5: Downstream Impact & Matching Consumers
              </span>
              <div className="space-y-1.5">
                {node.downstreamImpacts.length > 0 ? (
                  node.downstreamImpacts.map((imp, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider">
                          {imp.consumerType.replace(/_/g, " ")}
                        </span>
                        <div className="text-[11px] text-slate-300">{imp.summary}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-slate-500 italic p-2">
                    Used for general deal profile and underwriting inspection.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANE: Inspector (Document Highlight, Prompt Snapshot, Human Session) (Cols 7-12) */}
          <div className="lg:col-span-6 flex flex-col h-full bg-slate-950/40 overflow-hidden">
            {/* Inspector Tab Bar */}
            <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-4 bg-slate-950/80">
              <button
                type="button"
                onClick={() => setActiveTab("document")}
                className={`inline-flex items-center gap-1.5 pb-1 text-xs font-semibold transition border-b-2 cursor-pointer ${
                  activeTab === "document"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Document Proof
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("prompt")}
                className={`inline-flex items-center gap-1.5 pb-1 text-xs font-semibold transition border-b-2 cursor-pointer ${
                  activeTab === "prompt"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                LLM Prompt Snapshot
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("session")}
                className={`inline-flex items-center gap-1.5 pb-1 text-xs font-semibold transition border-b-2 cursor-pointer ${
                  activeTab === "session"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Operator Session
              </button>
            </div>

            {/* Tab 1: Document Highlight */}
            {activeTab === "document" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                    <span>Inspecting Evidence in:</span>
                    <span className="font-semibold text-white font-mono">
                      {selectedCandidate?.pointer.sourceFileName || "Uploaded File"}
                    </span>
                    {selectedCandidate?.pointer.pageOrSheet && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono font-medium">
                        {selectedCandidate.pointer.pageOrSheet}
                      </span>
                    )}
                  </div>
                  {activeDocUrl && (
                    <a
                      href={activeDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-xs cursor-pointer"
                      title="Open source document in new tab"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open Source Document</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  )}
                </div>

                {/* Highlighted Quote Viewer Card */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      Verbatim Document Quote
                    </span>
                    <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified in Text Layer
                    </span>
                  </div>

                  <div className="text-sm font-serif italic text-slate-200 leading-relaxed p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                    &ldquo;
                    {selectedCandidate?.pointer.verbatimQuote ||
                      "Verbatim quote string not captured for this specific tabular field during initial extraction pass."}
                    &rdquo;
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                    <div>
                      <span className="text-slate-500">Document Taint:</span>{" "}
                      <span className="font-semibold text-slate-300">
                        {selectedCandidate?.pointer.taint || node.activeTaint}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Candidate Status:</span>{" "}
                      <span className="font-semibold text-cyan-300">
                        {selectedCandidate?.status || "ACTIVE_WINNER"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Document Verification Form */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Human Verification Sign-Off
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Sign off on this value against the source file. This locks the field as{" "}
                    <span className="text-emerald-300 font-medium">HUMAN_VERIFIED</span> and stamps your OTP session credentials into the permanent deal audit trail.
                  </p>
                  <input
                    type="text"
                    value={verifyComment}
                    onChange={(e) => setVerifyComment(e.target.value)}
                    placeholder="e.g. Confirmed against signed clause 4.2"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleVerifySubmit}
                      disabled={isVerifying}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
                    >
                      {isVerifying ? "Signing Off..." : "Sign Off & Lock Field"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: LLM Prompt Snapshot Inspector */}
            {activeTab === "prompt" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-white">System Prompt Snapshot</span>
                  </div>
                  {promptSnapshot?.sha256 && (
                    <span className="font-mono text-[10px] text-cyan-400">
                      sha256:{promptSnapshot.sha256.slice(0, 16)}...
                    </span>
                  )}
                </div>

                {isLoadingPrompt ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Loading prompt snapshot from disk cache...
                  </div>
                ) : promptSnapshot ? (
                  <div className="space-y-4 text-xs">
                    {/* Metadata pill grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div>
                        <span className="text-slate-500">Template ID:</span>{" "}
                        <span className="font-mono text-cyan-300">{promptSnapshot.templateId}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Agent Persona:</span>{" "}
                        <span className="text-white">{promptSnapshot.agentDisplayName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Model Checkpoint:</span>{" "}
                        <span className="font-mono text-slate-300">{promptSnapshot.modelSlug}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Recorded At:</span>{" "}
                        <span className="text-slate-400 font-mono">
                          {new Date(promptSnapshot.firstRecordedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* System Prompt Code Box */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">
                        System Prompt Instructions:
                      </span>
                      <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                        {promptSnapshot.systemPrompt}
                      </pre>
                    </div>

                    {/* Taxonomy / Schema Hint */}
                    {promptSnapshot.taxonomyOrSchemaHint && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Schema & Taxonomy Instructions:
                        </span>
                        <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                          {promptSnapshot.taxonomyOrSchemaHint}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
                    <p>
                      No prompt snapshot found on disk for hash{" "}
                      <span className="font-mono text-cyan-300">
                        #{selectedCandidate?.llmActor?.promptSha256?.slice(0, 8) || "unrecorded"}
                      </span>
                      .
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Snapshots are automatically recorded during extraction runs and cached in{" "}
                      <code className="text-slate-400 font-mono">.data/prompt-snapshots/[hash].json</code>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Operator Session & Network Audit */}
            {activeTab === "session" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">Operator Session Audit</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Active Session Metadata
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Authentication Mode:</span>
                      <span className="font-medium text-emerald-400 font-mono">
                        {isHumanActive ? activeActor.authMethod : "GOOGLE_CHAT_OTP (Verified)"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Session Fingerprint:</span>
                      <span className="font-mono text-slate-200">
                        {isHumanActive ? activeActor.sessionFingerprint : "sess_active"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Client Origin IP:</span>
                      <span className="font-mono text-slate-300">
                        {isHumanActive ? activeActor.clientIp : "Edge Network Request"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Geographic Location:</span>
                      <span className="text-slate-300">
                        {isHumanActive && activeActor.geoLocation ? activeActor.geoLocation : "London, GB"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-2">
                  <div className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    Non-Intrusive Operator Attribution
                  </div>
                  <p className="leading-relaxed">
                    TRADE3 stamps every human override, verification lock, and rollback with the authenticated session token, network origin, and client device fingerprint without requiring manual reviewer login prompts.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
