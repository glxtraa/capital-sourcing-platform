"use client";

import {
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  FileCode,
  ArrowRight,
  Lock,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";

export interface PipelineStepItem {
  id: string;
  stepNumber: number;
  label: string;
  agentBadge: string;
  milestoneRange?: string; // e.g., "M1–M2"
  topButtonHint?: string;  // e.g., "Btn 1: Extract & Spec"
  completed: boolean;
  count?: number;
  warningCount?: number;
  locked?: boolean;
}

export interface DealPipelineStepperProps {
  assetLabel: string;
  steps: PipelineStepItem[];
  activeStepId: string;
  onSelectStep: (stepId: string) => void;
  onOpenDslModal: () => void;
  onOpenTaintPolicy: () => void;
  blockingRiskCount?: number;
  extraToolbarActions?: React.ReactNode;
}

export function DealPipelineStepper({
  assetLabel,
  steps,
  activeStepId,
  onSelectStep,
  onOpenDslModal,
  onOpenTaintPolicy,
  blockingRiskCount = 0,
  extraToolbarActions,
}: DealPipelineStepperProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-3">
      {/* Top Bar: Pipeline Title + Taint Policy & DSL Studio Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1a1f3a] text-white">
            <Layers className="h-3.5 w-3.5 text-[#ff6b4a]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#1a1f3a] dark:text-neutral-200">
            {assetLabel} — Guided Agent Verification Pipeline
          </span>
          {blockingRiskCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ff6b4a]/15 border border-[#ff6b4a]/40 px-2.5 py-0.5 text-[11px] font-bold text-[#ff6b4a]">
              <ShieldAlert className="h-3.5 w-3.5" />
              {blockingRiskCount} Unverified Risk Flag{blockingRiskCount === 1 ? "" : "s"} Blocking Match
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Provenance &amp; Risk Gate Clear
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-neutral-300 dark:border-neutral-700 hover:border-emerald-500"
            onClick={onOpenTaintPolicy}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Taint Policy (Proof vs Claim)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-neutral-300 dark:border-neutral-700 hover:border-[#ff6b4a]"
            onClick={onOpenDslModal}
          >
            <FileCode className="h-3.5 w-3.5 text-[#ff6b4a]" />
            <span>Inspect &amp; Edit DSL (誠 Makoto)</span>
          </Button>

          {extraToolbarActions}
        </div>
      </div>

      {/* Clickable 4-Stage Stepper Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        {steps.map((st) => {
          const isActive = st.id === activeStepId;
          const hasWarning = (st.warningCount ?? 0) > 0;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => onSelectStep(st.id)}
              className={`group flex flex-col justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
                isActive
                  ? "border-[#1a1f3a] bg-[#1a1f3a] text-white shadow-sm dark:border-[#ff6b4a] dark:bg-neutral-800"
                  : hasWarning
                  ? "border-[#ff6b4a]/60 bg-red-50/40 text-neutral-900 hover:bg-red-50/70 dark:border-red-800 dark:bg-red-950/20 dark:text-neutral-100"
                  : st.completed
                  ? "border-emerald-200 bg-emerald-50/40 text-emerald-950 hover:border-emerald-400 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200"
                  : "border-neutral-200 bg-neutral-50/60 text-neutral-500 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-800/30 dark:text-neutral-400"
              }`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  {st.locked ? (
                    <Lock className="h-4 w-4 shrink-0 text-[#ff6b4a]" />
                  ) : hasWarning ? (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-[#ff6b4a]" />
                  ) : (
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 ${
                        isActive
                          ? "text-[#ff6b4a]"
                          : st.completed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-neutral-300 dark:text-neutral-600"
                      }`}
                    />
                  )}
                  <span className="font-bold truncate">
                    {st.stepNumber}. {st.label}
                  </span>
                </div>

                {hasWarning ? (
                  <span className="rounded-full bg-[#ff6b4a] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {st.warningCount} Verify
                  </span>
                ) : (
                  st.count !== undefined &&
                  st.count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-800/60 dark:text-emerald-100"
                      }`}
                    >
                      {st.count}
                    </span>
                  )
                )}
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[10px] opacity-80">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="font-mono">{st.agentBadge}</span>
                  {st.milestoneRange && (
                    <span
                      className={`rounded px-1 py-0.2 font-mono text-[9px] font-bold ${
                        isActive
                          ? "bg-[#ff6b4a] text-white"
                          : "bg-neutral-200/80 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
                      }`}
                    >
                      {st.milestoneRange}
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-0.5 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
                  {isActive ? "Viewing Step" : "Open Step"}
                  <ArrowRight className="h-2.5 w-2.5" />
                </span>
              </div>
              {st.topButtonHint && (
                <div className="mt-1 pt-1 border-t border-current/10 flex items-center justify-between text-[9px] font-mono opacity-75">
                  <span>Top Action: {st.topButtonHint}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
