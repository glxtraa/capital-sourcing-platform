"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  FileCode,
  Info,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";

export interface MissingParameterInfo {
  name: string;
  description: string;
  suggestedFix: string;
}

export interface AgentDslModalProps {
  isOpen: boolean;
  agentName: string;
  agentFlow: string;
  description: string;
  dslInput: any;
  missingParameters?: MissingParameterInfo[];
  onClose: () => void;
  onEditParameters?: () => void;
}

export function AgentDslModal({
  isOpen,
  agentName,
  agentFlow,
  description,
  dslInput,
  missingParameters = [],
  onClose,
  onEditParameters,
}: AgentDslModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonString = JSON.stringify(dslInput || {}, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy to clipboard:", err);
    }
  };

  const hasMissing = missingParameters.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100">
                  {agentName}
                </h3>
                <Badge tone="purple" className="text-[10px] font-mono">
                  {agentFlow}
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Missing Parameters Warning Block */}
          {hasMissing ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Missing or Defaulted Parameters ({missingParameters.length})
                  </span>
                </div>
                {onEditParameters && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onEditParameters();
                    }}
                    className="h-7 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50"
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit Parameters &amp; ICP
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
                When specific domain or ICP parameters are omitted, agent reasoning defaults to high-level vertical heuristics. Fill these fields to dramatically sharpen matching precision for enterprise buyers and strategic partners.
              </p>
              <div className="space-y-1.5 pt-1">
                {missingParameters.map((param) => (
                  <div
                    key={param.name}
                    className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 text-xs bg-white/60 dark:bg-neutral-900/60 p-2 rounded border border-amber-200/50 dark:border-amber-900/30"
                  >
                    <span className="font-mono font-semibold text-amber-900 dark:text-amber-200 shrink-0">
                      {param.name}:
                    </span>
                    <span className="text-neutral-600 dark:text-neutral-400 text-[11px]">
                      {param.description} —{" "}
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        {param.suggestedFix}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  All high-leverage DSL parameters are populated. The agent will perform deep domain-tailored matching.
                </span>
              </div>
              {onEditParameters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onEditParameters();
                  }}
                  className="h-6 text-[11px] gap-1 border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  Edit
                </Button>
              )}
            </div>
          )}

          {/* Key Parameters Summary Grid */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Active Extraction &amp; Context Attributes
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                  Company &amp; Stage
                </span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {dslInput?.companyName || "Unknown"} · {dslInput?.stage || "SEED"}
                </span>
              </div>

              <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                  Primary Vertical &amp; Jurisdiction
                </span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {dslInput?.primaryVertical || "B2B_SAAS"} · {dslInput?.jurisdiction || "Delaware (US)"}
                </span>
              </div>

              <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                  Specific Industry / Niche
                </span>
                <span
                  className={
                    dslInput?.industry
                      ? "font-medium text-neutral-900 dark:text-neutral-100"
                      : "italic text-amber-600 dark:text-amber-400"
                  }
                >
                  {dslInput?.industry || "Not specified (using vertical default)"}
                </span>
              </div>

              <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                  Sub-Industries / Tags
                </span>
                <span
                  className={
                    Array.isArray(dslInput?.subIndustries) && dslInput.subIndustries.length > 0
                      ? "font-medium text-neutral-900 dark:text-neutral-100"
                      : "italic text-amber-600 dark:text-amber-400"
                  }
                >
                  {Array.isArray(dslInput?.subIndustries) && dslInput.subIndustries.length > 0
                    ? dslInput.subIndustries.join(", ")
                    : "Not specified"}
                </span>
              </div>

              <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 sm:col-span-2">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                  Target Customer Profile (ICP)
                </span>
                <span
                  className={
                    dslInput?.targetCustomerProfile
                      ? "font-medium text-neutral-900 dark:text-neutral-100"
                      : "italic text-amber-600 dark:text-amber-400"
                  }
                >
                  {dslInput?.targetCustomerProfile || "Not specified (defaults to general B2B enterprise)"}
                </span>
              </div>

              {dslInput?.businessModel && (
                <div className="p-2.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 sm:col-span-2">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                    Business &amp; Monetization Model
                  </span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {dslInput.businessModel}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Raw JSON Input Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Raw DSL Input Payload (Fed to Agent)
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="h-6 text-[11px] gap-1 text-neutral-600 dark:text-neutral-300"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy JSON</span>
                  </>
                )}
              </Button>
            </div>
            <pre className="p-3 rounded-lg bg-neutral-900 text-neutral-100 text-xs font-mono overflow-x-auto max-h-64 border border-neutral-800">
              <code>{jsonString}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>Updates made in Edit Deal instantly update agent queries</span>
          </div>
          <div className="flex items-center gap-2">
            {onEditParameters && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onEditParameters();
                }}
                className="text-xs gap-1.5"
              >
                <Edit3 className="h-3 w-3" />
                Edit Parameters
              </Button>
            )}
            <Button size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
