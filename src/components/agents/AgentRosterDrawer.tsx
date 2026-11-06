"use client";

import { useState } from "react";
import { X, Bot, Cpu, Activity } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";

export interface AgentProfile {
  id: string;
  name: string;
  kanji: string;
  kanjiMeaning: string;
  role: string;
  domain: "trade" | "factoring" | "startups" | "shared";
  domainLabel: string;
  modelEngine: string;
  badge: string;
  badgeTone: "coral" | "navy" | "green" | "purple" | "blue" | "amber";
  description: string;
  capabilities: string[];
  systemExcerpt: string;
  status: "idle" | "ready" | "active";
}

export const JAPANESE_AGENT_COLLECTIVE: AgentProfile[] = [
  {
    id: "minato",
    name: "Minato",
    kanji: "湊",
    kanjiMeaning: "Harbor / Port",
    role: "Maritime & Trade Contract Parser",
    domain: "trade",
    domainLabel: "Trade Finance",
    modelEngine: "DeepSeek-V4 Flash (1M Context) via OpenRouter OCR",
    badge: "Maritime Specialist",
    badgeTone: "navy",
    description:
      "Trained on international shipping standards, Incoterms 2020, bilateral commodity contracts (SPAs), bills of lading, and port clearance manifests.",
    capabilities: [
      "Bilingual OCR & parsing (Indonesian, Chinese, English)",
      "Incoterm & discharge port extraction",
      "Commodity assay & quality tolerance verification",
      "Sales vs. Purchase leg pairing",
    ],
    systemExcerpt:
      "Extract structured BilateralLegs and Corridor specifications. Flag demurrage liabilities, LC expiration gaps, and FOB/CIF transfer points.",
    status: "ready",
  },
  {
    id: "makoto",
    name: "Makoto",
    kanji: "誠",
    kanjiMeaning: "Truth / Integrity",
    role: "Invoice Credit & Dilution Auditor",
    domain: "factoring",
    domainLabel: "Invoice Factoring",
    modelEngine: "DeepSeek-V4 Flash via OpenRouter",
    badge: "Credit & Dilution Auditor",
    badgeTone: "amber",
    description:
      "Audits outstanding accounts receivable to eliminate invoice fraud, measure debtor concentration, and calculate dilution reserve margins.",
    capabilities: [
      "Debtor concentration risk scoring",
      "Recourse vs. non-recourse risk assessment",
      "Proof of delivery (POD) dispute reconciliation",
      "Advance rate eligibility checks",
    ],
    systemExcerpt:
      "Audit accounts receivable ledgers for payment aging, credit dilution risk, and debtor creditworthiness thresholds.",
    status: "ready",
  },
  {
    id: "daiki",
    name: "Daiki",
    kanji: "大輝",
    kanjiMeaning: "Great Radiance / Vision",
    role: "Venture Capital Thesis Architect",
    domain: "startups",
    domainLabel: "Startup Hub",
    modelEngine: "Qwen 235B Multi-Step via OpenRouter",
    badge: "Venture Syndicate Scout",
    badgeTone: "purple",
    description:
      "Analyzes startup pitch decks, cap tables, SAFE notes, and revenue growth metrics to match founders with high-conviction lead investors.",
    capabilities: [
      "SAFE post-money dilution modeling",
      "Thesis alignment & check-size matching",
      "Syndicate co-investment network mapping",
      "Unit economics & burn rate sanity checks",
    ],
    systemExcerpt:
      "Evaluate founder pedigree, ARR growth trajectory, valuation caps, and syndicate co-investment networks across top venture funds.",
    status: "ready",
  },
  {
    id: "hayate",
    name: "Hayate",
    kanji: "疾風",
    kanjiMeaning: "Swift Gale",
    role: "Commercial Revenue & ICP Hunter",
    domain: "startups",
    domainLabel: "Startup Hub",
    modelEngine: "Qwen 30B Search-Augmented via OpenRouter",
    badge: "Pipeline Hunter",
    badgeTone: "coral",
    description:
      "Surfaces high-probability enterprise buyer accounts matching the startup's Ideal Customer Profile (ICP), formulating tailored procurement angles.",
    capabilities: [
      "Enterprise buyer account discovery",
      "Estimated ACV tier estimation",
      "VP/CXO decision-maker identification",
      "Verified commercial outreach hooks",
    ],
    systemExcerpt:
      "Identify high-intent enterprise commercial prospects, mapped by industry vertical, ACV tier, and procurement pain-points.",
    status: "ready",
  },
  {
    id: "seiji",
    name: "Seiji",
    kanji: "正司",
    kanjiMeaning: "Balanced Arbiter",
    role: "Pricing Spread & Term Sheet Benchmark Engine",
    domain: "shared",
    domainLabel: "Cross-Asset Structuring",
    modelEngine: "DeepSeek-V4 Flash via OpenRouter",
    badge: "Structuring Lead",
    badgeTone: "green",
    description:
      "Calculates competitive capital spreads, interest rate margins, LTV covenants, and legal clawback terms into institutional term sheets.",
    capabilities: [
      "Competitive cost-of-funds benchmarking",
      "Spread and advance rate optimization",
      "Lender covenant and collateral formulation",
      "Institutional term sheet generation",
    ],
    systemExcerpt:
      "Benchmark offer parameters against market comps to propose competitive spread, advance percentage, and protective covenants.",
    status: "ready",
  },
  {
    id: "satoru",
    name: "Satoru",
    kanji: "悟",
    kanjiMeaning: "Deep Discernment",
    role: "Funder Portal & Deep Web Form Inspector",
    domain: "shared",
    domainLabel: "Intelligence Recon",
    modelEngine: "DOM Form Inspector + OpenRouter Web Plugin",
    badge: "Deep Web Recon",
    badgeTone: "blue",
    description:
      "Inspects capital provider websites, extracts live application forms without guessing, and verifies official role mailboxes.",
    capabilities: [
      "DOM input field extraction (HTML inspection)",
      "Role-based contact verification",
      "Live HTTP status & SSL verification",
      "Application route discovery",
    ],
    systemExcerpt:
      "Scrape and verify provider onboarding portals, parsing HTML form fields and recording only authenticated direct contact channels.",
    status: "ready",
  },
  {
    id: "hikari",
    name: "Hikari",
    kanji: "光",
    kanjiMeaning: "Illumination",
    role: "Competitive Graph & Partner Scout",
    domain: "startups",
    domainLabel: "Startup Hub",
    modelEngine: "Qwen 235B Graph Synthesizer",
    badge: "Ecosystem Scout",
    badgeTone: "coral",
    description:
      "Maps the competitive landscape, tracking venture backing overlap, strategic distribution partners, and market positioning moats.",
    capabilities: [
      "Competitor overlap degree scoring",
      "Venture backer co-occurrence analysis",
      "Strategic distribution channel discovery",
      "Differentiation defense articulation",
    ],
    systemExcerpt:
      "Analyze market competitors, co-investor networks, and strategic partnership synergies to establish clear venture differentiation.",
    status: "ready",
  },
];

