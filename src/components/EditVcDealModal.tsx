"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { X, Loader2, Save, Building2, Globe, DollarSign, Scale, Users, Plus, Trash2 } from "lucide-react";
import { VC_STANDARD_JURISDICTIONS } from "@/dsl/vc";

interface EditVcDealModalProps {
  deal: {
    id: string;
    companyName: string;
    legalEntityJurisdiction: string;
    stage: string;
    primaryVertical: string;
    industry?: string | null;
    subIndustries?: string[];
    targetCustomerProfile?: string | null;
    businessModel?: string | null;
    financingAsks: Array<{
      targetRaiseUsd: number;
      instrumentType: string;
      valuationCapUsd: number | null;
      plannedRunwayMonths: number;
      leadCommitted: boolean;
    }>;
    capTable: {
      foundersOwnershipPct: number;
      investorOwnershipPct: number;
      optionPoolPct: number;
      hasDeadEquity: boolean;
    } | null;
    founders: Array<{
      id?: string;
      name: string;
      role: string;
      equityOwnershipPct: number;
      isTechnical: boolean;
      isRepeatFounder: boolean;
    }>;
  };
  onClose: () => void;
}

export function EditVcDealModal({ deal, onClose }: EditVcDealModalProps) {
  const router = useRouter();
  const ask = deal.financingAsks[0];

  const [companyName, setCompanyName] = useState(deal.companyName);
  const [jurisdiction, setJurisdiction] = useState(deal.legalEntityJurisdiction || "Delaware (US)");
  const [stage, setStage] = useState(deal.stage);
  const [primaryVertical, setPrimaryVertical] = useState(deal.primaryVertical);
  const [industry, setIndustry] = useState(deal.industry ?? "");
  const [subIndustriesText, setSubIndustriesText] = useState((deal.subIndustries || []).join(", "));
  const [targetCustomerProfile, setTargetCustomerProfile] = useState(deal.targetCustomerProfile ?? "");
  const [businessModel, setBusinessModel] = useState(deal.businessModel ?? "");


  const [targetRaiseUsd, setTargetRaiseUsd] = useState(ask?.targetRaiseUsd ?? 1500000);
  const [valuationCapUsd, setValuationCapUsd] = useState<number | string>(ask?.valuationCapUsd ?? 12000000);
  const [instrumentType, setInstrumentType] = useState(ask?.instrumentType ?? "POST_MONEY_SAFE");
  const [plannedRunwayMonths, setPlannedRunwayMonths] = useState(ask?.plannedRunwayMonths ?? 18);
  const [leadCommitted, setLeadCommitted] = useState(ask?.leadCommitted ?? false);

  const [foundersOwnershipPct, setFoundersOwnershipPct] = useState(deal.capTable?.foundersOwnershipPct ?? 80);
  const [investorOwnershipPct, setInvestorOwnershipPct] = useState(deal.capTable?.investorOwnershipPct ?? 10);
  const [optionPoolPct, setOptionPoolPct] = useState(deal.capTable?.optionPoolPct ?? 10);
  const [hasDeadEquity, setHasDeadEquity] = useState(deal.capTable?.hasDeadEquity ?? false);

  const [founders, setFounders] = useState(
    deal.founders.map((f) => ({
      name: f.name,
      role: f.role,
      equityOwnershipPct: f.equityOwnershipPct,
      isTechnical: f.isTechnical,
      isRepeatFounder: f.isRepeatFounder,
    })),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFounder() {
    setFounders((prev) => [
      ...prev,
      {
        name: "New Founder",
        role: "Co-Founder",
        equityOwnershipPct: 10,
        isTechnical: false,
        isRepeatFounder: false,
      },
    ]);
  }

  function removeFounder(index: number) {
    setFounders((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateFounder(index: number, patch: Partial<(typeof founders)[0]>) {
    setFounders((prev) => prev.map((f, idx) => (idx === index ? { ...f, ...patch } : f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/vc-deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          legalEntityJurisdiction: jurisdiction,
          stage,
          primaryVertical,
          industry: industry.trim() || null,
          subIndustries: subIndustriesText.split(",").map((s) => s.trim()).filter(Boolean),
          targetCustomerProfile: targetCustomerProfile.trim() || null,
          businessModel: businessModel.trim() || null,
          targetRaiseUsd: Number(targetRaiseUsd),
          valuationCapUsd: valuationCapUsd ? Number(valuationCapUsd) : null,
          instrumentType,
          plannedRunwayMonths: Number(plannedRunwayMonths),
          leadCommitted,
          foundersOwnershipPct: Number(foundersOwnershipPct),
          investorOwnershipPct: Number(investorOwnershipPct),
          optionPoolPct: Number(optionPoolPct),
          hasDeadEquity,
          founders,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save updates to deal spec.");
      }

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edits.");
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              Edit VC Startup Deal Spec
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs">
          {/* Section 1: Core Company & Jurisdiction */}
          <div className="space-y-3">
            <h4 className="font-semibold uppercase tracking-wider text-neutral-500">
              Company &amp; Legal Jurisdiction
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Legal Entity Jurisdiction (DSL)
                </label>
                <select
                  value={VC_STANDARD_JURISDICTIONS.includes(jurisdiction as any) ? jurisdiction : "CUSTOM"}
                  onChange={(e) => {
                    if (e.target.value !== "CUSTOM") setJurisdiction(e.target.value);
                  }}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {VC_STANDARD_JURISDICTIONS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                  <option value="CUSTOM">Other / Custom Jurisdiction...</option>
                </select>
                {(!VC_STANDARD_JURISDICTIONS.includes(jurisdiction as any) || jurisdiction === "CUSTOM") && (
                  <input
                    type="text"
                    value={jurisdiction === "CUSTOM" ? "" : jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    placeholder="Enter custom jurisdiction (e.g. Cayman Islands)"
                    className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                    required
                  />
                )}
                <p className="mt-1 text-[10px] text-neutral-400">
                  Standard VC jurisdictions: Delaware (US), United Kingdom, Singapore, Cayman Islands, etc.
                </p>
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Funding Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="PRE_SEED">Pre-Seed</option>
                  <option value="SEED">Seed</option>
                  <option value="SERIES_A">Series A</option>
                  <option value="SERIES_B">Series B</option>
                  <option value="GROWTH">Growth</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Primary Sector / Vertical
                </label>
                <select
                  value={primaryVertical}
                  onChange={(e) => setPrimaryVertical(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="B2B_SAAS">B2B SaaS</option>
                  <option value="AI_ML_INFRASTRUCTURE">AI/ML Infrastructure</option>
                  <option value="GENERATIVE_AI_APPS">Generative AI Apps</option>
                  <option value="FINTECH">Fintech</option>
                  <option value="DEV_TOOLS">Dev Tools</option>
                  <option value="CYBERSECURITY">Cybersecurity</option>
                  <option value="CLIMATETECH">ClimateTech</option>
                  <option value="HEALTHTECH_BIOTECH">HealthTech / BioTech</option>
                  <option value="MARKETPLACE_PLATFORM">Marketplace</option>
                  <option value="HARDWARE_ROBOTICS">Hardware &amp; Robotics</option>
                  <option value="WEB3_CRYPTO">Web3 / Crypto</option>
                  <option value="CONSUMER">Consumer</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 1b: Industry Domain & ICP Matching Parameters */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Industry Domain &amp; ICP Matching Parameters (Agent DSL Input)
            </h4>
            <div className="space-y-3">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Specific Industry &amp; Niche Description
                </label>
                <textarea
                  rows={2}
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Volumetric Water Benefit Accounting & Blockchain ESG Water Replenishment Registry"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                    Sub-Industries / Keywords (comma separated)
                  </label>
                  <input
                    type="text"
                    value={subIndustriesText}
                    onChange={(e) => setSubIndustriesText(e.target.value)}
                    placeholder="Water Stewardship, ESG Data, Replenishment Credits"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>

                <div>
                  <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                    Business &amp; Monetization Model
                  </label>
                  <input
                    type="text"
                    value={businessModel}
                    onChange={(e) => setBusinessModel(e.target.value)}
                    placeholder="e.g. Volume issuance fee per megaliter + annual corporate SaaS audit fee"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Target Customer Profile (ICP) &amp; Buyer Persona
                </label>
                <textarea
                  rows={2}
                  value={targetCustomerProfile}
                  onChange={(e) => setTargetCustomerProfile(e.target.value)}
                  placeholder="e.g. Fortune 500 beverage and food manufacturing corporations with water replenishment goals, and hyperscale datacenter operators"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Financing Ask */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="font-semibold uppercase tracking-wider text-neutral-500">
              Financing Ask &amp; Valuation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Target Raise ($ USD)
                </label>
                <input
                  type="number"
                  value={targetRaiseUsd}
                  onChange={(e) => setTargetRaiseUsd(Number(e.target.value))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Valuation Cap ($ USD)
                </label>
                <input
                  type="number"
                  value={valuationCapUsd}
                  onChange={(e) => setValuationCapUsd(e.target.value)}
                  placeholder="Leave blank if uncapped"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Instrument Type
                </label>
                <select
                  value={instrumentType}
                  onChange={(e) => setInstrumentType(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <option value="POST_MONEY_SAFE">Post-Money SAFE</option>
                  <option value="PRE_MONEY_SAFE">Pre-Money SAFE</option>
                  <option value="CONVERTIBLE_NOTE">Convertible Note</option>
                  <option value="PRICED_PREFERRED_EQUITY">Priced Preferred Stock</option>
                  <option value="ACCELERATOR_STANDARD_TERMS">Accelerator Terms</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Planned Runway (Months)
                </label>
                <input
                  type="number"
                  value={plannedRunwayMonths}
                  onChange={(e) => setPlannedRunwayMonths(Number(e.target.value))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="leadCommitted"
                  checked={leadCommitted}
                  onChange={(e) => setLeadCommitted(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="leadCommitted" className="font-medium text-neutral-700 dark:text-neutral-300">
                  Lead Investor Committed
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Cap Table */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="font-semibold uppercase tracking-wider text-neutral-500">
              Pre-Round Capitalization
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Founders %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={foundersOwnershipPct}
                  onChange={(e) => setFoundersOwnershipPct(Number(e.target.value))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Prior Investors %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={investorOwnershipPct}
                  onChange={(e) => setInvestorOwnershipPct(Number(e.target.value))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Option Pool %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={optionPoolPct}
                  onChange={(e) => setOptionPoolPct(Number(e.target.value))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="deadEquity"
                  checked={hasDeadEquity}
                  onChange={(e) => setHasDeadEquity(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="deadEquity" className="font-medium text-neutral-700 dark:text-neutral-300">
                  Flag Dead Equity
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Founders List */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold uppercase tracking-wider text-neutral-500">
                Founders ({founders.length})
              </h4>
              <Button type="button" variant="outline" size="sm" onClick={addFounder} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Add Founder
              </Button>
            </div>
            <div className="space-y-2">
              {founders.map((f, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/70 p-2.5 dark:border-neutral-800 dark:bg-neutral-800/40"
                >
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) => updateFounder(i, { name: e.target.value })}
                    placeholder="Name"
                    className="flex-1 min-w-[120px] rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <input
                    type="text"
                    value={f.role}
                    onChange={(e) => updateFounder(i, { role: e.target.value })}
                    placeholder="Role (CEO, CTO)"
                    className="w-24 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={f.equityOwnershipPct}
                      onChange={(e) => updateFounder(i, { equityOwnershipPct: Number(e.target.value) })}
                      placeholder="Equity %"
                      className="w-16 rounded border border-neutral-300 px-2 py-1 font-mono dark:border-neutral-700 dark:bg-neutral-900"
                    />
                    <span className="text-neutral-400">%</span>
                  </div>
                  <label className="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                    <input
                      type="checkbox"
                      checked={f.isTechnical}
                      onChange={(e) => updateFounder(i, { isTechnical: e.target.checked })}
                    />
                    Technical
                  </label>
                  <button
                    type="button"
                    onClick={() => removeFounder(i)}
                    className="p-1 text-neutral-400 hover:text-red-600 ml-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save &amp; Recalculate Matches
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
