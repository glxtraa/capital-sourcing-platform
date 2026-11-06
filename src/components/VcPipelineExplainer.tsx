"use client";

import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { CheckCircle2, Layers, ShieldAlert, Sparkles, Target, Users, Zap } from "lucide-react";

export function VcPipelineExplainer() {
  return (
    <Card className="border-neutral-200/80 bg-linear-to-b from-white to-neutral-50/50 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle>Systematic Startup VC Syndicate Matching Engine</CardTitle>
          </div>
          <Badge tone="green">Multi-Tier Architecture</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
          Unlike manual investor lists, this platform runs a systematic 4-tier syndicate synthesis across five distinct capital archetypes.
          Pitch decks, Excel models, and Google Sheets are cross-reconciled against verified thesis mandates, anti-portfolio conflicts, and founder ownership parameters.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Tier 1 */}
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Tier 1
              </span>
              <Badge tone="green">Lead Mandate</Badge>
            </div>
            <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Institutional Lead VCs
            </h4>
            <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 leading-normal">
              Price-setters taking 50–70% of the round ($750k–$3M+ checks), taking board seats, and requiring 10–20% ownership targets.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                Sequoia
              </span>
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                Benchmark
              </span>
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                Founders Fund
              </span>
            </div>
          </div>

          {/* Tier 2 */}
          <div className="rounded-xl border border-blue-200/60 bg-blue-50/40 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Tier 2
              </span>
              <Badge tone="blue">SPV &amp; Co-Invest</Badge>
            </div>
            <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Angel Platforms &amp; Syndicates
            </h4>
            <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 leading-normal">
              Follow-on capacity (20–30% of round) syndicated via AngelList, Sydecar, Vauban, and venture scout co-invest networks.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                AngelList SPV
              </span>
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                Sequoia Scouts
              </span>
            </div>
          </div>

          {/* Tier 3 */}
          <div className="rounded-xl border border-purple-200/60 bg-purple-50/40 p-3.5 dark:border-purple-900/40 dark:bg-purple-950/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                Tier 3
              </span>
              <Badge tone="purple">Strategic Value</Badge>
            </div>
            <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Domain Angels &amp; Operators
            </h4>
            <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 leading-normal">
              High-signal operator angels (10–15% of round, $10k–$50k tickets) offering zero-board overhead, customer intros, and hiring gravity.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                Elad Gil
              </span>
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                Lachy Groom
              </span>
            </div>
          </div>

          {/* Tier 4 */}
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Tier 4
              </span>
              <Badge tone="amber">Cohort Acceleration</Badge>
            </div>
            <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Accelerators &amp; Incubators
            </h4>
            <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 leading-normal">
              Standardized cohort terms (e.g. Y Combinator $500k standard SAFE, Techstars) providing initial institutional stamp and demo day pricing power.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1">
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                Y Combinator
              </span>
              <span className="rounded-sm bg-white/80 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                Techstars
              </span>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-neutral-100 dark:border-neutral-800 text-xs">
          <div className="flex items-start gap-2">
            <Layers className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">Reconciled Data Room</p>
              <p className="text-[11px] text-neutral-500">Cross-checks deck MRR claims against raw cap table spreadsheets and multi-sheet models.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">Founder Allocation Control</p>
              <p className="text-[11px] text-neutral-500">Customize target round split (Lead % / Syndicate % / Angel %) while preserving clean pro-forma dilution.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">Anti-Portfolio Conflict Scan</p>
              <p className="text-[11px] text-neutral-500">Flags direct competitor investments in VC portfolios prior to founder outreach.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
