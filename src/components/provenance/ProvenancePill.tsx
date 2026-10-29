"use client";

import React, { useState, useRef } from "react";
import type { FieldLineageNode, ActorProvenance, TaintLevel } from "@/dsl/provenance";
import { Shield, AlertTriangle, Lock, Bot, User, Zap, ExternalLink, Hash, Clock, Cpu } from "lucide-react";

interface ProvenancePillProps {
  node?: FieldLineageNode | null;
  jsonPath?: string;
  fieldLabel?: string;
  fallbackQuote?: string | null;
  fallbackFile?: string | null;
  fallbackPage?: string | null;
  fallbackTaint?: TaintLevel | string | null;
  fallbackActor?: ActorProvenance | null;
  onInspect?: () => void;
  className?: string;
}

export function ProvenancePill({
  node,
  jsonPath,
  fieldLabel,
  fallbackQuote,
  fallbackFile,
  fallbackPage,
  fallbackTaint,
  fallbackActor,
  onInspect,
  className = "",
}: ProvenancePillProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract primary candidate or fallback values
  const primaryCandidate = node?.candidates?.find((c) => c.status === "ACTIVE_WINNER") || node?.candidates?.[0];
  const taint: string = node?.activeTaint || primaryCandidate?.pointer?.taint || fallbackTaint || "UNVERIFIED_CLAIM";
  const sourceFile = primaryCandidate?.pointer?.sourceFileName || fallbackFile || "Uploaded Document";
  const pageOrSheet = primaryCandidate?.pointer?.pageOrSheet || fallbackPage;
  const verbatimQuote = primaryCandidate?.pointer?.verbatimQuote || fallbackQuote;
  const activeActor: ActorProvenance | undefined = (node?.activeActor as ActorProvenance) || (fallbackActor as ActorProvenance);
  const hasConflict = Boolean(node?.hasConflict);

  // Clean filename for compact display
  const shortFileName = sourceFile.replace(/\.[^/.]+$/, "").slice(0, 14);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), 200);
  };

  // Determine pill styling based on actor and taint
  const isHuman = activeActor?.actorType === "HUMAN_OPERATOR";
  const isAudited = taint === "AUDITED_PROOF" || taint === "HUMAN_VERIFIED";

  return (
    <div
      className={`relative inline-flex items-center text-xs select-none ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Micro-Pill Trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInspect?.();
        }}
        className={`group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all cursor-pointer ${
          isHuman
            ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-900/50"
            : isAudited
            ? "bg-slate-900/80 border-slate-700/60 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300"
            : "bg-amber-950/30 border-amber-500/30 text-amber-300 hover:border-amber-400 hover:bg-amber-900/40"
        } ${hasConflict ? "ring-1 ring-amber-400/50 animate-pulse" : ""}`}
        title="Click to view full data provenance & causal chain"
      >
        {isHuman ? (
          <>
            <User className="w-3 h-3 text-emerald-400" />
            <span>Human #{activeActor.sessionFingerprint.replace(/^sess_/, "")}</span>
            <span className="text-[10px] text-emerald-500/80">v3</span>
          </>
        ) : (
          <>
            <Bot className="w-3 h-3 text-cyan-400" />
            <span className="truncate max-w-[90px]">
              {activeActor?.actorType === "LLM_AGENT"
                ? activeActor.agentDisplayName.split(" ")[0]
                : "Makoto"}
            </span>
            <span className="text-slate-500">•</span>
            {isAudited ? (
              <Shield className="w-2.5 h-2.5 text-emerald-400 inline" />
            ) : (
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400 inline" />
            )}
            <span className="truncate max-w-[70px]">{shortFileName}</span>
            {pageOrSheet && (
              <span className="text-[10px] text-slate-400">
                {pageOrSheet.replace(/Page\s*/i, "p.")}
              </span>
            )}
          </>
        )}

        {hasConflict && (
          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/40">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            Conflict
          </span>
        )}
      </button>

      {/* Instant Hover Peek Card (<150ms) */}
      {isHovered && (
        <div
          className="absolute z-50 bottom-full left-0 mb-2 w-80 sm:w-96 p-3 rounded-xl bg-slate-950 border border-slate-700/80 shadow-2xl text-left pointer-events-auto backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {fieldLabel || jsonPath || "Datapoint Provenance"}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${
                taint === "AUDITED_PROOF"
                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/50"
                  : taint === "HUMAN_VERIFIED"
                  ? "bg-cyan-950/60 text-cyan-300 border-cyan-700/50"
                  : "bg-amber-950/60 text-amber-300 border-amber-700/50"
              }`}
            >
              {taint === "AUDITED_PROOF" && <Shield className="w-3 h-3 text-emerald-400" />}
              {taint === "HUMAN_VERIFIED" && <Lock className="w-3 h-3 text-cyan-400" />}
              {taint === "UNVERIFIED_CLAIM" && <AlertTriangle className="w-3 h-3 text-amber-400" />}
              {taint.replace(/_/g, " ")}
            </span>
          </div>

          {/* Document & Quote Excerpt */}
          <div className="mt-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span className="font-mono truncate">{sourceFile}</span>
              {pageOrSheet && <span className="text-slate-300 font-medium">{pageOrSheet}</span>}
            </div>

            {verbatimQuote ? (
              <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 italic leading-relaxed max-h-20 overflow-y-auto">
                &ldquo;{verbatimQuote}&rdquo;
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic">
                Extracted during document synthesis without raw quote anchor.
              </div>
            )}
          </div>

          {/* Actor Telemetry Summary */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
            {isHuman ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <User className="w-3 h-3" />
                  <span>Human Verification & Override</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-400 pt-1">
                  <div>
                    <span className="text-slate-500">Auth:</span> {activeActor.authMethod}
                  </div>
                  <div>
                    <span className="text-slate-500">Session:</span> {activeActor.sessionFingerprint}
                  </div>
                  <div>
                    <span className="text-slate-500">IP:</span> {activeActor.clientIp}
                  </div>
                  {activeActor.geoLocation && (
                    <div>
                      <span className="text-slate-500">Geo:</span> {activeActor.geoLocation}
                    </div>
                  )}
                </div>
                {activeActor.auditComment && (
                  <div className="text-[10px] text-slate-300 bg-emerald-950/20 border border-emerald-900/30 p-1 rounded mt-1">
                    Note: {activeActor.auditComment}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <Bot className="w-3 h-3" />
                  <span>
                    {activeActor?.actorType === "LLM_AGENT"
                      ? activeActor.agentDisplayName
                      : "LLM Agent Extraction"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 text-[10px] text-slate-400 pt-1">
                  <div>
                    <span className="text-slate-500">Model:</span>{" "}
                    {activeActor?.actorType === "LLM_AGENT"
                      ? activeActor.modelSlug.split("/").pop()
                      : "deepseek-v4"}
                  </div>
                  <div>
                    <span className="text-slate-500">Prompt:</span>{" "}
                    {activeActor?.actorType === "LLM_AGENT"
                      ? `#${activeActor.promptSha256.slice(0, 6)}`
                      : "#auto"}
                  </div>
                  {activeActor?.actorType === "LLM_AGENT" && activeActor.ocrEngine && (
                    <div>
                      <span className="text-slate-500">OCR:</span> {activeActor.ocrEngine}
                    </div>
                  )}
                  {activeActor?.actorType === "LLM_AGENT" && activeActor.latencyMs && (
                    <div>
                      <span className="text-slate-500">Speed:</span> {(activeActor.latencyMs / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Trigger */}
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Click pill for full 5-hop lineage</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsHovered(false);
                onInspect?.();
              }}
              className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
            >
              Open X-Ray <ExternalLink className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
