import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import {
  FileText,
  GitCompare,
  Search,
  Scale,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  Building,
  Anchor,
  TrendingUp,
  Cpu,
} from "lucide-react";

export function TradePipelineExplainer() {
  const steps = [
    {
      num: "01",
      icon: <FileText className="h-5 w-5 text-blue-500" />,
      title: "Paired Document Intake & OCR",
      tag: "Mistral-OCR + LLM",
      description:
        "Scans paired Buy Leg (Supplier → Trader) and Sell Leg (Trader → Buyer) contracts, concession permits (IUP, RSPO, Health certs), surveyor reports (LHV), and ocean bills of lading.",
    },
    {
      num: "02",
      icon: <GitCompare className="h-5 w-5 text-amber-500" />,
      title: "Paired Reconciliation Engine",
      tag: "Deterministic Math Engine",
      description:
        "Validates laycan tolerance (±5-10%), Incoterm transfer point (FOB to CIF), unit pricing gross margin spread, and computes exact cashflow gap days.",
    },
    {
      num: "03",
      icon: <Search className="h-5 w-5 text-purple-500" />,
      title: "Web Spider & DSL Validator",
      tag: "Exa / Spider + DSL Rules",
      description:
        "Autonomous agent spiders institutional trade desks and commodity banks for published tariffs, exact rate quote snippets, and verified desk contact channels.",
    },
    {
      num: "04",
      icon: <Scale className="h-5 w-5 text-emerald-500" />,
      title: "Two-Tier Match Cascade",
      tag: "Umbrella Priority → Modular",
      description:
        "First tests for single Umbrella Facilities covering the full trade cycle. Fallback triggers modular syndication (Supplier Pre-Export + Cargo Repo + Buyer Usance).",
    },
    {
      num: "05",
      icon: <FileCheck2 className="h-5 w-5 text-indigo-500" />,
      title: "Deterministic LMA Term Sheet",
      tag: "LMA Standards + Formulas",
      description:
        "Synthesizes borrowing base limits, deterministic blended pricing formulas (SOFR + margin), advance rates, and Conditions Precedent (CPs) with full audit lineage.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 5-Stage Autonomous Agent Pipeline */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Trade Finance Engine: Autonomous Multi-Agent Pipeline</CardTitle>
              <p className="text-xs text-neutral-500 mt-0.5">
                End-to-end processing pipeline from paired bilateral contracts to deterministic LMA credit facilities.
              </p>
            </div>
            <Badge tone="purple">5-Stage Deterministic + Agent Pipeline</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {steps.map((s, idx) => (
              <div
                key={s.num}
                className="relative flex flex-col justify-between rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-800/40"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-neutral-400">{s.num}</span>
                    <Badge tone="neutral" className="text-[10px]">
                      {s.tag}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {s.icon}
                    <h4 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">{s.title}</h4>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {s.description}
                  </p>
                </div>
                {idx < steps.length - 1 && (
                  <div className="hidden md:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-neutral-300 dark:text-neutral-600">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tripartite International Trade Structure & Financing Legs */}
      <Card className="border-blue-200 bg-gradient-to-br from-white to-blue-50/20 dark:border-blue-900/40 dark:from-neutral-900 dark:to-blue-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Anchor className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Tripartite International Trade Flow &amp; Financing Facilities
              </CardTitle>
              <p className="text-xs text-neutral-500 mt-0.5">
                Physical cargo flow vs capital flow, showing where each modular financing instrument and umbrella facility attaches.
              </p>
            </div>
            <Badge tone="blue">Tripartite Architecture</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Leg 1: Supplier */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-blue-600 dark:text-blue-400">
                  Leg 1: Supply Origin
                </span>
                <Badge tone="neutral" className="text-[9px]">FOB Load Port</Badge>
              </div>
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Building className="h-4 w-4 text-neutral-500" />
                Concession Producer
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Mine / Mill / Concession (e.g. IUP-OP, RSPO Certified Estate)
              </p>
              <div className="mt-3 rounded-lg bg-blue-50/60 p-2.5 text-[11px] text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 border border-blue-100 dark:border-blue-900/60">
                <strong>Facility:</strong> Pre-Shipment Advance / PO Finance<br />
                <strong>Collateral:</strong> Concession pledge, SIMPONI royalties, LHV surveyor certificate.
              </div>
            </div>

            {/* Leg 2: Trader */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-purple-600 dark:text-purple-400">
                  Leg 2: Principal Trader
                </span>
                <Badge tone="purple" className="text-[9px]">In-Transit Transit</Badge>
              </div>
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Commodity Merchant Hub
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Aggregator / Trading Desk (e.g. Singapore, UAE, Hong Kong)
              </p>
              <div className="mt-3 rounded-lg bg-purple-50/60 p-2.5 text-[11px] text-purple-900 dark:bg-purple-950/40 dark:text-purple-200 border border-purple-100 dark:border-purple-900/60">
                <strong>Facility:</strong> Cargo Repo / Back-to-Back LC<br />
                <strong>Collateral:</strong> Full set 3/3 Negotiable Ocean BL, cargo marine insurance, escrow trust.
              </div>
            </div>

            {/* Leg 3: Buyer */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
                  Leg 3: Destination Offtaker
                </span>
                <Badge tone="green" className="text-[9px]">CIF Discharge Port</Badge>
              </div>
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                End Buyer / Offtaker
              </h4>
              <p className="text-xs text-neutral-500 mt-1">
                Power Utility / Steel Smelter / Import Conglomerate
              </p>
              <div className="mt-3 rounded-lg bg-emerald-50/60 p-2.5 text-[11px] text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-900/60">
                <strong>Facility:</strong> Usance LC Discounting / Receivables Factoring<br />
                <strong>Collateral:</strong> Irrevocable MT700 LC, assignment of offtake proceeds, credit insurance.
              </div>
            </div>
          </div>

          {/* Unified Umbrella Facility Banner */}
          <div className="mt-4 rounded-xl border border-purple-300 bg-purple-50/40 p-3.5 text-xs text-purple-950 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>
                <strong>Tier 1 Priority: Umbrella Facility:</strong> Unifies all 3 legs into a single Borrowing Base Facility covering the entire cashflow gap days from load to final discharge settlement.
              </span>
            </div>
            <Badge tone="purple" className="shrink-0">Covers Full Cycle Buy → Sell</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Trade Finance Architecture Diagram */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Trade Finance System Architecture &amp; Multi-Agent Workflow</CardTitle>
              <p className="text-xs text-neutral-500 mt-0.5">
                Detailed interaction diagram: Paired contract intake, deterministic math engine, two-tier match cascade, autonomous spider with DSL validation loop, and LMA term sheet benchmark.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/diagrams/trade_architecture_review.png"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400 font-medium"
              >
                View Full Resolution ↗
              </a>
              <Badge tone="blue">Trade Finance Architecture</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 p-2 shadow-inner dark:border-neutral-800">
            <Image
              src="/diagrams/trade_architecture_review.png"
              alt="Capital Sourcing Platform Trade Finance Multi-Agent Architecture Infographic"
              width={1920}
              height={1080}
              className="h-auto w-full rounded-lg object-contain"
              priority
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
