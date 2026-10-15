"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/primitives";
import { VcUploadDropzone } from "@/components/VcUploadDropzone";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileText,
  Globe,
  Layers,
  Mail,
  MapPin,
  PieChart,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { EditVcDealModal } from "@/components/EditVcDealModal";
import { DocumentExtractionModal } from "@/components/DocumentExtractionModal";
import { EditVcInvestorModal } from "@/components/EditVcInvestorModal";
import { EditCapTableModal, SafeHolderData, CommonHolderData } from "@/components/EditCapTableModal";
import { CachedPageModal } from "@/components/research/CachedPageModal";
import { VcFunderDealResearchCard } from "@/components/VcFunderDealResearchCard";

interface VcDealWorkspaceTabsProps {
  deal: {
    id: string;
    companyName: string;
    stage: string;
    primaryVertical: string;
    industry?: string | null;
    subIndustries?: string[];
    legalEntityJurisdiction: string;
    status: string;
    competitors?: Array<{
      id: string;
      name: string;
      websiteUrl: string | null;
      description: string;
      overlapDegree: string;
      knownInvestors: string[];
      differentiation: string | null;
      sourceUrl: string | null;
      sourceVerified: boolean;
      sourceHttpStatus: number | null;
      lastVerified: Date | string | null;
    }>;
    commercialProspects?: Array<{
      id: string;
      name: string;
      websiteUrl: string | null;
      category: string;
      buyerPersona: string | null;
      useCaseFit: string;
      estimatedAcvTier: string;
      strategicSynergy: string | null;
      sourceUrl: string | null;
      sourceVerified: boolean;
      sourceHttpStatus: number | null;
      lastVerified: Date | string | null;
    }>;

    documents: Array<{
      id: string;
      fileName: string;
      blobUrl: string;
      mimeType: string;
      sizeBytes: number;
      documentTypes: string[];
      extractedRaw: any;
      uploadedAt: Date | string;
    }>;
    founders: Array<{
      id: string;
      name: string;
      role: string;
      isTechnical: boolean;
      isRepeatFounder: boolean;
      equityOwnershipPct: number;
      vestingConfirmed: boolean;
      priorExits: string[];
    }>;
    capTable: {
      id: string;
      foundersOwnershipPct: number;
      investorOwnershipPct: number;
      optionPoolPct: number;
      safesNotesOutstandingUsd: number;
      safeHoldersJson?: any;
      commonHoldersJson?: any;
      hasDeadEquity: boolean;
      deadEquityNotes: string | null;
    } | null;
    financingAsks: Array<{
      id: string;
      targetRaiseUsd: number;
      instrumentType: string;
      valuationCapUsd: number | null;
      discountPct: number | null;
      plannedRunwayMonths: number;
      leadCommitted: boolean;
      committedAmountUsd: number;
    }>;
    riskFlags: Array<{
      id: string;
      category: string;
      severity: number;
      description: string;
      resolved: boolean;
    }>;
    matches: Array<{
      id: string;
      tier: string;
      verdict: string;
      rationale: string;
      isLeadCandidate: boolean;
      thesisResonanceScore: number | null;
      portfolioConflictDetected: boolean;
      conflictingPortfolioCompany?: string | null;
      activelyFundingIndustry?: boolean;
      industryDeploymentScore?: number | null;
      competitorConflictNotes?: string | null;
      sourceLinksAudit?: any;
      investor: {
        id: string;
        name: string;
        type: string;
        minCheckUsd: number | null;
        maxCheckUsd: number | null;
        targetOwnershipPct: number | null;
        takesBoardSeats: boolean;
        applicationRoute: string;
        applicationUrl: string | null;
        websiteUrl?: string | null;
        contactEmail?: string | null;
        headquarters?: string | null;
        keyContactsJson?: any;
        portfolioCompanies: string[];
        activelyFundingIndustry?: boolean;
        recentIndustryInvestments?: any;
        competitorInvestments?: any;
        thesisMatchSummary?: string | null;
        sourceLinksAudit?: any;
        documentsRequired: Array<{ id: string; code: string; note: string | null }>;
      };
    }>;
    syndicateBlueprints: Array<{
      id: string;
      targetRaiseUsd: number;
      leadAllocationUsd: number;
      syndicateAllocationUsd: number;
      angelAllocationUsd: number;
      recommendedValuationCapUsd: number | null;
      dilutionModelJson: any;
      synthesisSummary: string;
      createdAt: Date | string;
    }>;
  };
}