export function AgentRosterDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile>(JAPANESE_AGENT_COLLECTIVE[0]);

  if (!isOpen) return null;

  const filteredAgents =
    filterDomain === "all"
      ? JAPANESE_AGENT_COLLECTIVE
      : JAPANESE_AGENT_COLLECTIVE.filter((a) => a.domain === filterDomain || a.domain === "shared");

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-[#151829] border-l border-neutral-200 dark:border-[#2a3052] shadow-2xl flex flex-col h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-[#2a3052] bg-[#1a1f3a] text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff6b4a] text-white font-bold shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">TR3 Agent Collective</h2>
                <span className="rounded-full bg-[#ff6b4a]/20 border border-[#ff6b4a]/40 px-2 py-0.5 text-[11px] font-semibold text-[#ff8566]">
                  7 Japanese Personas
                </span>
              </div>
              <p className="text-xs text-neutral-300">
                Autonomous domain specialists driving extraction, audit, matching &amp; structuring
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-neutral-200 dark:border-[#2a3052] bg-neutral-50 dark:bg-[#1a1f3a]/60 text-xs font-medium">
          <span className="text-neutral-500 dark:text-neutral-400 mr-1">Domain:</span>
          {[
            { id: "all", label: "All Agents (7)" },
            { id: "trade", label: "Trade Finance" },
            { id: "factoring", label: "Invoice Factoring" },
            { id: "startups", label: "Startup Hub" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterDomain(tab.id)}
              className={`rounded-full px-3 py-1 text-xs transition-colors cursor-pointer ${
                filterDomain === tab.id
                  ? "bg-[#1a1f3a] text-white dark:bg-[#ff6b4a] dark:text-white font-semibold"
                  : "bg-white text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content: 2-Column Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Agent List */}
          <div className="w-1/2 border-r border-neutral-200 dark:border-[#2a3052] overflow-y-auto divide-y divide-neutral-100 dark:divide-[#2a3052]/50">
            {filteredAgents.map((agent) => {
              const isSelected = selectedAgent.id === agent.id;
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#ff6b4a]/10 dark:bg-[#ff6b4a]/15 border-l-4 border-l-[#ff6b4a]"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-[#1a1f3a] dark:text-white">
                        {agent.kanji}
                      </span>
                      <h4 className="font-bold text-sm text-[#1a1f3a] dark:text-white">
                        {agent.name}
                      </h4>
                    </div>
                    <Badge tone={agent.badgeTone} className="text-[10px]">
                      {agent.badge}
                    </Badge>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1 font-medium">
                    {agent.role}
                  </p>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 text-[11px] text-neutral-400">
                    <span className="font-mono text-[10px] truncate max-w-[140px]">
                      {agent.kanjiMeaning}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ready
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Selected Agent Dossier */}
          <div className="w-1/2 overflow-y-auto p-5 space-y-4 bg-neutral-50/50 dark:bg-[#111422]/70">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#ff6b4a]">{selectedAgent.kanji}</span>
                  <h3 className="text-xl font-bold text-[#1a1f3a] dark:text-white">
                    {selectedAgent.name}
                  </h3>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  {selectedAgent.kanjiMeaning} · {selectedAgent.domainLabel}
                </p>
              </div>
              <Badge tone={selectedAgent.badgeTone}>{selectedAgent.badge}</Badge>
            </div>

            <div className="rounded-lg p-3 bg-white dark:bg-[#1a1f3a] border border-neutral-200 dark:border-[#2a3052] space-y-1.5 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Specialized Function
              </span>
              <p className="text-xs font-semibold text-[#1a1f3a] dark:text-neutral-100">
                {selectedAgent.role}
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed pt-1">
                {selectedAgent.description}
              </p>
            </div>

            {/* Model Engine Spec */}
            <div className="rounded-lg p-3 bg-white dark:bg-[#1a1f3a] border border-neutral-200 dark:border-[#2a3052] space-y-1 shadow-xs">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                <Cpu className="h-3.5 w-3.5 text-[#ff6b4a]" />
                <span>Model Engine</span>
              </div>
              <p className="font-mono text-xs text-[#1a1f3a] dark:text-neutral-200 font-medium">
                {selectedAgent.modelEngine}
              </p>
            </div>

            {/* Core Capabilities */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Key Domain Capabilities
              </span>
              <ul className="space-y-1.5">
                {selectedAgent.capabilities.map((cap, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b4a] mt-1.5 shrink-0" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* System Prompt Excerpt */}
            <div className="rounded-lg p-3 bg-[#151829] text-white border border-[#2a3052] space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 tracking-wider block">
                System Directive Snippet
              </span>
              <p className="text-[11px] font-mono text-neutral-300 leading-relaxed italic">
                &ldquo;{selectedAgent.systemExcerpt}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-[#2a3052] bg-white dark:bg-[#151829] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-neutral-500">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span>All 7 agents synced to Zod DSL compile engine</span>
          </div>
          <Button size="sm" variant="coral" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
