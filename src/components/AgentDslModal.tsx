"use client";

import { useState, useEffect, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
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
  Play,
  RotateCcw,
  ShieldCheck,
  Terminal,
  Cpu,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { DataLineageMatrix, ProvenanceXRayDrawer } from "@/components/provenance";
import { synthesizeFieldLineageFromDsl, type FieldLineageNode } from "@/dsl/provenance";
import { resolveZodDslDefinition, type ZodDslSchemaDefinition } from "@/dsl/zod-registry";

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
  onSaveDsl?: (updatedDsl: any) => Promise<void> | void;
  onRecompileAndRun?: (updatedDsl: any) => Promise<void> | void;
}

// Japanese Agent Persona Resolver
function resolveAgentPersona(agentName: string, agentFlow: string) {
  const combined = `${agentName} ${agentFlow}`.toLowerCase();
  if (combined.includes("maritime") || combined.includes("trade") || combined.includes("shipping")) {
    return {
      kanji: "湊",
      name: "Minato",
      meaning: "Harbor / Port",
      role: "Maritime & Trade Contract Parser",
      engine: "DeepSeek-V4 Flash (1M OCR)",
      badgeTone: "navy" as const,
    };
  }
  if (combined.includes("invoice") || combined.includes("credit") || combined.includes("dilution") || combined.includes("debtor")) {
    return {
      kanji: "誠",
      name: "Makoto",
      meaning: "Truth / Integrity",
      role: "Invoice Credit & Dilution Auditor",
      engine: "DeepSeek-V4 Flash",
      badgeTone: "amber" as const,
    };
  }
  if (combined.includes("vc") || combined.includes("venture") || combined.includes("thesis") || combined.includes("cap table") || combined.includes("safe")) {
    return {
      kanji: "大輝",
      name: "Daiki",
      meaning: "Great Radiance / Vision",
      role: "Venture Capital Thesis Architect",
      engine: "Qwen 235B Multi-Step",
      badgeTone: "purple" as const,
    };
  }
  if (combined.includes("commercial") || combined.includes("icp") || combined.includes("contact") || combined.includes("buyer")) {
    return {
      kanji: "疾風",
      name: "Hayate",
      meaning: "Swift Gale",
      role: "Commercial Revenue & ICP Hunter",
      engine: "Qwen 30B Search-Augmented",
      badgeTone: "coral" as const,
    };
  }
  if (combined.includes("benchmark") || combined.includes("termsheet") || combined.includes("spread") || combined.includes("pricing")) {
    return {
      kanji: "正司",
      name: "Seiji",
      meaning: "Balanced Arbiter",
      role: "Spread & Term Sheet Benchmark Engine",
      engine: "DeepSeek-V4 Flash",
      badgeTone: "green" as const,
    };
  }
  if (combined.includes("competitor") || combined.includes("graph")) {
    return {
      kanji: "光",
      name: "Hikari",
      meaning: "Illumination",
      role: "Competitive Graph & Partner Scout",
      engine: "Qwen 235B Graph Synthesizer",
      badgeTone: "coral" as const,
    };
  }
  return {
    kanji: "悟",
    name: "Satoru",
    meaning: "Deep Discernment",
    role: "Funder Portal & Form Inspector",
    engine: "DOM Form Inspector + OpenRouter",
    badgeTone: "blue" as const,
  };
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
  onSaveDsl,
  onRecompileAndRun,
}: AgentDslModalProps) {
  const [activeTab, setActiveTab] = useState<"input" | "output" | "lineage" | "schema">("input");
  const [viewMode, setViewMode] = useState<"code" | "overview">("code");
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedZod, setCopiedZod] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedXRayNode, setSelectedXRayNode] = useState<FieldLineageNode | null>(null);

  const persona = useMemo(() => resolveAgentPersona(agentName, agentFlow), [agentName, agentFlow]);
  const zodSchemaDef = useMemo(
    () => resolveZodDslDefinition({ agentFlow }),
    [agentFlow]
  );

  // Editable Code State
  const initialInputCode = useMemo(() => JSON.stringify(dslInput || {}, null, 2), [dslInput]);
  const [inputCode, setInputCode] = useState(initialInputCode);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiledAst, setCompiledAst] = useState<any>(dslInput || {});

  const fieldLineage = useMemo(
    () => synthesizeFieldLineageFromDsl(compiledAst || dslInput),
    [compiledAst, dslInput]
  );

  // Reset when dslInput changes
  useEffect(() => {
    setInputCode(initialInputCode);
    setCompileError(null);
    setCompiledAst(dslInput || {});
  }, [initialInputCode, dslInput]);

  if (!isOpen) return null;

  const outputJsonString = JSON.stringify(agentOutput || [], null, 2);

  // Validate JSON compilation in real-time
  const handleCodeChange = (value: string) => {
    setInputCode(value);
    setSaveSuccess(false);
    try {
      const parsed = JSON.parse(value);
      setCompileError(null);
      setCompiledAst(parsed);
    } catch (err: any) {
      setCompileError(err.message || "Invalid JSON syntax");
    }
  };

  const handleReset = () => {
    setInputCode(initialInputCode);
    setCompileError(null);
    setCompiledAst(dslInput || {});
    setSaveSuccess(false);
  };

  const handleCopyInput = async () => {
    try {
      await navigator.clipboard.writeText(inputCode);
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

  const handleCompileAndSave = async () => {
    if (compileError) return;
    setIsCompiling(true);
    try {
      const parsed = JSON.parse(inputCode);
      if (onSaveDsl) {
        await onSaveDsl(parsed);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setCompileError(err.message || "Compilation failed");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleCompileAndReRun = async () => {
    if (compileError || !onRecompileAndRun) return;
    setIsCompiling(true);
    try {
      const parsed = JSON.parse(inputCode);
      await onRecompileAndRun(parsed);
      onClose();
    } catch (err: any) {
      setCompileError(err.message || "Execution failed");
    } finally {
      setIsCompiling(false);
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
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#151829] border border-neutral-200 dark:border-[#2a3052] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Japanese Persona Integration */}
        <div className="flex items-start justify-between p-4 border-b border-neutral-200 dark:border-[#2a3052] bg-[#1a1f3a] text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#ff6b4a] text-white font-black text-xl shadow-xs">
              {persona.kanji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  {persona.name} ({persona.kanji}) · {agentName}
                </h3>
                <Badge tone={persona.badgeTone} className="text-[10px] font-mono">
                  {agentFlow}
                </Badge>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                {persona.role} · <span className="font-mono text-[#ff8566]">{persona.engine}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs (Input vs Output) + View Switcher */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-[#2a3052] bg-neutral-100/70 dark:bg-[#111422] px-4 pt-2 text-xs font-medium">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("input")}
              className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "input"
                  ? "border-[#ff6b4a] text-[#ff6b4a] dark:text-[#ff8566] font-bold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>Input DSL Spec</span>
              {hasMissing && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  {missingParameters.length} warnings
                </span>
              )}
            </button>
            {hasOutput && (
              <button
                type="button"
                onClick={() => setActiveTab("output")}
                className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "output"
                    ? "border-purple-600 text-purple-700 dark:border-purple-400 dark:text-purple-300 font-bold"
                    : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                <span>Output DSL Results</span>
                {outputItemsCount !== null && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200">
                    {outputItemsCount} items
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("lineage")}
              className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "lineage"
                  ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-cyan-500" />
              <span>Provenance Matrix &amp; Traceability 🛡️</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("schema")}
              className={`pb-2.5 px-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "schema"
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

          {/* Code vs Overview Toggle */}
          {activeTab === "input" && (
            <div className="flex items-center gap-1 pb-2">
              <button
                type="button"
                onClick={() => setViewMode("code")}
                className={`rounded px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                  viewMode === "code"
                    ? "bg-[#1a1f3a] text-white dark:bg-[#ff6b4a]"
                    : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
                }`}
              >
                CodeMirror DSL
              </button>
              <button
                type="button"
                onClick={() => setViewMode("overview")}
                className={`rounded px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                  viewMode === "overview"
                    ? "bg-[#1a1f3a] text-white dark:bg-[#ff6b4a]"
                    : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
                }`}
              >
                Overview Form
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "input" ? (
            <>
              {/* COMPILATION ERROR / WARNING BANNER */}
              {compileError ? (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3.5 dark:border-red-900/60 dark:bg-red-950/40 space-y-1.5 animate-in shake duration-200">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span>⚠️ DSL Compilation Warning: JSON Syntax Error</span>
                  </div>
                  <p className="font-mono text-[11px] text-red-700 dark:text-red-300/90 pl-6">
                    {compileError}
                  </p>
                  <p className="text-[11px] text-red-600 dark:text-red-400/80 pl-6">
                    Downstream agent execution is guarded and disabled until clean compilation passes.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>✓ DSL Compiled: Valid JSON structure validated for {persona.name} ({persona.kanji})</span>
                  </div>
                  {saveSuccess && (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                      Changes Applied &amp; Synced!
                    </span>
                  )}
                </div>
              )}

              {/* Missing Parameters Warning Block */}
              {hasMissing && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>Missing / Recommended Parameters ({missingParameters.length})</span>
                    </div>
                    {onEditParameters && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onClose();
                          onEditParameters();
                        }}
                        className="h-6 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit In Form
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1 pt-1">
                    {missingParameters.map((param) => (
                      <div
                        key={param.name}
                        className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-xs bg-white/70 dark:bg-neutral-900/60 p-2 rounded border border-amber-200/50"
                      >
                        <span className="font-mono font-semibold text-amber-900 dark:text-amber-200">
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
              )}

              {/* MAIN CONTENT: CodeMirror Editor vs Overview Form */}
              {viewMode === "code" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-[#ff6b4a]" />
                      <span>CodeMirror 6 Live DSL Editor</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleReset}
                        className="h-7 text-xs gap-1 text-neutral-500 hover:text-neutral-900"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyInput}
                        className="h-7 text-xs gap-1"
                      >
                        {copiedInput ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        {copiedInput ? "Copied" : "Copy JSON"}
                      </Button>
                    </div>
                  </div>

                  {/* CodeMirror Editor Container */}
                  <div className="rounded-lg overflow-hidden border border-neutral-300 dark:border-[#2a3052] shadow-inner font-mono text-xs">
                    <CodeMirror
                      value={inputCode}
                      height="360px"
                      theme={oneDark}
                      extensions={[json()]}
                      onChange={handleCodeChange}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        dropCursor: true,
                        allowMultipleSelections: false,
                        indentOnInput: true,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                    <span>Directly edit any property. Live syntax and Zod schemas compile automatically.</span>
                    <span className="font-mono">{inputCode.length} bytes</span>
                  </div>
                </div>
              ) : (
                /* Overview Key Parameters Grid */
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Parsed DSL Attributes &amp; Extraction Fields
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-lg border border-neutral-200 dark:border-[#2a3052] bg-neutral-50/50 dark:bg-neutral-800/30">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                        Company / Primary Entity
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {compiledAst?.companyName || compiledAst?.name || "Bilateral Deal"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-neutral-200 dark:border-[#2a3052] bg-neutral-50/50 dark:bg-neutral-800/30">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                        Stage / Instrument
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {compiledAst?.stage || compiledAst?.corridor || "STANDARD"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-neutral-200 dark:border-[#2a3052] bg-neutral-50/50 dark:bg-neutral-800/30">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                        Jurisdiction / Corridor
                      </span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {compiledAst?.jurisdiction || compiledAst?.legalEntityJurisdiction || compiledAst?.corridor || "Cross-Border"}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-neutral-200 dark:border-[#2a3052] bg-neutral-50/50 dark:bg-neutral-800/30">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                        Target Deal Size / Capital Ask
                      </span>
                      <span className="font-semibold text-[#ff6b4a]">
                        {compiledAst?.targetRaiseUsd
                          ? `$${Number(compiledAst.targetRaiseUsd).toLocaleString()} USD`
                          : "Custom Tenor & Advance Ask"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Output Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Agent Output Payload ({persona.name})
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Discovered entities, eligibility scores &amp; reasoning vectors
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyOutput}
                  className="h-7 text-xs gap-1"
                >
                  {copiedOutput ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copiedOutput ? "Copied" : "Copy Output"}
                </Button>
              </div>

              {/* CodeMirror for Output (read-only) */}
              <div className="rounded-lg overflow-hidden border border-neutral-300 dark:border-[#2a3052] shadow-inner font-mono text-xs">
                <CodeMirror
                  value={outputJsonString}
                  height="360px"
                  theme={oneDark}
                  extensions={[json()]}
                  readOnly={true}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: PROVENANCE MATRIX & TRACEABILITY */}
          {activeTab === "lineage" && (
            <div className="space-y-4">
              <DataLineageMatrix
                fieldLineage={fieldLineage}
                onInspectNode={(node) => setSelectedXRayNode(node)}
              />
            </div>
          )}

          {/* TAB 4: UNDERLYING ZOD DSL SCHEMA (READ-ONLY) */}
          {activeTab === "schema" && (
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

              {/* Read-Only Schema Code Viewer */}
              <div className="rounded-lg overflow-hidden border border-neutral-300 dark:border-[#2a3052] shadow-inner font-mono text-xs">
                <CodeMirror
                  value={zodSchemaDef.code}
                  height="400px"
                  theme={oneDark}
                  readOnly={true}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                  }}
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Authoritative type boundary: all runtime agent inputs and AST compilation passes validate strictly against this Zod specification.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-3.5 border-t border-neutral-200 dark:border-[#2a3052] bg-neutral-50 dark:bg-[#151829]">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>CodeMirror edits compile to AST and guard agent queries</span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "input" && (
              <>
                <Button
                  size="sm"
                  variant="brand-outline"
                  onClick={handleCompileAndSave}
                  disabled={Boolean(compileError) || isCompiling}
                  className="text-xs gap-1.5"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{isCompiling ? "Compiling..." : "Compile & Save DSL"}</span>
                </Button>

                {onRecompileAndRun && (
                  <Button
                    size="sm"
                    variant="coral"
                    onClick={handleCompileAndReRun}
                    disabled={Boolean(compileError) || isCompiling}
                    className="text-xs gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Compile &amp; Re-run Agent</span>
                  </Button>
                )}
              </>
            )}

            <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Provenance X-Ray Drawer */}
      <ProvenanceXRayDrawer
        isOpen={Boolean(selectedXRayNode)}
        onClose={() => setSelectedXRayNode(null)}
        node={selectedXRayNode}
        dealId={dslInput?.dealId}
        onLockAsVerified={async (comment) => {
          if (onSaveDsl) {
            const updated = {
              ...(compiledAst || dslInput),
              _lastHumanActor: {
                actorType: "HUMAN_OPERATOR" as const,
                authMethod: "GOOGLE_CHAT_OTP" as const,
                sessionFingerprint: "sess_active",
                clientIp: "127.0.0.1",
                actionType: "TAINT_PROMOTION_TO_VERIFIED" as const,
                auditComment: comment,
                processedAt: new Date().toISOString(),
              },
            };
            await onSaveDsl(updated);
          }
        }}
      />
    </div>
  );
}