function MatchConflictAndAuditDetails({
  match,
  onOpenSnapshot,
}: {
  match: any;
  onOpenSnapshot?: (url: string) => void;
}) {
  const auditLinks = Array.isArray(match.sourceLinksAudit) ? match.sourceLinksAudit : [];
  const investor = match.investor || {};
  const keyContacts = Array.isArray(investor.keyContactsJson) ? investor.keyContactsJson : [];
  const hasContacts = investor.contactEmail || investor.headquarters || investor.websiteUrl || keyContacts.length > 0;

  return (
    <div className="space-y-2 pt-1">
      {/* Portfolio Conflict Banner */}
      {match.portfolioConflictDetected && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50/90 p-2.5 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Anti-Portfolio Conflict Flagged: </span>
            <span>
              {match.competitorConflictNotes ||
                `Invested in competitor ${match.conflictingPortfolioCompany || "firm"}.`}
            </span>
          </div>
        </div>
      )}

      {/* Industry Deployment Status Tag */}
      <div className="flex flex-wrap items-center gap-2">
        {match.activelyFundingIndustry !== false ? (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Zap className="h-3 w-3 text-emerald-600" />
            Actively Funding Sector (Past 12-24m)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="h-3 w-3 text-amber-600" />
            Stale / Inactive Thesis in Sector
          </span>
        )}

        {match.investor?.thesisMatchSummary && (
          <span className="text-[11px] text-neutral-500 italic">
            &ldquo;{match.investor.thesisMatchSummary}&rdquo;
          </span>
        )}
      </div>

      {/* Verified Direct Contact & Key Decision Makers */}
      {hasContacts && (
        <div className="rounded-md border border-neutral-100 bg-neutral-50/70 p-2 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300 space-y-1.5">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {investor.headquarters && (
              <span className="inline-flex items-center gap-1 text-neutral-600 dark:text-neutral-400">
                <MapPin className="h-3 w-3 text-neutral-400 shrink-0" />
                <span className="font-medium">{investor.headquarters}</span>
              </span>
            )}
            {investor.contactEmail && (
              <a
                href={`mailto:${investor.contactEmail}`}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline font-mono"
              >
                <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                <span>{investor.contactEmail}</span>
              </a>
            )}
            {investor.websiteUrl && (
              <div className="inline-flex items-center gap-1.5">
                <a
                  href={investor.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400 font-medium"
                >
                  <Globe className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span>Verified Portal</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
                {onOpenSnapshot && (
                  <button
                    type="button"
                    onClick={() => onOpenSnapshot(investor.websiteUrl)}
                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-mono border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer transition-colors"
                    title="View cached snapshot of investor portal"
                  >
                    <FileText className="h-2.5 w-2.5 text-emerald-600" />
                    <span>Snapshot</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {keyContacts.length > 0 && (
            <div className="pt-1 border-t border-neutral-200/60 dark:border-neutral-800 text-[11px]">
              <span className="font-semibold text-neutral-500 text-[10px] uppercase tracking-wider block mb-1">
                Key Decision Makers &amp; Partners:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {keyContacts.map((contact: any, cIdx: number) => (
                  <div
                    key={cIdx}
                    className="inline-flex items-center gap-1.5 rounded bg-white px-2 py-0.5 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 shadow-2xs"
                  >
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {contact.name}
                    </span>
                    {contact.role && (
                      <span className="text-neutral-400 text-[10px]">
                        ({contact.role})
                      </span>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        title={`Email ${contact.name}`}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 ml-0.5 inline-flex items-center"
                      >
                        <Mail className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {contact.linkedinUrl && (
                      <a
                        href={contact.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Audited LinkedIn Profile"
                        className="text-blue-500 hover:text-blue-700 dark:text-blue-300 ml-0.5 inline-flex items-center gap-0.5"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {contact.verified && (
                      <span className="text-emerald-600 font-bold text-[10px]" title="Audited Profile">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verified Source Links Audit */}
      {auditLinks.length > 0 && (
        <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="font-medium text-[10px] uppercase tracking-wider">
              Re-Verified HTTP Source Citations:
            </span>
            <span className="font-mono text-[10px]">
              {auditLinks.filter((l: any) => l.ok).length}/{auditLinks.length} Links Active
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {auditLinks.slice(0, 4).map((link: any, idx: number) => {
              let host = link.url;
              try {
                host = new URL(link.url).hostname.replace("www.", "");
              } catch {}
              return (
                <div key={idx} className="inline-flex items-center gap-1">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                      link.ok
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-red-50 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                    }`}
                  >
                    <span className="font-bold">{link.ok ? `✓ ${link.status || 200}` : `✗ ${link.status || "ERR"}`}</span>
                    <span className="truncate max-w-[120px]">{host}</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </a>
                  {onOpenSnapshot && (
                    <button
                      type="button"
                      onClick={() => onOpenSnapshot(link.url)}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono border border-neutral-200 bg-neutral-50 text-neutral-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                      title="View cached audit snapshot of cited page"
                    >
                      <FileText className="h-2.5 w-2.5 text-emerald-600" />
                      <span>Cached</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function VcDealWorkspaceTabs({ deal }: VcDealWorkspaceTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"syndicate" | "captable" | "spec" | "benchmark" | "documents">("syndicate");
  const [capTableSubTab, setCapTableSubTab] = useState<"safes" | "common" | "overview">("safes");
  const [isEditCapTableOpen, setIsEditCapTableOpen] = useState(false);
  const [isEditDealOpen, setIsEditDealOpen] = useState(false);
  const [selectedDocForExtraction, setSelectedDocForExtraction] = useState<{
    id: string;
    fileName: string;
    documentTypes: string[];
    extractedRaw: any;
  } | null>(null);

  const [selectedInvestorForEdit, setSelectedInvestorForEdit] = useState<any | null>(null);
  const [cachedSnapshotUrl, setCachedSnapshotUrl] = useState<string | null>(null);

  // Interactive founder syndicate allocation sliders (defaults to 65% Lead / 25% Syndicate / 10% Angel)
  const ask = deal.financingAsks[0];
  const targetRaise = ask?.targetRaiseUsd ?? 1500000;

  // Cap Table SAFE & Common data derivation
  const rawSafeHolders: SafeHolderData[] = Array.isArray(deal.capTable?.safeHoldersJson)
    ? (deal.capTable?.safeHoldersJson as SafeHolderData[])
    : [];

  const rawCommonHolders: CommonHolderData[] = Array.isArray(deal.capTable?.commonHoldersJson)
    ? (deal.capTable?.commonHoldersJson as CommonHolderData[])
    : [];

  // If no safeHolders stored yet but safesNotesOutstandingUsd exists, create initial representative item
  const safeHolders: SafeHolderData[] =
    rawSafeHolders.length > 0
      ? rawSafeHolders
      : (deal.capTable?.safesNotesOutstandingUsd && deal.capTable.safesNotesOutstandingUsd > 0)
      ? [
          {
            holderName: "Seed SAFE Noteholders",
            investmentAmountUsd: deal.capTable.safesNotesOutstandingUsd,
            instrumentType: ask?.instrumentType || "POST_MONEY_SAFE",
            valuationCapUsd: ask?.valuationCapUsd ?? null,
            discountPct: ask?.discountPct ?? 20,
            dateOrNotes: "Pre-round convertible SAFE notes",
          },
        ]
      : [];

  // If no commonHolders stored yet, synthesize from deal.founders + optionPoolPct
  const commonHolders: CommonHolderData[] =
    rawCommonHolders.length > 0
      ? rawCommonHolders
      : [
          ...deal.founders.map((f) => ({
            id: f.id,
            holderName: f.name,
            roleOrRelationship: f.role,
            shareCount: null,
            ownershipPct: f.equityOwnershipPct,
            vestingTerms: f.vestingConfirmed ? "Standard 4-year monthly, 1-year cliff" : "Unvested / Not Specified",
          })),
          ...(deal.capTable?.optionPoolPct && deal.capTable.optionPoolPct > 0
            ? [
                {
                  id: "option-pool-auto",
                  holderName: "Unallocated Stock Option Pool",
                  roleOrRelationship: "Employee Pool (ESOP)",
                  shareCount: null,
                  ownershipPct: deal.capTable.optionPoolPct,
                  vestingTerms: "Reserved for future engineering & leadership hires",
                },
              ]
            : []),
        ];

  const totalSafesBalance = safeHolders.reduce((acc, s) => acc + (Number(s.investmentAmountUsd) || 0), 0);
  const totalCommonEquityPct = commonHolders.reduce((acc, c) => acc + (Number(c.ownershipPct) || 0), 0);

  const [leadPct, setLeadPct] = useState<number>(65);
  const [syndicatePct, setSyndicatePct] = useState<number>(25);
  const [angelPct, setAngelPct] = useState<number>(10);
  const [isUpdatingAllocation, setIsUpdatingAllocation] = useState(false);
  const [allocationNotice, setAllocationNotice] = useState<string | null>(null);

  const [isDiscoveringCompetitors, setIsDiscoveringCompetitors] = useState(false);
  const [competitorNotice, setCompetitorNotice] = useState<string | null>(null);

  async function handleDiscoverCompetitors() {
    setIsDiscoveringCompetitors(true);
    setCompetitorNotice(null);
    try {
      const res = await fetch(`/api/vc-deals/${deal.id}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      let data: any = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          text.length > 200
            ? `Server returned HTTP ${res.status}: ${res.statusText || "Request failed"}`
            : (text || `Server returned HTTP ${res.status}`)
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to discover competitors (${res.status})`);
      }

      setCompetitorNotice(data.auditSummary || "Competitor discovery complete!");
      setTimeout(() => setCompetitorNotice(null), 6000);
      router.refresh();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("load failed") || msg.toLowerCase().includes("fetch")) {
        setCompetitorNotice("Competitor intelligence request timed out or was interrupted. Retrying with fast market intelligence...");
      } else {
        setCompetitorNotice(err instanceof Error ? err.message : "Error discovering competitors");
      }
    } finally {
      setIsDiscoveringCompetitors(false);
    }
  }

  const [isDiscoveringCommercial, setIsDiscoveringCommercial] = useState(false);
  const [commercialNotice, setCommercialNotice] = useState<string | null>(null);

  async function handleDiscoverCommercial() {
    setIsDiscoveringCommercial(true);
    setCommercialNotice(null);
    try {
      const res = await fetch(`/api/vc-deals/${deal.id}/commercial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      let data: any = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          text.length > 200
            ? `Server returned HTTP ${res.status}: ${res.statusText || "Request failed"}`
            : (text || `Server returned HTTP ${res.status}`)
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || `Failed to discover commercial prospects (${res.status})`);
      }

      setCommercialNotice(data.auditSummary || "Commercial intelligence complete!");
      setTimeout(() => setCommercialNotice(null), 6000);
      router.refresh();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("load failed") || msg.toLowerCase().includes("fetch")) {
        setCommercialNotice("Commercial intelligence request timed out or was interrupted. Retrying with market intelligence...");
      } else {
        setCommercialNotice(err instanceof Error ? err.message : "Error discovering commercial prospects");
      }
    } finally {
      setIsDiscoveringCommercial(false);
    }
  }


  const totalPct = leadPct + syndicatePct + angelPct;
  const leadUsd = Math.round((targetRaise * leadPct) / 100);
  const syndicateUsd = Math.round((targetRaise * syndicatePct) / 100);
  const angelUsd = Math.round((targetRaise * angelPct) / 100);

  // Group matches by 4 tiers
  const tier1Matches = deal.matches.filter((m) => m.tier === "TIER_1_LEAD");
  const tier2Matches = deal.matches.filter((m) => m.tier === "TIER_2_SYNDICATE");
  const tier3Matches = deal.matches.filter((m) => m.tier === "TIER_3_ANGEL");
  const tier4Matches = deal.matches.filter((m) => m.tier === "TIER_4_ACCELERATOR");

  async function handleApplyCustomAllocation() {
    if (totalPct !== 100) return;
    setIsUpdatingAllocation(true);
    setAllocationNotice(null);
    try {
      const res = await fetch(`/api/vc-deals/${deal.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customPreferences: {
            leadAllocationPct: leadPct,
            syndicateAllocationPct: syndicatePct,
            angelAllocationPct: angelPct,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to recalculate syndicate allocation");
      setAllocationNotice("Syndicate allocation updated and matches refreshed!");
      setTimeout(() => setAllocationNotice(null), 4000);
      router.refresh();
    } catch (err) {
      setAllocationNotice(err instanceof Error ? err.message : "Error applying allocation");
    } finally {
      setIsUpdatingAllocation(false);
    }
  }

  const latestBlueprint = deal.syndicateBlueprints[0];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab("syndicate")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-all ${
            activeTab === "syndicate"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Syndicate Match &amp; Allocator</span>
          <Badge tone={deal.matches.length > 0 ? "green" : "neutral"} className="ml-1">
            {deal.matches.length}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("captable")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-all ${
            activeTab === "captable"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        >
          <PieChart className="h-4 w-4" />
          <span>Cap Table &amp; SAFEs</span>
          <Badge tone={safeHolders.length > 0 ? "green" : "neutral"} className="ml-1">
            {safeHolders.length} SAFE{safeHolders.length === 1 ? "" : "s"}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("spec")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-all ${
            activeTab === "spec"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Deal Spec &amp; Diligence</span>
          {deal.riskFlags.length > 0 && (
            <Badge tone="amber" className="ml-1">
              {deal.riskFlags.length} flags
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("benchmark")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-all ${
            activeTab === "benchmark"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Pro-Forma Dilution &amp; Terms</span>
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-all ${
            activeTab === "documents"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Data Room ({deal.documents.length})</span>
        </button>
      </div>

      {/* TAB 1: SYNDICATE MATCHING & ALLOCATOR */}
      {activeTab === "syndicate" && (
        <div className="space-y-6">
          {/* Interactive Allocation Customizer Card */}
          <Card className="border-emerald-200/80 bg-linear-to-b from-white to-emerald-50/20 dark:border-emerald-900/50 dark:from-neutral-900 dark:to-emerald-950/10">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle>Founder Syndicate Round Sizing &amp; Allocation</CardTitle>
                </div>
                <Badge tone="green">Target: ${targetRaise.toLocaleString()} USD</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Founders can customize the syndicate split between Lead Institutional VCs, AngelList/SPV syndicates, and domain angels.
                Defaults to the standard venture blueprint (<strong>65% Lead</strong> / <strong>25% Syndicate</strong> / <strong>10% Angels</strong>).
              </p>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                {/* Lead Slider */}
                <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Tier 1: Lead VC
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600">
                      {leadPct}% (${leadUsd.toLocaleString()})
                    </span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={85}
                    step={5}
                    value={leadPct}
                    onChange={(e) => {
                      const newLead = Number(e.target.value);
                      setLeadPct(newLead);
                      const rem = 100 - newLead;
                      const newSyn = Math.round(rem * 0.7);
                      setSyndicatePct(newSyn);
                      setAngelPct(100 - newLead - newSyn);
                    }}
                    className="w-full accent-emerald-600"
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">Price discovery &amp; board stewardship</p>
                </div>

                {/* Syndicate Slider */}
                <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Tier 2: Syndicate / SPV
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-600">
                      {syndicatePct}% (${syndicateUsd.toLocaleString()})
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={syndicatePct}
                    onChange={(e) => {
                      const newSyn = Number(e.target.value);
                      setSyndicatePct(newSyn);
                      setAngelPct(Math.max(0, 100 - leadPct - newSyn));
                    }}
                    className="w-full accent-blue-600"
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">AngelList / Sydecar co-invest</p>
                </div>

                {/* Angel Slider */}
                <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Tier 3: Strategic Angels
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-600">
                      {angelPct}% (${angelUsd.toLocaleString()})
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={5}
                    value={angelPct}
                    onChange={(e) => {
                      const newAng = Number(e.target.value);
                      setAngelPct(newAng);
                      setSyndicatePct(Math.max(0, 100 - leadPct - newAng));
                    }}
                    className="w-full accent-purple-600"
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">Operator domain expertise</p>
                </div>
              </div>

              {/* Slider Verification & Apply Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500">Allocation Check:</span>
                  <span
                    className={`font-mono font-semibold ${
                      totalPct === 100 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {totalPct}% of round allocated
                  </span>
                  {totalPct !== 100 && (
                    <span className="text-red-500 text-[11px]">
                      (Adjust sliders so total equals exactly 100%)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {allocationNotice && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      {allocationNotice}
                    </span>
                  )}
                  <Button
                    size="sm"
                    disabled={totalPct !== 100 || isUpdatingAllocation}
                    onClick={handleApplyCustomAllocation}
                    className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
                  >
                    {isUpdatingAllocation ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Apply &amp; Re-run Match
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4-TIER MATCH RESULTS */}
          {deal.matches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Sparkles className="mx-auto h-8 w-8 text-neutral-400" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    No syndicate matches synthesized yet
                  </h3>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    Synthesize matches against our verified venture database, or trigger deep AI research to find new funds matching {deal.companyName}&apos;s stage, sector, and geography.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    size="sm"
                    disabled={isUpdatingAllocation}
                    onClick={async () => {
                      setIsUpdatingAllocation(true);
                      try {
                        await fetch(`/api/vc-deals/${deal.id}/match`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({}),
                        });
                        router.refresh();
                      } finally {
                        setIsUpdatingAllocation(false);
                      }
                    }}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5"
                  >
                    {isUpdatingAllocation ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Match Syndicate Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUpdatingAllocation}
                    onClick={async () => {
                      setIsUpdatingAllocation(true);
                      try {
                        // Step 1: Search live venture databases
                        const searchRes = await fetch(`/api/vc-deals/${deal.id}/research`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ step: "search" }),
                        });
                        if (!searchRes.ok) {
                          const err = await searchRes.json().catch(() => ({}));
                          throw new Error(err.error ?? "Live venture search step failed");
                        }
                        const searchData = await searchRes.json();

                        // Step 2: Structure investor thesis, contacts, and cache cited pages
                        const structRes = await fetch(`/api/vc-deals/${deal.id}/research`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            step: "structure",
                            runId: searchData.runId,
                            hint: searchData.hint,
                            findings: searchData.findings,
                            citedUrls: searchData.citedUrls,
                          }),
                        });
                        if (!structRes.ok) {
                          const err = await structRes.json().catch(() => ({}));
                          throw new Error(err.error ?? "Structuring funder findings failed");
                        }

                        // Step 3: Match syndicate
                        await fetch(`/api/vc-deals/${deal.id}/match`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({}),
                        });

                        router.refresh();
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "Error researching investors";
                        alert(
                          msg.includes("Load failed") || msg.includes("Failed to fetch")
                            ? "Network connection timed out while querying venture databases. Please retry."
                            : msg,
                        );
                      } finally {
                        setIsUpdatingAllocation(false);
                      }
                    }}
                    className="border-purple-300 text-purple-800 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40 text-xs gap-1.5"
                  >
                    <Search className="h-3.5 w-3.5" />
                    AI Research Investors
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Targeted Autonomous Funder Research for this Deal */}
              <VcFunderDealResearchCard
                dealId={deal.id}
                companyName={deal.companyName}
                stage={deal.stage}
                vertical={deal.primaryVertical}
                jurisdiction={deal.legalEntityJurisdiction}
              />

              {/* TIER 1: LEAD INSTITUTIONAL VCS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone="green">Tier 1: Lead Mandate</Badge>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Institutional Lead VCs ({tier1Matches.length})
                    </h3>
                  </div>
                  <span className="text-xs text-neutral-500">
                    Allocated: ~${leadUsd.toLocaleString()} ({leadPct}%)
                  </span>
                </div>

                <div className="grid gap-3">
                  {tier1Matches.map((match) => (
                    <Card
                      key={match.id}
                      className="transition-all hover:border-emerald-300 dark:hover:border-emerald-800"
                    >
                      <CardContent className="pt-4 space-y-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                                {match.investor.name}
                              </h4>
                              {match.isLeadCandidate && (
                                <Badge tone="green">Primary Lead Candidate</Badge>
                              )}
                              {match.portfolioConflictDetected && (
                                <Badge tone="red">Competitor in Portfolio</Badge>
                              )}
                              <Badge tone="blue">{match.investor.type.replaceAll("_", " ")}</Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedInvestorForEdit(match.investor)}
                                className="h-5 text-[10px] px-1.5 gap-1 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
                                title="Edit investor parameters, valid jurisdictions & thesis"
                              >
                                <Edit3 className="h-2.5 w-2.5" />
                                Edit
                              </Button>
                            </div>
                            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                              {match.rationale}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {(() => {
                              const rawScore = match.thesisResonanceScore ?? 75;
                              const fitPct = Math.round(rawScore > 1 ? rawScore : rawScore * 100);
                              const badgeStyle =
                                fitPct >= 80
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                  : fitPct >= 60
                                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                                    : fitPct >= 40
                                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                                      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
                              return (
                                <span className={`inline-block rounded-md px-2 py-1 text-xs font-bold border ${badgeStyle}`}>
                                  Thesis Fit: {fitPct}%
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Investor Meta Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400">
                          <div>
                            <span className="font-medium text-neutral-500">Ticket Range:</span>
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                              ${((match.investor.minCheckUsd ?? 500000) / 1000).toFixed(0)}k - $
                              {((match.investor.maxCheckUsd ?? 2500000) / 1000000).toFixed(1)}M
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-neutral-500">Board Seat:</span>
                            <p className="text-neutral-800 dark:text-neutral-200">
                              {match.investor.takesBoardSeats ? "Required / Preferred" : "Observer / None"}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-neutral-500">Target Ownership:</span>
                            <p className="text-neutral-800 dark:text-neutral-200">
                              {match.investor.targetOwnershipPct ? `${match.investor.targetOwnershipPct}%` : "10 - 20%"}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-neutral-500">Application Route:</span>
                            <p className="text-neutral-800 dark:text-neutral-200">
                              {match.investor.applicationRoute.replaceAll("_", " ")}
                            </p>
                          </div>
                        </div>

                        {/* Conflict & Re-Verified Link Audit Details */}
                        <MatchConflictAndAuditDetails match={match} onOpenSnapshot={(u) => setCachedSnapshotUrl(u)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* TIER 2: ANGEL PLATFORMS & SYNDICATES */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">Tier 2: Co-Invest &amp; SPV</Badge>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Angel Platforms &amp; Scout Syndicates ({tier2Matches.length})
                    </h3>
                  </div>
                  <span className="text-xs text-neutral-500">
                    Allocated: ~${syndicateUsd.toLocaleString()} ({syndicatePct}%)
                  </span>
                </div>

                <div className="grid gap-3">
                  {tier2Matches.map((match) => (
                    <Card key={match.id}>
                      <CardContent className="pt-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                              {match.investor.name}
                            </h4>
                            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                              {match.rationale}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge tone="blue">{match.verdict}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedInvestorForEdit(match.investor)}
                              className="h-5 text-[10px] px-1.5 gap-1 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
                              title="Edit investor parameters & accepted jurisdictions"
                            >
                              <Edit3 className="h-2.5 w-2.5" />
                              Edit
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-[11px] text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                          <span>
                            Check Size: ${((match.investor.minCheckUsd ?? 50000) / 1000).toFixed(0)}k - $
                            {((match.investor.maxCheckUsd ?? 500000) / 1000).toFixed(0)}k
                          </span>
                          <span>Route: {match.investor.applicationRoute}</span>
                          {match.investor.applicationUrl && (
                            <a
                              href={match.investor.applicationUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              Portal <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <MatchConflictAndAuditDetails match={match} onOpenSnapshot={(u) => setCachedSnapshotUrl(u)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* TIER 3: STRATEGIC ANGELS & OPERATORS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone="purple">Tier 3: Strategic Value</Badge>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Domain Angels &amp; Operators ({tier3Matches.length})
                    </h3>
                  </div>
                  <span className="text-xs text-neutral-500">
                    Allocated: ~${angelUsd.toLocaleString()} ({angelPct}%)
                  </span>
                </div>

                <div className="grid gap-3">
                  {tier3Matches.map((match) => (
                    <Card key={match.id}>
                      <CardContent className="pt-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                              {match.investor.name}
                            </h4>
                            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                              {match.rationale}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge tone="purple">{match.verdict}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedInvestorForEdit(match.investor)}
                              className="h-5 text-[10px] px-1.5 gap-1 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
                              title="Edit investor parameters & accepted jurisdictions"
                            >
                              <Edit3 className="h-2.5 w-2.5" />
                              Edit
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-[11px] text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                          <span>
                            Ticket: ${((match.investor.minCheckUsd ?? 10000) / 1000).toFixed(0)}k - $
                            {((match.investor.maxCheckUsd ?? 50000) / 1000).toFixed(0)}k
                          </span>
                          <span>No Board Seat Needed</span>
                        </div>
                        <MatchConflictAndAuditDetails match={match} onOpenSnapshot={(u) => setCachedSnapshotUrl(u)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* TIER 4: ACCELERATORS & INCUBATORS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone="amber">Tier 4: Acceleration</Badge>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      Accelerators &amp; Incubators ({tier4Matches.length})
                    </h3>
                  </div>
                </div>

                <div className="grid gap-3">
                  {tier4Matches.map((match) => (
                    <Card key={match.id}>
                      <CardContent className="pt-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                              {match.investor.name}
                            </h4>
                            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                              {match.rationale}
                            </p>
                          </div>
                          <Badge tone="amber">{match.verdict}</Badge>
                        </div>
                        <MatchConflictAndAuditDetails match={match} onOpenSnapshot={(u) => setCachedSnapshotUrl(u)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CAP TABLE & SAFES (SAFE OWNER BALANCES SHOWN FIRST) */}
      {activeTab === "captable" && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div>
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Cap Table &amp; Convertible Securities
                </h2>
                <Badge tone="green">
                  ${totalSafesBalance.toLocaleString()} USD in SAFEs
                </Badge>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Detailed registry of pre-round SAFE noteholders, valuation caps, discount rates, and common stock allocations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditCapTableOpen(true)}
                className="gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 border-emerald-300 dark:border-emerald-800 dark:text-emerald-300"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Cap Table &amp; SAFEs
              </Button>
            </div>
          </div>

          {/* Top KPI Cards - Highlighting SAFE Balances First */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-medium mb-1">
                <span>Total SAFE Balances</span>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
                ${totalSafesBalance.toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                {safeHolders.length} convertible note{safeHolders.length === 1 ? "" : "s"} outstanding
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-medium mb-1">
                <span>Common Equity Allocated</span>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                {totalCommonEquityPct}%
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                {commonHolders.length} common shareholder{commonHolders.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-medium mb-1">
                <span>Option Pool (ESOP)</span>
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                {deal.capTable?.optionPoolPct ?? 10}%
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                {deal.capTable && deal.capTable.optionPoolPct < 10 ? "⚠️ Below 10% benchmark" : "✓ Standard venture pool"}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-medium mb-1">
                <span>Cap Table Governance</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Badge tone={deal.capTable?.hasDeadEquity ? "red" : "green"}>
                  {deal.capTable?.hasDeadEquity ? "Dead Equity Flagged" : "Clean Governance"}
                </Badge>
              </div>
              <div className="text-[11px] text-neutral-500 mt-1 truncate">
                {deal.capTable?.hasDeadEquity ? deal.capTable.deadEquityNotes || "Unvested departed founder" : "No dead equity detected"}
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigation Bar - SAFE Owner Balances First */}
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setCapTableSubTab("safes")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  capTableSubTab === "safes"
                    ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                <span>SAFE Owner Balances (Priority)</span>
                <Badge tone={safeHolders.length > 0 ? "green" : "neutral"} className="text-[10px]">
                  {safeHolders.length}
                </Badge>
              </button>

              <button
                onClick={() => setCapTableSubTab("common")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  capTableSubTab === "common"
                    ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Common Stock Holders ("Common Roders")</span>
                <Badge tone="blue" className="text-[10px]">
                  {commonHolders.length}
                </Badge>
              </button>

              <button
                onClick={() => setCapTableSubTab("overview")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  capTableSubTab === "overview"
                    ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
                }`}
              >
                <PieChart className="h-3.5 w-3.5" />
                <span>Overall Capitalization Breakdown</span>
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditCapTableOpen(true)}
              className="text-xs gap-1 mb-1 text-neutral-600 dark:text-neutral-300 shrink-0"
            >
              <Edit3 className="h-3 w-3" />
              Manage Cap Table
            </Button>
          </div>

          {/* SUB-TAB 1: SAFE OWNER BALANCES (DEFAULT & SHOWN FIRST) */}
          {capTableSubTab === "safes" && (
            <div className="space-y-4">
              <Card className="border-emerald-200/80 bg-linear-to-b from-white to-emerald-50/10 dark:border-emerald-900/50 dark:from-neutral-900 dark:to-emerald-950/10">
                <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <CardTitle>SAFE Noteholder Balances &amp; Liquidation Preference</CardTitle>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          List of all convertible instruments, valuation caps, discount provisions, and principal balances.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                      Total SAFE Balance: ${totalSafesBalance.toLocaleString()} USD
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {safeHolders.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <DollarSign className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                          No SAFE Notes Recorded
                        </p>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                          Add pre-seed/seed SAFE noteholders, valuation caps, and discount rates to track dilution and pro-forma conversion.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsEditCapTableOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Add First SAFE Note
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Noteholder / Investor</th>
                            <th className="py-2.5 px-3">Instrument</th>
                            <th className="py-2.5 px-3 text-right">Principal Balance</th>
                            <th className="py-2.5 px-3 text-right">Valuation Cap</th>
                            <th className="py-2.5 px-3 text-right">Discount</th>
                            <th className="py-2.5 px-3 text-right">Est. Dilution at Cap</th>
                            <th className="py-2.5 px-3">Notes / Issuance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
                          {safeHolders.map((s, idx) => {
                            const impliedPct = s.valuationCapUsd && s.valuationCapUsd > 0
                              ? ((Number(s.investmentAmountUsd) / Number(s.valuationCapUsd)) * 100).toFixed(2)
                              : null;
                            return (
                              <tr key={s.id || idx} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40">
                                <td className="py-3 px-3 font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                    {s.holderName.charAt(0).toUpperCase()}
                                  </div>
                                  <span>{s.holderName}</span>
                                </td>
                                <td className="py-3 px-3">
                                  <Badge tone="purple" className="text-[10px]">
                                    {s.instrumentType.replaceAll("_", " ")}
                                  </Badge>
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  ${Number(s.investmentAmountUsd).toLocaleString()} USD
                                </td>
                                <td className="py-3 px-3 text-right font-mono">
                                  {s.valuationCapUsd ? `$${Number(s.valuationCapUsd).toLocaleString()}` : "Uncapped"}
                                </td>
                                <td className="py-3 px-3 text-right font-mono">
                                  {s.discountPct ? `${s.discountPct}%` : "0%"}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-neutral-600 dark:text-neutral-300">
                                  {impliedPct ? `~${impliedPct}%` : "At Round Price"}
                                </td>
                                <td className="py-3 px-3 text-neutral-500 max-w-xs truncate">
                                  {s.dateOrNotes || "Standard YC SAFE"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 font-semibold">
                          <tr>
                            <td className="py-3 px-3 text-neutral-900 dark:text-neutral-100 font-bold" colSpan={2}>
                              Total SAFE Notes Outstanding ({safeHolders.length} note{safeHolders.length === 1 ? "" : "s"})
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ${totalSafesBalance.toLocaleString()} USD
                            </td>
                            <td colSpan={4} className="py-3 px-3 text-right text-neutral-500 font-normal">
                              Converts into Preferred Shares at incoming Qualified Financing
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Peek at Common Holders */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/60 text-xs">
                <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>
                    <strong>{commonHolders.length} Common Stockholders ("Common Roders")</strong> hold <strong>{totalCommonEquityPct}%</strong> of total equity.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCapTableSubTab("common")}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 gap-1"
                >
                  View Common Stock Holders &rarr;
                </Button>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: COMMON STOCK HOLDERS ("COMMON RODERS") */}
          {capTableSubTab === "common" && (
            <div className="space-y-4">
              <Card className="border-blue-200/80 bg-linear-to-b from-white to-blue-50/10 dark:border-blue-900/50 dark:from-neutral-900 dark:to-blue-950/10">
                <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <CardTitle>Common Stock Holders ("Common Roders") &amp; Equity Allocation</CardTitle>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Founders, key personnel, early advisors, and the unallocated stock option pool (ESOP).
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-mono font-bold text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                      Total Common: {totalCommonEquityPct}%
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {commonHolders.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <Users className="mx-auto h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                          No Common Stockholders Recorded
                        </p>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                          Add founders, team members, or employee option pool allocations to track voting control and cap table health.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsEditCapTableOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Configure Common Stock
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Shareholder</th>
                            <th className="py-2.5 px-3">Role / Relationship</th>
                            <th className="py-2.5 px-3 text-right">Shares Count</th>
                            <th className="py-2.5 px-3 text-right">Common Equity %</th>
                            <th className="py-2.5 px-3">Vesting Terms &amp; Cliff</th>
                            <th className="py-2.5 px-3 text-right">Governance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
                          {commonHolders.map((c, idx) => (
                            <tr key={c.id || idx} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40">
                              <td className="py-3 px-3 font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                  {c.holderName.charAt(0).toUpperCase()}
                                </div>
                                <span>{c.holderName}</span>
                              </td>
                              <td className="py-3 px-3">
                                <Badge tone="blue" className="text-[10px]">
                                  {c.roleOrRelationship}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                                {c.shareCount ? c.shareCount.toLocaleString() : "—"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                {c.ownershipPct}%
                              </td>
                              <td className="py-3 px-3 text-neutral-600 dark:text-neutral-400">
                                {c.vestingTerms || "Standard 4-year monthly, 1-year cliff"}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                                  Voting Common
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/50 font-semibold">
                          <tr>
                            <td className="py-3 px-3 text-neutral-900 dark:text-neutral-100 font-bold" colSpan={3}>
                              Total Common Stockholders ({commonHolders.length} holder{commonHolders.length === 1 ? "" : "s"})
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                              {totalCommonEquityPct}%
                            </td>
                            <td colSpan={2} className="py-3 px-3 text-right text-neutral-500 font-normal">
                              Subject to round dilution upon SAFE conversion
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation back to SAFE view */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/60 text-xs">
                <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span>
                    <strong>{safeHolders.length} SAFE Notes</strong> outstanding totaling <strong>${totalSafesBalance.toLocaleString()} USD</strong>.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCapTableSubTab("safes")}
                  className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 gap-1"
                >
                  &larr; View SAFE Owner Balances
                </Button>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: OVERALL CAPITALIZATION BREAKDOWN */}
          {capTableSubTab === "overview" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-emerald-600" />
                      <CardTitle>Pre-Round Capitalization &amp; Equity Split</CardTitle>
                    </div>
                    <Badge tone={deal.capTable?.hasDeadEquity ? "red" : "green"}>
                      {deal.capTable?.hasDeadEquity ? "Dead Equity Flagged" : "Clean Governance"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-xs">
                  {/* Visual Distribution Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-neutral-500 mb-1.5">
                      <span>Equity Distribution</span>
                      <span>Total: 100%</span>
                    </div>
                    <div className="flex h-5 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
                      <div
                        style={{ width: `${deal.capTable?.foundersOwnershipPct ?? 80}%` }}
                        className="bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                        title={`Founders: ${deal.capTable?.foundersOwnershipPct ?? 80}%`}
                      >
                        Founders {deal.capTable?.foundersOwnershipPct ?? 80}%
                      </div>
                      <div
                        style={{ width: `${deal.capTable?.investorOwnershipPct ?? 10}%` }}
                        className="bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                        title={`Prior Investors: ${deal.capTable?.investorOwnershipPct ?? 10}%`}
                      >
                        Investors {deal.capTable?.investorOwnershipPct ?? 10}%
                      </div>
                      <div
                        style={{ width: `${deal.capTable?.optionPoolPct ?? 10}%` }}
                        className="bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                        title={`Option Pool: ${deal.capTable?.optionPoolPct ?? 10}%`}
                      >
                        Pool {deal.capTable?.optionPoolPct ?? 10}%
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
                        <span>Founders ({deal.capTable?.foundersOwnershipPct ?? 80}%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
                        <span>Prior Investors ({deal.capTable?.investorOwnershipPct ?? 10}%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-600 inline-block" />
                        <span>Employee Pool ({deal.capTable?.optionPoolPct ?? 10}%)</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <span className="text-neutral-500 block mb-0.5">Founders Equity</span>
                      <span className="text-lg font-bold font-mono text-emerald-600">
                        {deal.capTable?.foundersOwnershipPct ?? 80}%
                      </span>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Across {deal.founders.length} co-founder{deal.founders.length === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <span className="text-neutral-500 block mb-0.5">Prior Investors</span>
                      <span className="text-lg font-bold font-mono text-blue-600">
                        {deal.capTable?.investorOwnershipPct ?? 10}%
                      </span>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Plus ${totalSafesBalance.toLocaleString()} USD in unconverted SAFEs
                      </p>
                    </div>

                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <span className="text-neutral-500 block mb-0.5">Employee Option Pool</span>
                      <span className="text-lg font-bold font-mono text-purple-600">
                        {deal.capTable?.optionPoolPct ?? 10}%
                      </span>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Unallocated shares for team
                      </p>
                    </div>
                  </div>

                  {deal.capTable?.hasDeadEquity && (
                    <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold">Dead Equity Warning: </strong>
                          <span>
                            {deal.capTable.deadEquityNotes ||
                              "Dead equity detected on cap table. Institutional investors will require remediation or repurchase before closing."}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DEAL SPEC & DILIGENCE */}
      {activeTab === "spec" && (
        <div className="space-y-6">
          {/* Core Startup & Legal Entity Spec Table */}
          <Card className="border-emerald-200/80 bg-linear-to-b from-white to-emerald-50/15 dark:border-emerald-900/50 dark:from-neutral-900 dark:to-emerald-950/10">
            <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <CardTitle>Core Startup &amp; Legal Entity Spec</CardTitle>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Deterministic parameters extracted from data room documents, used to filter syndicates &amp; institutional investors.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditDealOpen(true)}
                  className="gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 border-emerald-300 dark:border-emerald-800 dark:text-emerald-300"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Deal Spec
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Extracted Value</th>
                      <th className="py-2 px-3">Diligence Notes / Rule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-800 dark:text-neutral-200">
                    <tr className="bg-emerald-50/40 dark:bg-emerald-950/20">
                      <td className="py-2.5 px-3 font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Legal Entity Jurisdiction
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 font-bold text-xs text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-xs dark:bg-neutral-800 dark:text-emerald-300 dark:border-emerald-700">
                          <Globe className="h-3.5 w-3.5 text-emerald-600" />
                          {deal.legalEntityJurisdiction || "Not Specified (Global)"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">
                        Primary geographic gate for syndicate lead funds &amp; co-investors
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Company Legal Name
                      </td>
                      <td className="py-2.5 px-3 font-semibold">{deal.companyName}</td>
                      <td className="py-2.5 px-3 text-neutral-500">Inferred from articles of incorporation / deck title</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Venture Stage
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge tone="blue">{deal.stage.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">Filters Tier 1 Lead VC check size and check minimums</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Primary Vertical
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge tone="purple">{deal.primaryVertical.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">Sector thesis matching and anti-portfolio conflict check</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Target Industry &amp; Sub-Markets
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {deal.industry || `${deal.primaryVertical.replaceAll("_", " ")} Solutions`}
                        </div>
                        {deal.subIndustries && deal.subIndustries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {deal.subIndustries.map((sub, sIdx) => (
                              <Badge key={sIdx} tone="neutral" className="text-[10px]">
                                {sub}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">
                        Granular industry category used for active thesis deployment verification
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Target Financing Raise
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">
                        ${ask?.targetRaiseUsd.toLocaleString() ?? "1,500,000"} USD
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">Sizes the 65% Lead / 25% Syndicate / 10% Angel tranche split</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Valuation Cap / Target Pricing
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold">
                        {ask?.valuationCapUsd ? `$${ask.valuationCapUsd.toLocaleString()} USD` : "Uncapped / Market Determined"}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">Determines pre-money and post-money founder dilution model</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Round Instrument
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {ask?.instrumentType.replaceAll("_", " ") ?? "POST MONEY SAFE"}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">YC Post-Money SAFE / Convertible Note / Priced Equity</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-neutral-600 dark:text-neutral-400">
                        Planned Runway
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {ask?.plannedRunwayMonths ?? 18} months
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500">Burn rate and time to next milestone validation</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          {/* Risk Alerts */}
          {deal.riskFlags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Automated Diligence &amp; Cap Table Risk Diagnostics
              </h3>
              <div className="grid gap-2">
                {deal.riskFlags.map((rf) => (
                  <div
                    key={rf.id}
                    className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{rf.category}</span>
                        <Badge tone={rf.severity >= 4 ? "red" : "amber"}>
                          Severity {rf.severity}/5
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">
                        {rf.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deal Spec Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Financing Ask Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <CardTitle>Financing Ask</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Target Raise:</span>
                  <span className="font-semibold font-mono text-neutral-900 dark:text-neutral-100">
                    ${ask?.targetRaiseUsd.toLocaleString() ?? "1,500,000"} USD
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Instrument Type:</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {ask?.instrumentType.replaceAll("_", " ") ?? "POST MONEY SAFE"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Valuation Cap:</span>
                  <span className="font-semibold font-mono text-neutral-900 dark:text-neutral-100">
                    {ask?.valuationCapUsd
                      ? `$${ask.valuationCapUsd.toLocaleString()} USD`
                      : "Uncapped / Market Lead"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Planned Runway:</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {ask?.plannedRunwayMonths ?? 18} months
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Lead Status:</span>
                  <Badge tone={ask?.leadCommitted ? "green" : "neutral"}>
                    {ask?.leadCommitted ? "Committed" : "Seeking Lead"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Cap Table Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-blue-600" />
                  <CardTitle>Pre-Round Capitalization</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-2 text-xs">
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Founders Ownership:</span>
                  <span className="font-semibold font-mono text-neutral-900 dark:text-neutral-100">
                    {deal.capTable?.foundersOwnershipPct ?? 80}%
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Prior Investors:</span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-100">
                    {deal.capTable?.investorOwnershipPct ?? 10}%
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-500">Unallocated Option Pool:</span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-100">
                    {deal.capTable?.optionPoolPct ?? 10}%
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Dead Equity Audit:</span>
                  <Badge tone={deal.capTable?.hasDeadEquity ? "red" : "green"}>
                    {deal.capTable?.hasDeadEquity ? "Dead Equity Flagged" : "Clean Cap Table"}
                  </Badge>
                </div>
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveTab("captable");
                      setCapTableSubTab("safes");
                    }}
                    className="w-full text-xs gap-1.5 text-emerald-700 hover:text-emerald-800 border-emerald-300 dark:border-emerald-800 dark:text-emerald-300"
                  >
                    <PieChart className="h-3.5 w-3.5" />
                    View SAFE Balances &amp; Cap Table Registry &rarr;
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Founders Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Founders &amp; Key Personnel
            </h3>
            {deal.founders.length === 0 ? (
              <p className="text-xs text-neutral-400">
                Founders will be extracted automatically from pitch decks and cap table sheets.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {deal.founders.map((f) => (
                  <Card key={f.id}>
                    <CardContent className="pt-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {f.name}
                        </span>
                        <Badge tone="blue">{f.role}</Badge>
                      </div>
                      <div className="space-y-1 text-neutral-500 text-[11px]">
                        <p>Equity Ownership: {f.equityOwnershipPct}%</p>
                        <p>Technical Founder: {f.isTechnical ? "Yes" : "No"}</p>
                        <p>Repeat Founder: {f.isRepeatFounder ? "Yes" : "First-Time"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Competitors & Anti-Portfolio Landscape Card */}
          <Card className="border-purple-200/80 bg-linear-to-b from-white to-purple-50/15 dark:border-purple-900/50 dark:from-neutral-900 dark:to-purple-950/10">
            <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <div>
                    <CardTitle>Competitors &amp; Anti-Portfolio Landscape</CardTitle>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Direct &amp; adjacent commercial rivals, backed venture funds, and live HTTP re-verified source evidence.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={(deal.competitors || []).length > 0 ? "purple" : "neutral"}>
                    {(deal.competitors || []).length} Discovered
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isDiscoveringCompetitors}
                    onClick={handleDiscoverCompetitors}
                    className="gap-1.5 text-xs text-purple-700 hover:text-purple-800 border-purple-300 dark:border-purple-800 dark:text-purple-300"
                  >
                    {isDiscoveringCompetitors ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    {isDiscoveringCompetitors ? "Discovering Rivals..." : "Discover / Re-run Competitor Intelligence"}
                  </Button>
                </div>
              </div>
              {competitorNotice && (
                <div className="mt-2 text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded">
                  {competitorNotice}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {(!deal.competitors || deal.competitors.length === 0) ? (
                <div className="py-8 text-center space-y-3">
                  <Search className="mx-auto h-7 w-7 text-neutral-400" />
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    No competitors mapped yet. Run automated competitor intelligence to discover direct market rivals,
                    identify venture funds backing them, and detect anti-portfolio conflicts.
                  </p>
                  <Button
                    size="sm"
                    disabled={isDiscoveringCompetitors}
                    onClick={handleDiscoverCompetitors}
                    className="bg-purple-700 hover:bg-purple-800 text-white text-xs gap-1.5"
                  >
                    {isDiscoveringCompetitors ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Run Competitor Discovery
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {deal.competitors.map((comp) => (
                    <div
                      key={comp.id}
                      className="rounded-lg border border-neutral-200/90 bg-white p-3.5 space-y-2 dark:border-neutral-800 dark:bg-neutral-900/70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                              {comp.name}
                            </h4>
                            <Badge
                              tone={
                                comp.overlapDegree === "DIRECT"
                                  ? "red"
                                  : comp.overlapDegree === "INDIRECT"
                                  ? "amber"
                                  : "blue"
                              }
                              className="text-[10px]"
                            >
                              {comp.overlapDegree}
                            </Badge>
                          </div>
                          {comp.websiteUrl && (
                            <a
                              href={comp.websiteUrl.startsWith("http") ? comp.websiteUrl : `https://${comp.websiteUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-0.5"
                            >
                              {comp.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                        {comp.sourceVerified ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                            ✓ HTTP {comp.sourceHttpStatus || 200}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-mono text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                            {comp.sourceHttpStatus ? `HTTP ${comp.sourceHttpStatus}` : "Unverified"}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                        {comp.description}
                      </p>

                      {comp.differentiation && (
                        <div className="rounded bg-neutral-50 p-2 text-[11px] text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400">
                          <strong className="text-neutral-800 dark:text-neutral-200">Our Differentiation: </strong>
                          {comp.differentiation}
                        </div>
                      )}

                      {comp.knownInvestors && comp.knownInvestors.length > 0 && (
                        <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800 text-[11px]">
                          <span className="font-medium text-neutral-500 text-[10px] uppercase tracking-wider block mb-1">
                            Known Backers / Venture Funds:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {comp.knownInvestors.map((inv, iIdx) => (
                              <span
                                key={iIdx}
                                className="inline-flex items-center rounded-sm bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                              >
                                {inv}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {comp.sourceUrl && (
                        <div className="pt-1 text-[10px] text-neutral-400 flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center gap-1 truncate max-w-[70%]">
                            <span>Evidence:</span>
                            <a
                              href={comp.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-600 hover:underline truncate"
                            >
                              {comp.sourceUrl}
                            </a>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCachedSnapshotUrl(comp.sourceUrl)}
                            className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-mono text-neutral-700 hover:bg-neutral-200 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 shrink-0 transition-colors cursor-pointer"
                            title="View cached audit snapshot of cited competitor page"
                          >
                            <FileText className="h-2.5 w-2.5 text-emerald-600" />
                            <span>Cached Page</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Potential Customers & Strategic Partners Card */}
          <Card className="border-emerald-200/80 bg-linear-to-b from-white to-emerald-50/15 dark:border-emerald-900/50 dark:from-neutral-900 dark:to-emerald-950/10">
            <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <CardTitle>Potential Customers &amp; Strategic Partners</CardTitle>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Target enterprise buyer accounts (ICP), ecosystem integration platforms, and strategic distribution channels.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={(deal.commercialProspects || []).length > 0 ? "green" : "neutral"}>
                    {(deal.commercialProspects || []).length} Mapped
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isDiscoveringCommercial}
                    onClick={handleDiscoverCommercial}
                    className="gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 border-emerald-300 dark:border-emerald-800 dark:text-emerald-300"
                  >
                    {isDiscoveringCommercial ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    {isDiscoveringCommercial ? "Discovering Prospects..." : "Discover / Re-run Commercial Intelligence"}
                  </Button>
                </div>
              </div>
              {commercialNotice && (
                <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded">
                  {commercialNotice}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {(!deal.commercialProspects || deal.commercialProspects.length === 0) ? (
                <div className="py-8 text-center space-y-3">
                  <Building2 className="mx-auto h-7 w-7 text-neutral-400" />
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    No commercial customers or strategic partners mapped yet. Run automated commercial intelligence to discover target enterprise buyer accounts (ICP) and high-leverage distribution partners.
                  </p>
                  <Button
                    size="sm"
                    disabled={isDiscoveringCommercial}
                    onClick={handleDiscoverCommercial}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5"
                  >
                    {isDiscoveringCommercial ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Run Commercial Discovery
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {deal.commercialProspects.map((prospect) => (
                    <div
                      key={prospect.id}
                      className="rounded-lg border border-neutral-200/90 bg-white p-3.5 space-y-2.5 dark:border-neutral-800 dark:bg-neutral-900/70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                              {prospect.name}
                            </span>
                            {prospect.websiteUrl && (
                              <a
                                href={prospect.websiteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-neutral-400 hover:text-neutral-600 transition-colors"
                                title="Visit website"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {prospect.buyerPersona && (
                            <span className="text-[11px] text-neutral-500 block mt-0.5">
                              Target Buyer / Persona: <span className="font-medium text-neutral-700 dark:text-neutral-300">{prospect.buyerPersona}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            tone={
                              prospect.category === "ENTERPRISE_CUSTOMER"
                                ? "green"
                                : prospect.category === "SMB_CUSTOMER_SEGMENT"
                                ? "blue"
                                : prospect.category === "STRATEGIC_CHANNEL_PARTNER"
                                ? "purple"
                                : prospect.category === "INTEGRATION_ALLIANCE"
                                ? "amber"
                                : "neutral"
                            }
                          >
                            {prospect.category === "ENTERPRISE_CUSTOMER"
                              ? "Enterprise Buyer"
                              : prospect.category === "SMB_CUSTOMER_SEGMENT"
                              ? "SMB Customer"
                              : prospect.category === "STRATEGIC_CHANNEL_PARTNER"
                              ? "Channel Partner"
                              : prospect.category === "INTEGRATION_ALLIANCE"
                              ? "Integration Alliance"
                              : "Ecosystem Partner"}
                          </Badge>
                          <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {prospect.estimatedAcvTier === "OVER_250K"
                              ? ">$250k ACV"
                              : prospect.estimatedAcvTier === "100K_TO_250K"
                              ? "$100k-$250k ACV"
                              : prospect.estimatedAcvTier === "25K_TO_100K"
                              ? "$25k-$100k ACV"
                              : "<$25k ACV"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50/80 dark:bg-neutral-800/40 p-2.5 rounded border border-neutral-100 dark:border-neutral-800">
                        <div>
                          <span className="font-medium text-neutral-700 dark:text-neutral-200">Use Case &amp; Pain Point: </span>
                          <span>{prospect.useCaseFit}</span>
                        </div>
                        {prospect.strategicSynergy && (
                          <div className="pt-1 border-t border-neutral-200/60 dark:border-neutral-700/60">
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">GTM / Synergy Leverage: </span>
                            <span>{prospect.strategicSynergy}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-1 text-[10px] text-neutral-400 flex flex-wrap items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                          {prospect.sourceVerified ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                              <CheckCircle2 className="h-3 w-3" />
                              HTTP 200 Verified
                            </span>
                          ) : (
                            <span className="text-neutral-400">Web Research Verified</span>
                          )}
                          {prospect.sourceUrl && (
                            <a
                              href={prospect.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:underline truncate"
                            >
                              {prospect.sourceUrl}
                            </a>
                          )}
                        </div>

                        {(prospect.sourceUrl || prospect.websiteUrl) && (
                          <button
                            type="button"
                            onClick={() => setCachedSnapshotUrl(prospect.sourceUrl || prospect.websiteUrl)}
                            className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-mono text-neutral-700 hover:bg-neutral-200 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 shrink-0 transition-colors cursor-pointer"
                            title="View cached audit snapshot of cited entity"
                          >
                            <FileText className="h-2.5 w-2.5 text-emerald-600" />
                            <span>Cached Page</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}


      {/* TAB 3: PRO-FORMA DILUTION & BENCHMARK */}
      {activeTab === "benchmark" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-600" />
                  <CardTitle>Pro-Forma Dilution &amp; Round Economics</CardTitle>
                </div>
                {latestBlueprint && (
                  <span className="text-xs text-neutral-400">
                    Calculated: {new Date(latestBlueprint.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {latestBlueprint ? (
                <div className="space-y-4 text-xs">
                  <div className="rounded-lg bg-neutral-50 p-3.5 dark:bg-neutral-800/60 leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {latestBlueprint.synthesisSummary}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-neutral-700 dark:text-neutral-300">
                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <span className="text-neutral-500">Lead Check:</span>
                      <p className="text-sm font-bold font-mono text-emerald-600">
                        ${latestBlueprint.leadAllocationUsd.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <span className="text-neutral-500">Syndicate Check:</span>
                      <p className="text-sm font-bold font-mono text-blue-600">
                        ${latestBlueprint.syndicateAllocationUsd.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <span className="text-neutral-500">Angels Total:</span>
                      <p className="text-sm font-bold font-mono text-purple-600">
                        ${latestBlueprint.angelAllocationUsd.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <span className="text-neutral-500">Recommended Cap:</span>
                      <p className="text-sm font-bold font-mono text-neutral-900 dark:text-neutral-100">
                        {latestBlueprint.recommendedValuationCapUsd
                          ? `$${latestBlueprint.recommendedValuationCapUsd.toLocaleString()}`
                          : "Market Cap"}
                      </p>
                    </div>
                  </div>

                  {latestBlueprint.dilutionModelJson && (
                    <div className="rounded-lg border border-neutral-200 overflow-hidden dark:border-neutral-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-semibold">
                          <tr>
                            <th className="p-2.5">Stakeholder</th>
                            <th className="p-2.5">Pre-Round Ownership</th>
                            <th className="p-2.5">Post-Round Ownership</th>
                            <th className="p-2.5">Effective Dilution</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                          <tr>
                            <td className="p-2.5 font-medium">Founding Team</td>
                            <td className="p-2.5 font-mono">
                              {latestBlueprint.dilutionModelJson.founderPrePct ?? 80}%
                            </td>
                            <td className="p-2.5 font-mono font-semibold text-emerald-600">
                              {latestBlueprint.dilutionModelJson.founderPostPct ?? 65}%
                            </td>
                            <td className="p-2.5 font-mono text-neutral-500">
                              {latestBlueprint.dilutionModelJson.founderDilutionPct ?? 18.7}%
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-medium">New Investors (Syndicate)</td>
                            <td className="p-2.5 font-mono">0.0%</td>
                            <td className="p-2.5 font-mono font-semibold text-blue-600">
                              {latestBlueprint.dilutionModelJson.investorPostPct ?? 22}%
                            </td>
                            <td className="p-2.5 font-mono text-neutral-500">--</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-medium">Employee Option Pool</td>
                            <td className="p-2.5 font-mono">
                              {latestBlueprint.dilutionModelJson.poolPrePct ?? 10}%
                            </td>
                            <td className="p-2.5 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                              {latestBlueprint.dilutionModelJson.poolPostPct ?? 13}%
                            </td>
                            <td className="p-2.5 font-mono text-neutral-500">
                              +3% refresh
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <p className="text-xs text-neutral-500">
                    No pro-forma term sheet benchmark generated yet. Click &quot;Benchmark Terms&quot; in the header to run valuation cap &amp; liquidation preference benchmarking.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: DATA ROOM DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Uploaded Documents &amp; Models ({deal.documents.length})
            </h3>
            {deal.documents.length === 0 ? (
              <p className="text-xs text-neutral-400">No documents uploaded yet.</p>
            ) : (
              <div className="grid gap-2">
                {deal.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {doc.blobUrl.includes("docs.google.com") ? (
                        <Globe className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : doc.fileName.endsWith(".xlsx") || doc.fileName.endsWith(".csv") ? (
                        <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                          {doc.fileName}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {doc.sizeBytes > 0
                            ? `${Math.round(doc.sizeBytes / 1024)} KB · `
                            : ""}
                          Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.documentTypes.map((dt) => (
                        <Badge key={dt} tone="neutral">
                          {dt.replace("VC_", "")}
                        </Badge>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDocForExtraction(doc)}
                        className="h-7 text-[11px] px-2 gap-1 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                        title="View or Edit Raw Extracted JSON"
                      >
                        <FileCode className="h-3 w-3 text-blue-600" />
                        View / Edit JSON
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDocForExtraction(doc)}
                        className="h-7 text-[11px] px-2 gap-1 text-neutral-700 hover:text-neutral-900 dark:text-neutral-300"
                        title="Re-run AI Extraction for this document"
                      >
                        <RefreshCw className="h-3 w-3 text-emerald-600" />
                        Re-run
                      </Button>
                      {doc.blobUrl.startsWith("http") && (
                        <a
                          href={`/api/vc-deals/${deal.id}/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-neutral-400 hover:text-neutral-700"
                          title="Open document"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add more documents dropzone */}
          <div className="pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Add More Pitch Decks, Cap Tables or Google Sheets
            </h4>
            <VcUploadDropzone existingDealId={deal.id} />
          </div>
        </div>
      )}

      {/* Edit Deal Spec Modal */}
      {isEditDealOpen && (
        <EditVcDealModal deal={deal} onClose={() => setIsEditDealOpen(false)} />
      )}

      {/* View / Edit Extraction JSON Modal */}
      {selectedDocForExtraction && (
        <DocumentExtractionModal
          dealId={deal.id}
          document={selectedDocForExtraction}
          dealType="vc"
          onClose={() => setSelectedDocForExtraction(null)}
        />
      )}

      {/* Edit Investor Modal */}
      {selectedInvestorForEdit && (
        <EditVcInvestorModal
          investor={selectedInvestorForEdit}
          dealId={deal.id}
          onClose={() => setSelectedInvestorForEdit(null)}
        />
      )}

      {/* Edit Cap Table Modal */}
      {isEditCapTableOpen && (
        <EditCapTableModal
          dealId={deal.id}
          initialSafes={safeHolders}
          initialCommon={commonHolders}
          initialSafesTotal={totalSafesBalance}
          onClose={() => setIsEditCapTableOpen(false)}
        />
      )}

      {/* Cached Source Page Snapshot Modal */}
      <CachedPageModal
        url={cachedSnapshotUrl}
        isOpen={Boolean(cachedSnapshotUrl)}
        onClose={() => setCachedSnapshotUrl(null)}
      />
    </div>
  );
}
