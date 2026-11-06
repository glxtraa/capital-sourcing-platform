"use client";

import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui/primitives";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  RotateCw,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  X,
} from "lucide-react";

export interface AgentTrialItem {
  id: string;
  runId: string | null;
  dealId: string | null;
  assetClass: string;
  stage: string;
  trialNumber: number;
  status: "SUCCESS" | "FAILED_GATE" | "FAILED_SCHEMA" | "FAILED_HTTP" | "RETRYING";
  entityName: string | null;
  inputSummary: string | null;
  extractedPayload: any;
  failureReason: string | null;
  promptFeedback: string | null;
  diagnosticsJson: any;
  durationMs: number | null;
  createdAt: string;
}

interface AgentTrialsAuditDrawerProps {
  dealId?: string;
  runId?: string;
  assetClass?: "INVOICE" | "TRADE" | "VC";
  isOpen: boolean;
  onClose: () => void;
}

export function AgentTrialsAuditDrawer({
  dealId,
  runId,
  assetClass,
  isOpen,
  onClose,
}: AgentTrialsAuditDrawerProps) {
  const [trials, setTrials] = useState<AgentTrialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchTrials() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dealId) params.set("dealId", dealId);
      if (runId) params.set("runId", runId);
      if (assetClass) params.set("assetClass", assetClass);

      const res = await fetch(`/api/agent-trials?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTrials(data.trials || []);
        if (data.trials?.length > 0 && !expandedId) {
          setExpandedId(data.trials[0].id);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch agent trials:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchTrials();
    }
  }, [isOpen, dealId, runId, assetClass]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 text-slate-100 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Agent Trials &amp; Grounding Audit
                <span className="text-[11px] font-normal text-slate-400 font-mono">
                  ({trials.length} trial{trials.length === 1 ? "" : "s"} recorded)
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every agent attempt, intercepted hallucination, and autonomous feedback cycle.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTrials}
              disabled={loading}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 h-8 gap-1.5"
            >
              <RotateCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {loading && trials.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-500">
              <RotateCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
              Loading execution trials…
            </div>
          ) : trials.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl p-6">
              <ShieldAlert className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">No trials recorded yet for this deal</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Trials are recorded live whenever the research structuring agent attempts to write candidates and gets tested by the DSL Grounding Gate.
              </p>
            </div>
          ) : (
            trials.map((trial) => {
              const isExpanded = expandedId === trial.id;
              const isFailed = trial.status.startsWith("FAILED");
              const isSuccess = trial.status === "SUCCESS";

              return (
                <div
                  key={trial.id}
                  className={`rounded-xl border transition-all ${
                    isFailed
                      ? "border-red-900/50 bg-red-950/20 hover:border-red-800/60"
                      : isSuccess
                      ? "border-emerald-900/50 bg-emerald-950/20 hover:border-emerald-800/60"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                  }`}
                >
                  {/* Header Row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : trial.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-800 text-[11px] font-mono font-bold text-slate-300">
                        #{trial.trialNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">
                            {trial.entityName || "Unnamed Entity"}
                          </span>
                          <Badge
                            tone={isFailed ? "red" : isSuccess ? "green" : "amber"}
                            className="text-[10px] px-1.5 py-0.5"
                          >
                            {trial.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono text-slate-500">{trial.stage}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" />
                            {new Date(trial.createdAt).toLocaleTimeString()}
                          </span>
                          {trial.durationMs && (
                            <>
                              <span>•</span>
                              <span>{(trial.durationMs / 1000).toFixed(1)}s</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-800/80 text-xs">
                      {/* Failure Reason Alert */}
                      {trial.failureReason && (
                        <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-200">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-xs text-red-300">DSL Grounding Gate Rejection:</p>
                              <p className="mt-0.5 text-red-200 text-xs leading-relaxed">{trial.failureReason}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Success Notice */}
                      {isSuccess && (
                        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-200">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            <p className="text-xs font-medium text-emerald-200">
                              Verification Passed: Clean entity successfully saved to database.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Prompt Feedback Sent to Next Attempt */}
                      {trial.promptFeedback && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-indigo-400 text-[11px] font-semibold">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Corrective Feedback Passed to Agent for Self-Recovery:</span>
                          </div>
                          <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/50 font-mono text-[11px] text-indigo-200 whitespace-pre-wrap leading-relaxed">
                            {trial.promptFeedback}
                          </div>
                        </div>
                      )}

                      {/* Extracted Payload Snapshot */}
                      {trial.extractedPayload && (
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold text-slate-400">Extracted Candidate Payload:</p>
                          <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto">
                            {JSON.stringify(trial.extractedPayload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
