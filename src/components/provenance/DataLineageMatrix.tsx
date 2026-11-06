"use client";

import React, { useState, useMemo } from "react";
import type { FieldLineageMap, FieldLineageNode, ActorProvenance } from "@/dsl/provenance";
import {
  Shield,
  AlertTriangle,
  Lock,
  Bot,
  User,
  Zap,
  Search,
  Filter,
  ExternalLink,
  Layers,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface DataLineageMatrixProps {
  fieldLineage?: FieldLineageMap | null;
  onInspectNode?: (node: FieldLineageNode) => void;
  className?: string;
}

export function DataLineageMatrix({
  fieldLineage,
  onInspectNode,
  className = "",
}: DataLineageMatrixProps) {
  const [filterType, setFilterType] = useState<"ALL" | "LLM" | "HUMAN" | "CONFLICT" | "UNVERIFIED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const nodes = useMemo(() => {
    if (!fieldLineage) return [];
    const seen = new Set<string>();
    const uniqueList: FieldLineageNode[] = [];
    for (const node of Object.values(fieldLineage)) {
      if (node && node.jsonPath && !seen.has(node.jsonPath)) {
        seen.add(node.jsonPath);
        uniqueList.push(node);
      }
    }
    return uniqueList;
  }, [fieldLineage]);

  // Compute evidentiary audit metrics
  const metrics = useMemo(() => {
    const total = nodes.length;
    if (total === 0) return { total: 0, auditedPct: 100, conflicts: 0, llmCount: 0, humanCount: 0, unverifiedCount: 0 };

    const auditedOrVerified = nodes.filter(
      (n) => n.activeTaint === "AUDITED_PROOF" || n.activeTaint === "HUMAN_VERIFIED"
    ).length;
    const conflicts = nodes.filter((n) => n.hasConflict).length;
    const humanCount = nodes.filter(
      (n) => (n.activeActor as ActorProvenance)?.actorType === "HUMAN_OPERATOR"
    ).length;
    const llmCount = nodes.filter(
      (n) => (n.activeActor as ActorProvenance)?.actorType === "LLM_AGENT" || !(n.activeActor as ActorProvenance)
    ).length;
    const unverifiedCount = nodes.filter((n) => n.activeTaint === "UNVERIFIED_CLAIM").length;

    return {
      total,
      auditedPct: Math.round((auditedOrVerified / total) * 100),
      conflicts,
      llmCount,
      humanCount,
      unverifiedCount,
    };
  }, [nodes]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      // 1. Category Filter
      if (filterType === "CONFLICT" && !node.hasConflict) return false;
      if (filterType === "UNVERIFIED" && node.activeTaint !== "UNVERIFIED_CLAIM") return false;
      if (filterType === "HUMAN" && (node.activeActor as ActorProvenance)?.actorType !== "HUMAN_OPERATOR") return false;
      if (filterType === "LLM" && (node.activeActor as ActorProvenance)?.actorType === "HUMAN_OPERATOR") return false;

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = node.fieldLabel.toLowerCase().includes(q);
        const matchesPath = node.jsonPath.toLowerCase().includes(q);
        const matchesVal = String(node.activeValue).toLowerCase().includes(q);
        const matchesDoc = node.candidates.some((c) =>
          c.pointer.sourceFileName.toLowerCase().includes(q)
        );
        return matchesLabel || matchesPath || matchesVal || matchesDoc;
      }

      return true;
    });
  }, [nodes, filterType, searchQuery]);

  if (!fieldLineage || nodes.length === 0) {
    return (
      <div className={`p-8 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 ${className}`}>
        <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-300">No Field Lineage Recorded</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Field lineage is automatically generated during multi-document extraction and reconciliation. Upload data room documents to build an end-to-end evidentiary audit trail.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Metrics Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Data Lineage & Actor Audit Matrix</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Traceable causal lineage across {metrics.total} canonical fields from source documents to matching gates.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Evidentiary Score
            </span>
            <span
              className={`text-lg font-bold font-mono ${
                metrics.auditedPct >= 80
                  ? "text-emerald-400"
                  : metrics.auditedPct >= 50
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
            >
              {metrics.auditedPct}% Audited 🛡️
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
              filterType === "ALL"
                ? "bg-slate-800 border-cyan-500/60 text-cyan-300"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            All Fields ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("LLM")}
            className={`px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1.5 ${
              filterType === "LLM"
                ? "bg-slate-800 border-cyan-500/60 text-cyan-300"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bot className="w-3 h-3 text-cyan-400" />
            LLM Extracted ({metrics.llmCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("HUMAN")}
            className={`px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1.5 ${
              filterType === "HUMAN"
                ? "bg-slate-800 border-emerald-500/60 text-emerald-300"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="w-3 h-3 text-emerald-400" />
            Human Overridden / Verified ({metrics.humanCount})
          </button>
          {metrics.conflicts > 0 && (
            <button
              type="button"
              onClick={() => setFilterType("CONFLICT")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                filterType === "CONFLICT"
                  ? "bg-amber-950/80 border-amber-500 text-amber-300"
                  : "bg-amber-950/30 border-amber-800/60 text-amber-400 hover:text-amber-200"
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              Conflicts ({metrics.conflicts})
            </button>
          )}
          {metrics.unverifiedCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType("UNVERIFIED")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                filterType === "UNVERIFIED"
                  ? "bg-slate-800 border-amber-500/60 text-amber-300"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Unverified ({metrics.unverifiedCount})
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search field, value, doc..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Lineage Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
          <thead className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Canonical DSL Field</th>
              <th className="px-4 py-3">Primary Source Evidence</th>
              <th className="px-4 py-3">Active Value</th>
              <th className="px-4 py-3">Processor (Who/How)</th>
              <th className="px-4 py-3">Audit Trace</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredNodes.map((node, idx) => {
              const activeActor: ActorProvenance | undefined = node.activeActor as ActorProvenance | undefined;
              const isHuman = activeActor?.actorType === "HUMAN_OPERATOR";
              const primaryCand =
                node.candidates.find((c) => c.status === "ACTIVE_WINNER") || node.candidates[0];

              return (
                <tr
                  key={node.jsonPath || idx}
                  className="hover:bg-slate-900/50 transition cursor-pointer group"
                  onClick={() => onInspectNode?.(node)}
                >
                  {/* Field Name & Path */}
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white group-hover:text-cyan-300 transition">
                        {node.fieldLabel}
                      </span>
                      {node.hasConflict && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold border border-amber-500/40">
                          <Zap className="w-2.5 h-2.5 text-amber-400" />
                          Conflict
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 block truncate max-w-[200px]">
                      {node.jsonPath}
                    </span>
                  </td>

                  {/* Primary Evidence */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                      {primaryCand?.pointer?.sourceFileUrl ? (
                        <a
                          href={primaryCand.pointer.sourceFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="truncate max-w-[170px] font-mono text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1 transition cursor-pointer"
                          title={`Open ${primaryCand.pointer.sourceFileName}`}
                        >
                          <span className="truncate">{primaryCand.pointer.sourceFileName}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <span className="truncate max-w-[170px] font-mono text-[11px]">
                          {primaryCand?.pointer?.sourceFileName || "Uploaded File"}
                        </span>
                      )}
                    </div>
                    {primaryCand?.pointer?.pageOrSheet && (
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {primaryCand.pointer.pageOrSheet}
                      </span>
                    )}
                  </td>

                  {/* Active Value & Taint */}
                  <td className="px-4 py-3">
                    <div className="font-semibold font-mono text-white">
                      {String(node.activeValue)}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase border mt-0.5 ${
                        node.activeTaint === "AUDITED_PROOF"
                          ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/50"
                          : node.activeTaint === "HUMAN_VERIFIED"
                          ? "bg-cyan-950/60 text-cyan-300 border-cyan-700/50"
                          : "bg-amber-950/60 text-amber-300 border-amber-700/50"
                      }`}
                    >
                      {node.activeTaint === "AUDITED_PROOF" && <Shield className="w-2.5 h-2.5 text-emerald-400" />}
                      {node.activeTaint === "HUMAN_VERIFIED" && <Lock className="w-2.5 h-2.5 text-cyan-400" />}
                      {node.activeTaint === "UNVERIFIED_CLAIM" && <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
                      {node.activeTaint.replace(/_/g, " ")}
                    </span>
                  </td>

                  {/* Processor */}
                  <td className="px-4 py-3">
                    {isHuman ? (
                      <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                        <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div>
                          <span className="block text-[11px]">Human Verified</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {activeActor.sessionFingerprint}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Bot className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div>
                          <span className="block text-[11px] font-medium text-slate-200">
                            {activeActor?.actorType === "LLM_AGENT"
                              ? activeActor.agentDisplayName.split(" ")[0]
                              : "Makoto"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {activeActor?.actorType === "LLM_AGENT"
                              ? activeActor.modelSlug.split("/").pop()
                              : "deepseek-v4"}
                          </span>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Audit Trace */}
                  <td className="px-4 py-3 text-[11px] text-slate-400 font-mono">
                    {isHuman ? (
                      <div>
                        <span>{activeActor.clientIp}</span>
                        <span className="text-[10px] text-slate-500 block">
                          {activeActor.geoLocation || "Verified Session"}
                        </span>
                      </div>
                    ) : (
                      <div>
                        {activeActor?.actorType === "LLM_AGENT" && activeActor.promptSha256 ? (
                          <span className="text-cyan-400 font-mono">
                            sha256:#{activeActor.promptSha256.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-500">Deterministic</span>
                        )}
                        <span className="text-[10px] text-slate-500 block">
                          {activeActor?.actorType === "LLM_AGENT" && activeActor.latencyMs
                            ? `${(activeActor.latencyMs / 1000).toFixed(1)}s pass`
                            : "Automated pass"}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectNode?.(node);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium px-2 py-1 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                      Inspect <ExternalLink className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
