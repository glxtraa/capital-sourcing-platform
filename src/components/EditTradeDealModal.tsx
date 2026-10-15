"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { X, Loader2, Save, Layers, Plus, Trash2 } from "lucide-react";

interface EditTradeDealModalProps {
  deal: {
    id: string;
    name: string;
    corridor: string;
    parties: Array<{
      id?: string;
      legalName: string;
      role: string;
      country?: string | null;
      jurisdiction?: string | null;
    }>;
    contractLegs: Array<{
      id?: string;
      legRole?: string;
      legType?: string;
      incoterm?: string;
      goodsDescription?: string;
      commodityName?: string;
      pricingAmountUsd?: number;
      amountUsd?: number;
      paymentTermsDays?: number;
      tenorDays?: number;
    }>;
    financingAsks: Array<{
      id?: string;
      facilityStructure?: string;
      instrument?: string;
      requestedAmountUsd?: number;
      amountUsd?: number;
      tenorDays?: number;
      tenorDaysMax?: number;
    }>;
  };
  onClose: () => void;
}

export function EditTradeDealModal({ deal, onClose }: EditTradeDealModalProps) {
  const router = useRouter();

  const [name, setName] = useState(deal.name);
  const [corridor, setCorridor] = useState(deal.corridor);

  const [parties, setParties] = useState(
    deal.parties.map((p) => ({
      legalName: p.legalName,
      role: p.role,
      country: p.country ?? p.jurisdiction ?? "Global",
    })),
  );

  const [contractLegs, setContractLegs] = useState(
    deal.contractLegs.map((l) => ({
      legRole: l.legRole ?? l.legType ?? "SUPPLY_LEG",
      incoterm: l.incoterm ?? "FOB",
      goodsDescription: l.goodsDescription ?? l.commodityName ?? "Cargo",
      pricingAmountUsd: l.pricingAmountUsd ?? l.amountUsd ?? 1000000,
      paymentTermsDays: l.paymentTermsDays ?? l.tenorDays ?? 30,
    })),
  );

  const [financingAsks, setFinancingAsks] = useState(
    deal.financingAsks.map((a) => ({
      facilityStructure: a.facilityStructure ?? a.instrument ?? "RECEIVABLES",
      requestedAmountUsd: a.requestedAmountUsd ?? a.amountUsd ?? 1000000,
      tenorDays: a.tenorDays ?? a.tenorDaysMax ?? 90,
    })),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addParty() {
    setParties((prev) => [...prev, { legalName: "New Entity", role: "BUYER", country: "Global" }]);
  }

  function addLeg() {
    setContractLegs((prev) => [
      ...prev,
      {
        legRole: "SALES_LEG",
        incoterm: "CIF",
        goodsDescription: "Cargo",
        pricingAmountUsd: 1500000,
        paymentTermsDays: 60,
      },
    ]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/trade-deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          corridor,
          parties,
          contractLegs: contractLegs.map((l) => ({
            ...l,
            pricingAmountUsd: Number(l.pricingAmountUsd),
            paymentTermsDays: Number(l.paymentTermsDays),
          })),
          financingAsks: financingAsks.map((a) => ({
            ...a,
            requestedAmountUsd: Number(a.requestedAmountUsd),
            tenorDays: Number(a.tenorDays),
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save trade deal edits.");
      }

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save edits.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              Edit Trade Finance Deal Spec
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Deal Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                required
              />
            </div>
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Commodity Corridor</label>
              <select
                value={corridor}
                onChange={(e) => setCorridor(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="IDN_COAL_ASIA">Indonesian Coal {"->"} Asia</option>
                <option value="SEA_AGRI_GLOBAL">Southeast Asian Agri {"->"} Global</option>
                <option value="LATAM_SEAFOOD_ASIA">Latin American Seafood {"->"} Asia</option>
                <option value="OTHER_CROSS_BORDER">Other Cross-Border</option>
              </select>
            </div>
          </div>

          {/* Parties */}
          <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold uppercase tracking-wider text-neutral-500">
                Tripartite Parties ({parties.length})
              </h4>
              <Button type="button" variant="outline" size="sm" onClick={addParty} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Add Party
              </Button>
            </div>
            {parties.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/70 p-2 dark:border-neutral-800 dark:bg-neutral-800/40">
                <select
                  value={p.role}
                  onChange={(e) => setParties((prev) => prev.map((item, idx) => idx === i ? { ...item, role: e.target.value } : item))}
                  className="w-28 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="SUPPLIER">Supplier</option>
                  <option value="TRADER">Trader</option>
                  <option value="BUYER">Buyer</option>
                  <option value="LOGISTICS_INSPECTOR">Inspector</option>
                </select>
                <input
                  type="text"
                  value={p.legalName}
                  onChange={(e) => setParties((prev) => prev.map((item, idx) => idx === i ? { ...item, legalName: e.target.value } : item))}
                  placeholder="Legal Name"
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                />
                <input
                  type="text"
                  value={p.country}
                  onChange={(e) => setParties((prev) => prev.map((item, idx) => idx === i ? { ...item, country: e.target.value } : item))}
                  placeholder="Country"
                  className="w-24 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                />
                <button
                  type="button"
                  onClick={() => setParties((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-1 text-neutral-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Contract Legs */}
          <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold uppercase tracking-wider text-neutral-500">
                Contract Legs ({contractLegs.length})
              </h4>
              <Button type="button" variant="outline" size="sm" onClick={addLeg} className="h-7 text-[11px] gap-1">
                <Plus className="h-3 w-3" /> Add Leg
              </Button>
            </div>
            {contractLegs.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/70 p-2 dark:border-neutral-800 dark:bg-neutral-800/40">
                <select
                  value={l.legRole}
                  onChange={(e) => setContractLegs((prev) => prev.map((item, idx) => idx === i ? { ...item, legRole: e.target.value } : item))}
                  className="w-32 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="PURCHASE_LEG">Purchase Leg</option>
                  <option value="SALES_LEG">Sales Leg</option>
                  <option value="IN_TRANSIT_LEG">In-Transit Leg</option>
                </select>
                <input
                  type="text"
                  value={l.incoterm}
                  onChange={(e) => setContractLegs((prev) => prev.map((item, idx) => idx === i ? { ...item, incoterm: e.target.value } : item))}
                  placeholder="Incoterm (FOB, CIF)"
                  className="w-20 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                />
                <input
                  type="number"
                  value={l.pricingAmountUsd}
                  onChange={(e) => setContractLegs((prev) => prev.map((item, idx) => idx === i ? { ...item, pricingAmountUsd: Number(e.target.value) } : item))}
                  placeholder="Amount ($ USD)"
                  className="w-28 rounded border border-neutral-300 px-2 py-1 font-mono dark:border-neutral-700 dark:bg-neutral-900"
                />
                <input
                  type="number"
                  value={l.paymentTermsDays}
                  onChange={(e) => setContractLegs((prev) => prev.map((item, idx) => idx === i ? { ...item, paymentTermsDays: Number(e.target.value) } : item))}
                  placeholder="Days"
                  className="w-16 rounded border border-neutral-300 px-2 py-1 font-mono dark:border-neutral-700 dark:bg-neutral-900"
                />
                <button
                  type="button"
                  onClick={() => setContractLegs((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-1 text-neutral-400 hover:text-red-600 ml-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-purple-700 hover:bg-purple-800 text-white gap-1.5">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save &amp; Recalculate Facilities
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
