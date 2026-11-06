"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import {
  X,
  Loader2,
  Save,
  RefreshCw,
  Building2,
  Globe,
  DollarSign,
  Briefcase,
  Layers,
  HelpCircle,
  CheckCircle2,
  ShieldAlert,
  Mail,
  MapPin,
} from "lucide-react";
import {
  VC_STANDARD_JURISDICTIONS,
  VC_JURISDICTION_TAXONOMY,
  StartupStageSchema,
  StartupSectorSchema,
  StartupInvestorTypeSchema,
} from "@/dsl/vc";

const ALL_STAGES = StartupStageSchema.options;
const ALL_SECTORS = StartupSectorSchema.options;
const ALL_TYPES = StartupInvestorTypeSchema.options;
const APPLICATION_ROUTES = ["WARM_INTRO", "OPEN_PORTAL", "SCOUT_FORM", "ACCELERATOR_COHORT"] as const;

interface EditVcInvestorModalProps {
  investor: {
    id: string;
    name: string;
    type: string;
    targetStages: string[];
    preferredSectors: string[];
    acceptedJurisdictions: string[];
    minCheckUsd: number | null;
    maxCheckUsd: number | null;
    sweetSpotCheckUsd: number | null;
    leadsRounds: boolean;
    takesBoardSeats: boolean;
    activelyFundingIndustry: boolean;
    applicationRoute: string;
    applicationUrl: string | null;
    websiteUrl?: string | null;
    contactEmail?: string | null;
    headquarters?: string | null;
    gatingFactor: string | null;
    notes: string | null;
  };
  dealId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function EditVcInvestorModal({
  investor,
  dealId,
  onClose,
  onSaved,
}: EditVcInvestorModalProps) {
  const router = useRouter();

  const [name, setName] = useState(investor.name);
  const [type, setType] = useState(investor.type);
  const [websiteUrl, setWebsiteUrl] = useState(investor.websiteUrl || "");
  const [contactEmail, setContactEmail] = useState(investor.contactEmail || "");
  const [headquarters, setHeadquarters] = useState(investor.headquarters || "");
  const [stages, setStages] = useState<string[]>(investor.targetStages ?? []);
  const [sectors, setSectors] = useState<string[]>(investor.preferredSectors ?? []);
  const [jurisdictions, setJurisdictions] = useState<string[]>(
    investor.acceptedJurisdictions ?? [],
  );
  const [customJurisdiction, setCustomJurisdiction] = useState("");
  const [minCheckUsd, setMinCheckUsd] = useState<number | string>(investor.minCheckUsd ?? "");
  const [maxCheckUsd, setMaxCheckUsd] = useState<number | string>(investor.maxCheckUsd ?? "");
  const [sweetSpotCheckUsd, setSweetSpotCheckUsd] = useState<number | string>(
    investor.sweetSpotCheckUsd ?? "",
  );
  const [leadsRounds, setLeadsRounds] = useState(investor.leadsRounds ?? false);
  const [takesBoardSeats, setTakesBoardSeats] = useState(investor.takesBoardSeats ?? false);
  const [activelyFundingIndustry, setActivelyFundingIndustry] = useState(
    investor.activelyFundingIndustry ?? true,
  );
  const [applicationRoute, setApplicationRoute] = useState(
    investor.applicationRoute || "WARM_INTRO",
  );
  const [applicationUrl, setApplicationUrl] = useState(investor.applicationUrl || "");
  const [gatingFactor, setGatingFactor] = useState(investor.gatingFactor || "");
  const [notes, setNotes] = useState(investor.notes || "");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReResearching, setIsReResearching] = useState(false);
  const [researchNotice, setResearchNotice] = useState<string | null>(null);

  async function handleReResearchSingle() {
    setIsReResearching(true);
    setResearchNotice(null);
    try {
      const res = await fetch("/api/vc-investors/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investorIds: [investor.id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to re-run research");
      setResearchNotice("Investor thesis research refreshed successfully! Page snapshots and partner links updated.");
      router.refresh();
      if (onSaved) onSaved();
    } catch (err: any) {
      setResearchNotice("Error: " + (err?.message || "Failed to re-run research"));
    } finally {
      setIsReResearching(false);
    }
  }

