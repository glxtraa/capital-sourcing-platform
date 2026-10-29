"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Lock,
  ArrowRight,
  Zap,
  Play,
  Loader2,
  CornerDownRight,
} from "lucide-react";

export type MilestoneStatus = "DONE" | "NEEDED_NEXT" | "BLOCKED";

export interface TimelineMilestone {
  id: string;
  number: number;
  stageNumber: number; // 1, 2, 3, or 4
  stageName: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  targetTab: string;
  targetSectionId: string;
  badgeText?: string;
  actionText?: string;
  topButtonLabel?: string; // Explicitly names the top action button that triggers this milestone
  runActionKey?: string;   // Optional direct API action key
}

export interface DealExecutionTimelineProps {
  assetClass: "STARTUP" | "TRADE" | "INVOICE";
  dealId: string;
  currentTab: string;
  onSelectTab: (tabKey: string, sectionId?: string) => void;
  // Contextual counts to derive milestones
  docCount: number;
  hasReconciledSpec: boolean;
  unresolvedRiskCount: number;
  competitorCount?: number;
  commercialProspectCount?: number;
  contactCount?: number;
  matchCount: number;
  benchmarkCount: number;
}

export function DealExecutionTimeline({
  assetClass,
  dealId,
  currentTab,
  onSelectTab,
  docCount,
  hasReconciledSpec,
  unresolvedRiskCount,
  competitorCount = 0,
  commercialProspectCount = 0,
  contactCount = 0,
  matchCount,
  benchmarkCount,
}: DealExecutionTimelineProps) {
  const router = useRouter();
  const [runningMilestoneId, setRunningMilestoneId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const activeStageNumber = useMemo(() => {
    if (["documents", "dataroom", "provenance"].includes(currentTab)) return 1;
    if (["spec", "captable", "audit"].includes(currentTab)) return 2;
    if (["syndicate", "matching", "matches", "funders"].includes(currentTab)) return 3;
    if (["benchmark", "termsheet", "blueprint"].includes(currentTab)) return 4;
    return 1;
  }, [currentTab]);

  async function executeInlineMilestone(m: TimelineMilestone, e: React.MouseEvent) {
    e.stopPropagation();
    if (!m.runActionKey || runningMilestoneId) return;

    setRunningMilestoneId(m.id);
    setRunError(null);
    try {
      if (assetClass === "INVOICE") {
        if (m.runActionKey === "extract") {
          const dealRes = await fetch(`/api/deals/${dealId}`);
          const deal = await dealRes.json();
          const docs = deal.documents ?? [];
          for (const d of docs) {
            await fetch(`/api/deals/${dealId}/documents/${d.id}/extract`, { method: "POST" });
          }
          await fetch(`/api/deals/${dealId}/extract`, { method: "POST" });
        } else if (m.runActionKey === "match") {
          await fetch(`/api/deals/${dealId}/match`, { method: "POST" });
        } else if (m.runActionKey === "benchmark") {
          await fetch(`/api/deals/${dealId}/benchmark`, { method: "POST" });
        }
      } else if (assetClass === "TRADE") {
        if (m.runActionKey === "extract") {
          const dealRes = await fetch(`/api/trade-deals/${dealId}`);
          const deal = await dealRes.json();
          const docs = deal.documents ?? [];
          for (const d of docs) {
            await fetch(`/api/trade-deals/${dealId}/documents/${d.id}/extract`, { method: "POST" });
          }
          await fetch(`/api/trade-deals/${dealId}/reconcile`, { method: "POST" });
        } else if (m.runActionKey === "reconcile") {
          await fetch(`/api/trade-deals/${dealId}/reconcile`, { method: "POST" });
        } else if (m.runActionKey === "match") {
          await fetch(`/api/trade-deals/${dealId}/match`, { method: "POST" });
        } else if (m.runActionKey === "benchmark") {
          await fetch(`/api/trade-deals/${dealId}/benchmark`, { method: "POST" });
        }
      } else if (assetClass === "STARTUP") {
        if (m.runActionKey === "extract") {
          const dealRes = await fetch(`/api/vc-deals/${dealId}`);
          const deal = await dealRes.json();
          const docs = deal.documents ?? [];
          for (const d of docs) {
            await fetch(`/api/vc-deals/${dealId}/documents/${d.id}/extract`, { method: "POST" });
          }
          await fetch(`/api/vc-deals/${dealId}/reconcile`, { method: "POST" });
        } else if (m.runActionKey === "reconcile") {
          await fetch(`/api/vc-deals/${dealId}/reconcile`, { method: "POST" });
        } else if (m.runActionKey === "competitors") {
          await fetch(`/api/vc-deals/${dealId}/competitors`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } else if (m.runActionKey === "commercial") {
          await fetch(`/api/vc-deals/${dealId}/commercial`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } else if (m.runActionKey === "contacts") {
          await fetch(`/api/vc-deals/${dealId}/commercial/contacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } else if (m.runActionKey === "match") {
          await fetch(`/api/vc-deals/${dealId}/match`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } else if (m.runActionKey === "benchmark") {
          await fetch(`/api/vc-deals/${dealId}/benchmark`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      router.refresh();
      onSelectTab(m.targetTab, m.targetSectionId);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to run milestone");
    } finally {
      setRunningMilestoneId(null);
    }
  }

  const milestones: TimelineMilestone[] = useMemo(() => {
    if (assetClass === "STARTUP") {
      const m1_done = docCount > 0;
      const m2_done = m1_done && hasReconciledSpec;
      const m3_done = hasReconciledSpec;
      const m4_done = m3_done && unresolvedRiskCount === 0;
      const isRiskBlocked = m3_done && unresolvedRiskCount > 0;
      const m5_done = competitorCount > 0;
      const m6_done = commercialProspectCount > 0;
      const m7_done = contactCount > 0;
      const m8_done = matchCount > 0;
      const m9_done = benchmarkCount > 0;

      return [
        {
          id: "m1",
          number: 1,
          stageNumber: 1,
          stageName: "Stage 1: Data Room",
          title: "Data Room & Taint Policy",
          description: `${docCount} doc${docCount === 1 ? "" : "s"} uploaded`,
          status: m1_done ? "DONE" : "NEEDED_NEXT",
          targetTab: "dataroom",
          targetSectionId: "section-vc-documents",
          badgeText: m1_done ? `${docCount} Docs` : "Upload Needed",
          actionText: "Open Data Room",
        },
        {
          id: "m2",
          number: 2,
          stageNumber: 1,
          stageName: "Stage 1: Ingestion",
          title: "Multi-Doc Extraction",
          description: hasReconciledSpec ? "Provenance validated" : "Run extraction",
          status: m2_done ? "DONE" : m1_done ? "NEEDED_NEXT" : "BLOCKED",
          targetTab: "dataroom",
          targetSectionId: "section-vc-extractions",
          badgeText: m2_done ? "Extracted" : "Pending",
          actionText: "Extract Docs",
          topButtonLabel: "1. Extract & Spec",
          runActionKey: "extract",
        },
        {
          id: "m3",
          number: 3,
          stageNumber: 2,
          stageName: "Stage 2: Deal Spec",
          title: "Spec & Cap Table Reconciled",
          description: hasReconciledSpec ? "SAFEs & valuation cap ready" : "Reconcile spec",
          status: m3_done ? "DONE" : m2_done ? "NEEDED_NEXT" : "BLOCKED",
          targetTab: "spec",
          targetSectionId: "section-vc-spec",
          badgeText: m3_done ? "Reconciled" : "Pending",
          actionText: "Review Spec",
          topButtonLabel: "1. Extract & Spec",
          runActionKey: "reconcile",
        },
        {
          id: "m4",
          number: 4,
          stageNumber: 2,
          stageName: "Stage 2: Risk Gate",
          title: "Human Risk Gate Sign-Off",
          description: unresolvedRiskCount === 0 ? "All risks verified" : `${unresolvedRiskCount} flag(s) need sign-off`,
          status: m4_done ? "DONE" : isRiskBlocked ? "BLOCKED" : "NEEDED_NEXT",
          targetTab: "spec",
          targetSectionId: "section-vc-risk-gate",
          badgeText: unresolvedRiskCount > 0 ? `${unresolvedRiskCount} Open Risks` : "Clear",
          actionText: "Verify Risks",
        },
        {
          id: "m5",
          number: 5,
          stageNumber: 2,
          stageName: "Stage 2: Rivals",
          title: "Competitors (光 Hikari)",
          description: competitorCount > 0 ? `${competitorCount} rivals mapped` : "Discovery needed",
          status: m5_done ? "DONE" : m4_done ? "NEEDED_NEXT" : "BLOCKED",
          targetTab: "spec",
          targetSectionId: "section-vc-competitors",
          badgeText: competitorCount > 0 ? `${competitorCount} Rivals` : "Discover",
          actionText: "Run Hikari",
          topButtonLabel: "2. Rivals & ICP Leads",
          runActionKey: "competitors",
        },
        {
          id: "m6",
          number: 6,
          stageNumber: 2,
          stageName: "Stage 2: ICP Leads",
          title: "Commercial ICPs (疾風 Hayate)",
          description: commercialProspectCount > 0 ? `${commercialProspectCount} target accounts` : "Generate ICPs",
          status: m6_done ? "DONE" : m5_done ? "NEEDED_NEXT" : "BLOCKED",
          targetTab: "spec",
          targetSectionId: "section-vc-commercial",
          badgeText: commercialProspectCount > 0 ? `${commercialProspectCount} Accounts` : "Generate",
          actionText: "Run Hayate",
          topButtonLabel: "2. Rivals & ICP Leads",
          runActionKey: "commercial",
        },
        {
          id: "m7",
          number: 7,
          stageNumber: 2,
          stageName: "Stage 2: Contacts",
          title: "Executive Persona Leads",
          description: contactCount > 0 ? `${contactCount} decision-makers` : "Extract leads",
          status: m7_done ? "DONE" : m6_done ? "NEEDED_NEXT" : "BLOCKED",
          targetTab: "spec",
          targetSectionId: "section-vc-contacts",
          badgeText: contactCount > 0 ? `${contactCount} Contacts` : "Extract",
          actionText: "Find Leads",
          topButtonLabel: "2. Rivals & ICP Leads",
          runActionKey: "contacts",
        },
        {
          id: "m8",
          number: 8,
          stageNumber: 3,
          stageName: "Stage 3: Syndicate",
          title: "Syndicate Matching & Allocator",
          description: matchCount > 0 ? `${matchCount} funds matched` : "Run matching engine",
          status: m8_done ? "DONE" : isRiskBlocked ? "BLOCKED" : m4_done ? "NEEDED_NEXT" : "BLOCKED",
          targetTab: "matching",
          targetSectionId: "section-vc-syndicate",
          badgeText: matchCount > 0 ? `${matchCount} Matches` : "Match",
          actionText: "Open Matching",
          topButtonLabel: "3. Match Syndicate",
          runActionKey: "match",
        },
        {
          id: "m9",
          number: 9,
          stageNumber: 4,
          stageName: "Stage 4: Benchmark",
          title: "Pro-Forma Dilution & Terms",
          description: m9_done ? "SAFE conversion modeled" : "Generate benchmark",
          status: m9_done ? "DONE" : matchCount > 0 ? "NEEDED_NEXT" : "BLOCKED",
          targetTab: "blueprint",
          targetSectionId: "section-vc-benchmark",
          badgeText: m9_done ? "Modeled" : "Pending",
          actionText: "View Model",
          topButtonLabel: "4. Benchmark Terms",
          runActionKey: "benchmark",
        },
      ];
    }

    if (assetClass === "TRADE") {
      const m1_done = docCount > 0;
      const m2_done = m1_done && hasReconciledSpec;
      const m3_done = hasReconciledSpec;
      const m4_done = m3_done && unresolvedRiskCount === 0;
      const isRiskBlocked = m3_done && unresolvedRiskCount > 0;
      const m5_done = matchCount > 0;
      const m6_done = benchmarkCount > 0;

      return [
        {
          id: "t1",
          number: 1,
          stageNumber: 1,
          stageName: "Stage 1: Documents",
          title: "Trade Documents",
          description: `${docCount} contract leg docs`,
          status: m1_done ? "DONE" : "NEEDED_NEXT",
          targetTab: "dataroom",
          targetSectionId: "section-trade-documents",
          badgeText: `${docCount} Docs`,
          actionText: "Data Room",
        },
        {
          id: "t2",
          number: 2,
          stageNumber: 1,
          stageName: "Stage 1: Ingestion",
          title: "OCR & Assay Extraction",
          description: m2_done ? "Extracted" : "Run extraction",
          status: m2_done ? "DONE" : "NEEDED_NEXT",
          targetTab: "dataroom",
          targetSectionId: "section-trade-extractions",
          badgeText: m2_done ? "Done" : "Pending",
          actionText: "Extract",
          topButtonLabel: "1. Extract Docs",
          runActionKey: "extract",
        },
        {
          id: "t3",
          number: 3,
          stageNumber: 2,
          stageName: "Stage 2: Contract Spec",
          title: "Bilateral Contract Spec",
          description: m3_done ? "Supply & Offtake Legs Reconciled" : "Reconcile Legs",
          status: m3_done ? "DONE" : "NEEDED_NEXT",
          targetTab: "spec",
          targetSectionId: "section-trade-spec",
          badgeText: m3_done ? "Reconciled" : "Pending",
          actionText: "Review",
          topButtonLabel: "2. Reconcile Legs",
          runActionKey: "reconcile",
        },
        {
          id: "t4",
          number: 4,
          stageNumber: 2,
          stageName: "Stage 2: Risk Gate",
          title: "Maritime & Sanction Gate",
          description: unresolvedRiskCount === 0 ? "Clear" : `${unresolvedRiskCount} risk(s)`,
          status: m4_done ? "DONE" : isRiskBlocked ? "BLOCKED" : "NEEDED_NEXT",
          targetTab: "spec",
          targetSectionId: "section-trade-risks",
          badgeText: unresolvedRiskCount > 0 ? `${unresolvedRiskCount} Risks` : "Clear",
          actionText: "Sign-Off",
        },
        {
          id: "t5",
          number: 5,
          stageNumber: 3,
          stageName: "Stage 3: Funder Match",
          title: "Trade Funder Matching",
          description: matchCount > 0 ? `${matchCount} desks matched` : "Match desks",
          status: m5_done ? "DONE" : isRiskBlocked ? "BLOCKED" : "NEEDED_NEXT",
          targetTab: "matching",
          targetSectionId: "section-trade-matches",
          badgeText: `${matchCount} Desks`,
          actionText: "Match",
          topButtonLabel: "3. Match Funders",
          runActionKey: "match",
        },
        {
          id: "t6",
          number: 6,
          stageNumber: 4,
          stageName: "Stage 4: Benchmark",
          title: "Facility Term Sheet Benchmark",
          description: m6_done ? "Blended SOFR Benchmark Ready" : "Generate Benchmark",
          status: m6_done ? "DONE" : m5_done ? "NEEDED_NEXT" : "BLOCKED",
          targetTab: "blueprint",
          targetSectionId: "section-trade-termsheet",
          badgeText: m6_done ? "Ready" : "Pending",
          actionText: "Benchmark",
          topButtonLabel: "4. Benchmark Facility",
          runActionKey: "benchmark",
        },
      ];
    }

    // Invoice Factoring
    const m1_done = docCount > 0;
    const m2_done = m1_done && hasReconciledSpec;
    const m3_done = hasReconciledSpec;
    const m4_done = m3_done && unresolvedRiskCount === 0;
    const isRiskBlocked = m3_done && unresolvedRiskCount > 0;
    const m5_done = matchCount > 0;
    const m6_done = benchmarkCount > 0;

    return [
      {
        id: "f1",
        number: 1,
        stageNumber: 1,
        stageName: "Stage 1: Documents",
        title: "Factoring Documents",
        description: `${docCount} invoices / aging docs`,
        status: m1_done ? "DONE" : "NEEDED_NEXT",
        targetTab: "dataroom",
        targetSectionId: "section-invoice-documents",
        badgeText: `${docCount} Docs`,
        actionText: "Data Room",
      },
      {
        id: "f2",
        number: 2,
        stageNumber: 1,
        stageName: "Stage 1: Ingestion",
        title: "Extraction & Title Check",
        description: m2_done ? "Invoices parsed" : "Extract",
        status: m2_done ? "DONE" : "NEEDED_NEXT",
        targetTab: "dataroom",
        targetSectionId: "section-invoice-extractions",
        badgeText: m2_done ? "Done" : "Pending",
        actionText: "Extract",
        topButtonLabel: "1. Extract & Spec",
        runActionKey: "extract",
      },
      {
        id: "f3",
        number: 3,
        stageNumber: 2,
        stageName: "Stage 2: Spec",
        title: "Counterparty & Title Spec",
        description: m3_done ? "Debtor & Ask Reconciled" : "Reconcile",
        status: m3_done ? "DONE" : "NEEDED_NEXT",
        targetTab: "spec",
        targetSectionId: "section-invoice-spec",
        badgeText: m3_done ? "Reconciled" : "Pending",
        actionText: "Review",
        topButtonLabel: "1. Extract & Spec",
        runActionKey: "extract",
      },
      {
        id: "f4",
        number: 4,
        stageNumber: 2,
        stageName: "Stage 2: Risk Gate",
        title: "Dilution & Risk Sign-Off",
        description: unresolvedRiskCount === 0 ? "Clear" : `${unresolvedRiskCount} risk(s)`,
        status: m4_done ? "DONE" : isRiskBlocked ? "BLOCKED" : "NEEDED_NEXT",
        targetTab: "spec",
        targetSectionId: "section-invoice-risks",
        badgeText: unresolvedRiskCount > 0 ? `${unresolvedRiskCount} Risks` : "Clear",
        actionText: "Sign-Off",
      },
      {
        id: "f5",
        number: 5,
        stageNumber: 3,
        stageName: "Stage 3: Matching",
        title: "Provider Matching",
        description: matchCount > 0 ? `${matchCount} providers matched` : "Match providers",
        status: m5_done ? "DONE" : isRiskBlocked ? "BLOCKED" : "NEEDED_NEXT",
        targetTab: "matching",
        targetSectionId: "section-invoice-matches",
        badgeText: `${matchCount} Providers`,
        actionText: "Match",
        topButtonLabel: "2. Match Providers",
        runActionKey: "match",
      },
      {
        id: "f6",
        number: 6,
        stageNumber: 4,
        stageName: "Stage 4: Term Sheet",
        title: "Advance Rate Benchmark",
        description: m6_done ? "Benchmark Ready" : "Generate",
        status: m6_done ? "DONE" : m5_done ? "NEEDED_NEXT" : "BLOCKED",
        targetTab: "blueprint",
        targetSectionId: "section-invoice-termsheet",
        badgeText: m6_done ? "Ready" : "Pending",
        actionText: "Benchmark",
        topButtonLabel: "3. Benchmark Terms",
        runActionKey: "benchmark",
      },
    ];
  }, [
    assetClass,
    docCount,
    hasReconciledSpec,
    unresolvedRiskCount,
    competitorCount,
    commercialProspectCount,
    contactCount,
    matchCount,
    benchmarkCount,
  ]);

  const completedCount = milestones.filter((m) => m.status === "DONE").length;
  const progressPct = Math.round((completedCount / milestones.length) * 100);

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-950 transition-all relative">
      {/* Visual Connector Pipes Linking from the 4-Stage Pipeline Above */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-2.5 -mt-6 mb-2 pointer-events-none px-8">
        {[1, 2, 3, 4].map((stageNum) => (
          <div key={stageNum} className="flex justify-center">
            <div
              className={`h-4 w-0.5 transition-colors ${
                stageNum === activeStageNumber
                  ? "bg-[#ff6b4a]"
                  : "bg-slate-300 dark:bg-slate-700"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Two-Tier Timeline Connection Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a1f3a] font-bold text-[#ff6b4a]">
            <CornerDownRight className="h-4 w-4 text-[#ff6b4a]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Detailed Stage Execution Milestones &amp; Direct Triggers
              </h3>
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300">
                Stage {activeStageNumber} Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Grouped directly under Stages 1–4 above. Click any milestone to <span className="font-semibold text-slate-600 dark:text-slate-300">"Jump →"</span> to that section, or click <span className="font-semibold text-amber-600 dark:text-amber-400">"▶ Run"</span> on pending steps.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          {runError && (
            <span className="text-[11px] font-medium text-red-600 dark:text-red-400 mr-2">
              {runError}
            </span>
          )}
          <span className="text-[11px] text-slate-500 font-medium">
            {completedCount}/{milestones.length} Complete
          </span>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Granular Milestones Row with Explicit Stage & Top-Button Badging */}
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${milestones.length >= 8 ? "lg:grid-cols-9" : "lg:grid-cols-6"}`}>
        {milestones.map((m) => {
          const isDone = m.status === "DONE";
          const isNeeded = m.status === "NEEDED_NEXT";
          const isBlocked = m.status === "BLOCKED";
          const isSameStage = m.stageNumber === activeStageNumber;
          const isRunningThis = runningMilestoneId === m.id;

          return (
            <div
              key={m.id}
              onClick={() => onSelectTab(m.targetTab, m.targetSectionId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectTab(m.targetTab, m.targetSectionId);
                }
              }}
              title={`Jump to ${m.title} (${m.stageName})`}
              className={`group flex flex-col justify-between rounded-lg border p-2.5 text-left transition-all cursor-pointer relative ${
                isSameStage
                  ? "ring-1.5 ring-blue-500/70 dark:ring-blue-400/80 shadow-xs"
                  : ""
              } ${
                isDone
                  ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 dark:border-emerald-950 dark:bg-emerald-950/20"
                  : isNeeded
                  ? "border-amber-400 bg-amber-50/60 hover:border-amber-500 dark:border-amber-700 dark:bg-amber-950/30 shadow-xs"
                  : "border-slate-200 bg-slate-50/50 opacity-60 hover:opacity-100 dark:border-slate-800 dark:bg-slate-900/30"
              }`}
            >
              <div>
                {/* Stage Tag & Milestone Counter */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider font-mono border ${
                      m.stageNumber === 1
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        : m.stageNumber === 2
                        ? "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                        : m.stageNumber === 3
                        ? "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                        : "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                    }`}
                  >
                    Stage {m.stageNumber}
                  </span>

                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      M{m.number}
                    </span>
                    {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    {isNeeded && <Clock className="h-3.5 w-3.5 text-amber-600" />}
                    {isBlocked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                </div>

                <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-800 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                  {m.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                  {m.description}
                </p>

                {/* Top Button Link Indicator */}
                {m.topButtonLabel && (
                  <p className="mt-1 line-clamp-1 font-mono text-[9px] text-slate-400 dark:text-slate-500">
                    Top Btn: {m.topButtonLabel}
                  </p>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-1 border-t border-slate-200/50 pt-1.5 dark:border-slate-800">
                {isNeeded && m.runActionKey ? (
                  <button
                    type="button"
                    disabled={!!runningMilestoneId}
                    onClick={(e) => executeInlineMilestone(m, e)}
                    className="inline-flex items-center gap-1 rounded bg-amber-600 hover:bg-amber-700 text-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-2xs transition-colors cursor-pointer"
                    title={`Execute ${m.title} right now`}
                  >
                    {isRunningThis ? (
                      <>
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        <span>Running…</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-2.5 w-2.5 fill-current" />
                        <span>Run M{m.number}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                      isDone
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                        : isNeeded
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {isDone ? "✓ Done" : isNeeded ? "⏳ Next" : "🔒 Gate"}
                  </span>
                )}

                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
                  Jump →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
