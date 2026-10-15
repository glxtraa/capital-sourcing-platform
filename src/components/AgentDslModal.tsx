"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  FileCode,
  Info,
  Layers,
  Sparkles,
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
  agentOutput?: any;
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
  agentOutput,
  missingParameters = [],
  onClose,
  onEditParameters,
}: AgentDslModalProps) {
  const [activeTab, setActiveTab] = useState<"input" | "output">("input");
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  if (!isOpen) return null;

  const inputJsonString = JSON.stringify(dslInput || {}, null, 2);
  const outputJsonString = JSON.stringify(agentOutput || [], null, 2);

  const handleCopyInput = async () => {
    try {
      await navigator.clipboard.writeText(inputJsonString);
      setCopiedInput(true);
      setTimeout(() => setCopiedInput(false), 2000);
    } catch (err) {
      console.warn("Failed to copy input to clipboard:", err);
    }
  };

  const handleCopyOutput = async () => {
    try {
      await navigator.clipboard.writeText(outputJsonString);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    } catch (err) {
      console.warn("Failed to copy output to clipboard:", err);
    }
  };

  const hasMissing = missingParameters.length > 0;
  const hasOutput = agentOutput !== undefined && agentOutput !== null;
  const outputItemsCount = Array.isArray(agentOutput) ? agentOutput.length : null;

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

        {/* Navigation Tabs (Input vs Output) */}
        {hasOutput && (
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-800/40 px-4 pt-2 gap-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("input")}
              className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "input"
                  ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>DSL Input &amp; Context</span>
              {hasMissing && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  {missingParameters.length} missing
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("output")}
              className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "output"
                  ? "border-purple-600 text-purple-700 dark:border-purple-400 dark:text-purple-300 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              <span>Agent Output &amp; Discovered Data</span>
              {outputItemsCount !== null && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200">
                  {outputItemsCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "input" ? (
            <>
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
                    When specific domain or ICP parameters are omitted, agent reasoning defaults to high-level vertical heuristics. Fill these fields to dramatically sharpen matching precision for competitors, enterprise buyers, and strategic partners.
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
                    onClick={handleCopyInput}
                    className="h-6 text-[11px] gap-1 text-neutral-600 dark:text-neutral-300"
                  >
                    {copiedInput ? (
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
                  <code>{inputJsonString}</code>
                </pre>
              </div>
            </>
          ) : (
            /* Output Tab Content */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                    Discovered Output Results ({Array.isArray(agentOutput) ? agentOutput.length : 1})
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Real entities extracted and cross-referenced with live HTTP verification.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyOutput}
                  className="h-6 text-[11px] gap-1 text-neutral-600 dark:text-neutral-300"
                >
                  {copiedOutput ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Copied Output!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Output JSON</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Formatted Output Cards */}
              {Array.isArray(agentOutput) && agentOutput.length > 0 ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {agentOutput.map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850 space-y-1.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {item.name || item.fullName || "Entity"}
                          </span>
                          {(item.overlapDegree || item.category || item.roleCategory) && (
                            <Badge
                              tone={
                                item.overlapDegree === "DIRECT"
                                  ? "red"
                                  : item.overlapDegree === "INDIRECT"
                                  ? "amber"
                                  : "purple"
                              }
                              className="text-[10px]"
                            >
                              {(item.overlapDegree || item.category || item.roleCategory).replaceAll("_", " ")}
                            </Badge>
                          )}
                          {item.title && (
                            <span className="text-neutral-500 text-[11px]">· {item.title}</span>
                          )}
                        </div>
                        {item.websiteUrl && (
                          <a
                            href={item.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <span>{item.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                            <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                          </a>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      {item.useCaseFit && (
                        <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">Use Case: </span>
                          {item.useCaseFit}
                        </p>
                      )}

                      {item.relevanceRationale && (
                        <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">Rationale: </span>
                          {item.relevanceRationale}
                        </p>
                      )}

                      {item.knownInvestors && Array.isArray(item.knownInvestors) && item.knownInvestors.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] text-neutral-400 font-semibold uppercase">Venture Backers:</span>
                          {item.knownInvestors.map((inv: string, iIdx: number) => (
                            <span
                              key={iIdx}
                              className="px-1.5 py-0.2 rounded text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            >
                              {inv}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-neutral-500 rounded border border-dashed border-neutral-300 dark:border-neutral-700">
                  No output entities discovered yet. Run the discovery agent to populate findings.
                </div>
              )}

              {/* Raw Output JSON */}
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Raw Output JSON Payload
                </h4>
                <pre className="p-3 rounded-lg bg-neutral-900 text-neutral-100 text-xs font-mono overflow-x-auto max-h-56 border border-neutral-800">
                  <code>{outputJsonString}</code>
                </pre>
              </div>
            </div>
          )}
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