  function toggleStage(s: string) {
    setStages((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function toggleSector(s: string) {
    setSectors((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function toggleJurisdiction(j: string) {
    setJurisdictions((prev) =>
      prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j],
    );
  }

  function addCustomJurisdiction() {
    const val = customJurisdiction.trim();
    if (val && !jurisdictions.includes(val)) {
      setJurisdictions((prev) => [...prev, val]);
      setCustomJurisdiction("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/vc-investors/${investor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          websiteUrl: websiteUrl.trim() || null,
          contactEmail: contactEmail.trim() || null,
          headquarters: headquarters.trim() || null,
          targetStages: stages,
          preferredSectors: sectors,
          acceptedJurisdictions: jurisdictions,
          minCheckUsd: minCheckUsd === "" ? null : Number(minCheckUsd),
          maxCheckUsd: maxCheckUsd === "" ? null : Number(maxCheckUsd),
          sweetSpotCheckUsd: sweetSpotCheckUsd === "" ? null : Number(sweetSpotCheckUsd),
          leadsRounds,
          takesBoardSeats,
          activelyFundingIndustry,
          applicationRoute,
          applicationUrl: applicationUrl.trim() || null,
          gatingFactor: gatingFactor.trim() || null,
          notes: notes.trim() || null,
          dealId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save investor parameters.");
      }

      if (onSaved) onSaved();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update investor.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                Edit Investor Parameters: {investor.name}
              </h3>
              <p className="text-[11px] text-neutral-400">
                Update thesis criteria, valid jurisdictions, check sizes, and active industry status.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={handleReResearchSingle}
              disabled={isReResearching}
              className="text-xs gap-1.5 border-violet-300 dark:border-violet-800 text-violet-900 dark:text-violet-200 hover:bg-violet-100/50"
            >
              {isReResearching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Re-researching…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-run Research</span>
                </>
              )}
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs">
          {researchNotice && (
            <div className={`p-2.5 rounded-lg text-xs font-semibold ${researchNotice.startsWith("Error") ? "bg-red-100 text-red-900 border border-red-300" : "bg-emerald-100 text-emerald-900 border border-emerald-300"}`}>
              {researchNotice}
            </div>
          )}
          {/* Section 1: Basic Identity */}
          <div className="space-y-3">
            <h4 className="font-semibold uppercase tracking-wider text-neutral-500">
              Provider Identity &amp; Archetype
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Firm / Provider Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Investor Archetype (DSL Type)
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {ALL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Official Contact & Headquarters */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-emerald-600" />
              Official Website &amp; Direct Contact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1 flex items-center gap-1">
                  <Globe className="h-3 w-3 text-neutral-400" />
                  Website URL
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.phoenixcourt.vc/"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1 flex items-center gap-1">
                  <Mail className="h-3 w-3 text-neutral-400" />
                  Direct / Pitch Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="legal@localglobe.vc"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-neutral-400" />
                  Headquarters
                </label>
                <input
                  type="text"
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  placeholder="London, United Kingdom"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Accepted Legal Jurisdictions */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-blue-600" />
                  Accepted Corporate Jurisdictions
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Select recognized corporate entity domiciles this fund accepts (matching rule: target entity must match any selected jurisdiction).
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600">
                {jurisdictions.length} Selected
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {VC_STANDARD_JURISDICTIONS.map((j) => {
                const isSelected = jurisdictions.includes(j);
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => toggleJurisdiction(j)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {j}
                  </button>
                );
              })}
            </div>

            {/* Custom Jurisdiction input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={customJurisdiction}
                onChange={(e) => setCustomJurisdiction(e.target.value)}
                placeholder="Add other custom jurisdiction (e.g. Bermuda, Sweden)..."
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomJurisdiction();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomJurisdiction}>
                Add
              </Button>
            </div>
          </div>

          {/* Section 3: Target Stages & Preferred Sectors */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-purple-600" />
              Investment Stages &amp; Sectors
            </h4>

            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Target Stages
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_STAGES.map((s) => {
                  const isSelected = stages.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStage(s)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                        isSelected
                          ? "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700"
                          : "bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {s.replaceAll("_", " ")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Preferred Sectors
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {ALL_SECTORS.map((s) => {
                  const isSelected = sectors.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSector(s)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                        isSelected
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700"
                          : "bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {s.replaceAll("_", " ")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4: Check Sizes & Round Dynamics */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Check Size Bounds &amp; Lead Preferences
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Min Check ($ USD)
                </label>
                <input
                  type="number"
                  value={minCheckUsd}
                  onChange={(e) => setMinCheckUsd(e.target.value)}
                  placeholder="e.g. 250000"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Max Check ($ USD)
                </label>
                <input
                  type="number"
                  value={maxCheckUsd}
                  onChange={(e) => setMaxCheckUsd(e.target.value)}
                  placeholder="e.g. 2000000"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Sweet Spot Check ($ USD)
                </label>
                <input
                  type="number"
                  value={sweetSpotCheckUsd}
                  onChange={(e) => setSweetSpotCheckUsd(e.target.value)}
                  placeholder="e.g. 1000000"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={leadsRounds}
                  onChange={(e) => setLeadsRounds(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  Leads Rounds
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={takesBoardSeats}
                  onChange={(e) => setTakesBoardSeats(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  Takes Board Seats
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={activelyFundingIndustry}
                  onChange={(e) => setActivelyFundingIndustry(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  Actively Funding Industry
                </span>
              </label>
            </div>
          </div>

          {/* Section 5: Application Route & Notes */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="font-semibold uppercase tracking-wider text-neutral-500">
              Inbound Route &amp; Gating Guidance
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Application Route
                </label>
                <select
                  value={applicationRoute}
                  onChange={(e) => setApplicationRoute(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {APPLICATION_ROUTES.map((r) => (
                    <option key={r} value={r}>
                      {r.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Application / Pitch URL
                </label>
                <input
                  type="url"
                  value={applicationUrl}
                  onChange={(e) => setApplicationUrl(e.target.value)}
                  placeholder="https://firm.com/pitch"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Institutional Gating Factor / Hard Filters
              </label>
              <input
                type="text"
                value={gatingFactor}
                onChange={(e) => setGatingFactor(e.target.value)}
                placeholder="e.g. Requires technical co-founder, minimum $50k MRR, or US entity"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>

            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Internal Thesis Notes &amp; Rationale
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="High-conviction notes, partner angles, or specific fund thesis details..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-950/50 dark:text-red-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Saving & Re-matching..." : "Save Investor Parameters"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
