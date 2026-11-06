"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ui/primitives";
import { X, Loader2, Save, FileText, Plus, Trash2 } from "lucide-react";
import { normalizeJurisdictionName } from "@/lib/jurisdiction-normalizer";

interface PartyFormItem {
  id?: string;
  role: "BORROWER" | "OBLIGOR" | "SUPPLIER" | "INTERMEDIARY" | "GUARANTOR";
  legalName: string;
  jurisdiction: string;
  publicRating: string;
  primaryRightHolderName: string;
  primaryRightHolderVerified: boolean;
}

interface FinancingAskFormItem {
  id?: string;
  structureType: string;
  amount: number | string | null;
  currency: string;
  advanceRatePct: number | string | null;
  tenorDaysMin: number | string | null;
  tenorDaysMax: number | string | null;
  tenorNote: string;
  recurring: boolean;
}

interface EditInvoiceDealModalProps {
  deal: {
    id: string;
    name: string;
    currency?: string;
    parties: Array<{
      id?: string;
      name?: string;
      legalName?: string;
      role: string;
      jurisdiction?: string | null;
      publicRating?: string | null;
      primaryRightHolderName?: string | null;
      primaryRightHolderVerified?: boolean;
    }>;
    financingAsks: Array<{
      id?: string;
      structureType?: string;
      amountUsd?: number;
      amount?: number | null;
      currency?: string | null;
      advanceRatePct?: number | null;
      targetTenorDays?: number | null;
      tenorDaysMin?: number | null;
      tenorDaysMax?: number | null;
      tenorNote?: string | null;
      recurring?: boolean;
    }>;
  };
  onClose: () => void;
}

export function EditInvoiceDealModal({ deal, onClose }: EditInvoiceDealModalProps) {
  const router = useRouter();

  const [name, setName] = useState(deal.name);
  const [dealCurrency, setDealCurrency] = useState(deal.currency || "USD");

  // Multi-party state reflecting exactly what is displayed in the Deal Spec window
  const [parties, setParties] = useState<PartyFormItem[]>(() => {
    if (deal.parties && deal.parties.length > 0) {
      return deal.parties.map((p) => ({
        id: p.id,
        role: (p.role === "CLIENT" ? "BORROWER" : p.role === "DEBTOR" ? "OBLIGOR" : p.role) as any,
        legalName: p.legalName || p.name || "",
        jurisdiction: p.jurisdiction || "",
        publicRating: p.publicRating || "",
        primaryRightHolderName: p.primaryRightHolderName || "",
        primaryRightHolderVerified: Boolean(p.primaryRightHolderVerified),
      }));
    }
    return [
      {
        role: "BORROWER",
        legalName: "",
        jurisdiction: "",
        publicRating: "",
        primaryRightHolderName: "",
        primaryRightHolderVerified: false,
      },
      {
        role: "OBLIGOR",
        legalName: "",
        jurisdiction: "",
        publicRating: "",
        primaryRightHolderName: "",
        primaryRightHolderVerified: false,
      },
    ];
  });

  // Financing Asks state
  const [financingAsks, setFinancingAsks] = useState<FinancingAskFormItem[]>(() => {
    if (deal.financingAsks && deal.financingAsks.length > 0) {
      return deal.financingAsks.map((a) => ({
        id: a.id,
        structureType: a.structureType || "POST_SHIPMENT_RECEIVABLES_DISCOUNTING",
        amount: typeof a.amount === "number" ? a.amount : (a.amountUsd ?? ("" as unknown as number)),
        currency: a.currency || deal.currency || "USD",
        advanceRatePct: typeof a.advanceRatePct === "number" ? a.advanceRatePct : ("" as unknown as number),
        tenorDaysMin: typeof a.tenorDaysMin === "number" ? a.tenorDaysMin : ("" as unknown as number),
        tenorDaysMax: typeof a.tenorDaysMax === "number" ? a.tenorDaysMax : (a.targetTenorDays ?? ("" as unknown as number)),
        tenorNote: a.tenorNote || "",
        recurring: Boolean(a.recurring),
      }));
    }
    return [
      {
        structureType: "POST_SHIPMENT_RECEIVABLES_DISCOUNTING",
        amount: "" as unknown as number,
        currency: deal.currency || "USD",
        advanceRatePct: "" as unknown as number,
        tenorDaysMin: "" as unknown as number,
        tenorDaysMax: "" as unknown as number,
        tenorNote: "",
        recurring: false,
      },
    ];
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateParty = (index: number, patch: Partial<PartyFormItem>) => {
    setParties((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const handleAddParty = () => {
    setParties((prev) => [
      ...prev,
      {
        role: "OBLIGOR",
        legalName: "",
        jurisdiction: "",
        publicRating: "",
        primaryRightHolderName: "",
        primaryRightHolderVerified: false,
      },
    ]);
  };

  const handleRemoveParty = (index: number) => {
    if (parties.length <= 1) return;
    setParties((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateAsk = (index: number, patch: Partial<FinancingAskFormItem>) => {
    setFinancingAsks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...patch };
      return updated;
    });
  };

  const handleAddAsk = () => {
    setFinancingAsks((prev) => [
      ...prev,
      {
        structureType: "POST_SHIPMENT_RECEIVABLES_DISCOUNTING",
        amount: "" as unknown as number,
        currency: dealCurrency || "USD",
        advanceRatePct: "" as unknown as number,
        tenorDaysMin: "" as unknown as number,
        tenorDaysMax: "" as unknown as number,
        tenorNote: "",
        recurring: false,
      },
    ]);
  };

  const handleRemoveAsk = (index: number) => {
    if (financingAsks.length <= 1) return;
    setFinancingAsks((prev) => prev.filter((_, idx) => idx !== index));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const payloadParties = parties.map((p) => ({
        legalName: p.legalName.trim(),
        role: p.role,
        jurisdiction: normalizeJurisdictionName(p.jurisdiction) || p.jurisdiction.trim() || null,
        publicRating: p.publicRating.trim() || null,
        primaryRightHolderName: p.primaryRightHolderName.trim() || null,
        primaryRightHolderVerified: p.primaryRightHolderVerified,
      }));

      const payloadAsks = financingAsks.map((a) => ({
        structureType: a.structureType,
        amount: a.amount !== "" && !isNaN(Number(a.amount)) ? Number(a.amount) : 0,
        currency: (a.currency || dealCurrency || "USD").toUpperCase().trim(),
        advanceRatePct: a.advanceRatePct !== "" && !isNaN(Number(a.advanceRatePct)) ? Number(a.advanceRatePct) : null,
        tenorDaysMin: a.tenorDaysMin !== "" && !isNaN(Number(a.tenorDaysMin)) ? Number(a.tenorDaysMin) : null,
        tenorDaysMax: a.tenorDaysMax !== "" && !isNaN(Number(a.tenorDaysMax)) ? Number(a.tenorDaysMax) : null,
        tenorNote: a.tenorNote.trim() || null,
        recurring: a.recurring,
      }));

      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          currency: dealCurrency.trim().toUpperCase(),
          parties: payloadParties,
          financingAsks: payloadAsks,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save invoice deal edits.");
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                Edit Deal Spec &mdash; Extracted Parties &amp; Terms
              </h3>
              <p className="text-[11px] text-neutral-500">
                Directly edit all extracted counterparties, roles, jurisdictions, ratings, and financing terms.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs">
          {/* Header Specs: Deal Name & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 dark:bg-neutral-800/40 dark:border-neutral-700">
            <div className="sm:col-span-2">
              <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Deal Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-600 dark:bg-neutral-800 text-xs"
                required
              />
            </div>
            <div>
              <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Base Currency</label>
              <input
                type="text"
                value={dealCurrency}
                onChange={(e) => setDealCurrency(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 dark:border-neutral-600 dark:bg-neutral-800 font-mono text-xs uppercase"
                placeholder="USD"
                required
              />
            </div>
          </div>

          {/* PARTIES TABLE (Identical to Extracted Parties window) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
              <div>
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-xs uppercase tracking-wider">
                  Extracted Parties ({parties.length})
                </h4>
                <p className="text-[11px] text-neutral-500">
                  Role, Legal Entity Name, Jurisdiction (with HK / Hong Kong alias normalization), Rating, and Chain-of-Title.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleAddParty} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add Party
              </Button>
            </div>

            <div className="space-y-2.5">
              {parties.map((party, idx) => (
                <div
                  key={party.id || idx}
                  className="rounded-xl border border-neutral-200 p-3 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/40 space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* Role */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Role</label>
                      <select
                        value={party.role}
                        onChange={(e) => handleUpdateParty(idx, { role: e.target.value as any })}
                        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800"
                      >
                        <option value="BORROWER">BORROWER</option>
                        <option value="OBLIGOR">OBLIGOR</option>
                        <option value="SUPPLIER">SUPPLIER</option>
                        <option value="INTERMEDIARY">INTERMEDIARY</option>
                        <option value="GUARANTOR">GUARANTOR</option>
                      </select>
                    </div>

                    {/* Legal Name */}
                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Legal Name</label>
                      <input
                        type="text"
                        value={party.legalName}
                        onChange={(e) => handleUpdateParty(idx, { legalName: e.target.value })}
                        placeholder="Company Legal Name"
                        className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 font-medium"
                        required
                      />
                    </div>

                    {/* Jurisdiction */}
                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">
                        Jurisdiction
                      </label>
                      <input
                        type="text"
                        value={party.jurisdiction}
                        onChange={(e) => handleUpdateParty(idx, { jurisdiction: e.target.value })}
                        placeholder="e.g. Hong Kong, Japan, Singapore"
                        className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </div>

                    {/* Rating */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Rating</label>
                      <input
                        type="text"
                        value={party.publicRating}
                        onChange={(e) => handleUpdateParty(idx, { publicRating: e.target.value })}
                        placeholder="e.g. S&P BBB+, JCR A"
                        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </div>

                    {/* Action */}
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveParty(idx)}
                        disabled={parties.length <= 1}
                        className="p-1.5 rounded text-neutral-400 hover:text-red-600 disabled:opacity-30"
                        title="Remove party"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Chain of Title if INTERMEDIARY */}
                  {party.role === "INTERMEDIARY" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <div>
                        <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">Primary Right Holder</label>
                        <input
                          type="text"
                          value={party.primaryRightHolderName}
                          onChange={(e) => handleUpdateParty(idx, { primaryRightHolderName: e.target.value })}
                          placeholder="Primary concession or licence holder"
                          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-4">
                        <input
                          type="checkbox"
                          id={`rightHolderVerif-${idx}`}
                          checked={party.primaryRightHolderVerified}
                          onChange={(e) => handleUpdateParty(idx, { primaryRightHolderVerified: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <label htmlFor={`rightHolderVerif-${idx}`} className="text-xs text-neutral-700 dark:text-neutral-300">
                          Chain-of-Title Document Verified
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* FINANCING ASKS TABLE */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
              <div>
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-xs uppercase tracking-wider">
                  Financing Asks &amp; Terms ({financingAsks.length})
                </h4>
                <p className="text-[11px] text-neutral-500">
                  Facility structure, requested amount, advance rate percentage, and tenor window.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleAddAsk} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add Financing Ask
              </Button>
            </div>

            <div className="space-y-3">
              {financingAsks.map((ask, idx) => (
                <div
                  key={ask.id || idx}
                  className="rounded-xl border border-neutral-200 p-3.5 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/40 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Structure Type */}
                    <div className="sm:col-span-4">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">
                        Structure Type
                      </label>
                      <select
                        value={ask.structureType}
                        onChange={(e) => handleUpdateAsk(idx, { structureType: e.target.value })}
                        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800"
                      >
                        <option value="POST_SHIPMENT_RECEIVABLES_DISCOUNTING">
                          Post-Shipment Receivables Discounting
                        </option>
                        <option value="PRE_SHIPMENT_PROCUREMENT_FINANCE">
                          Pre-Shipment Procurement Finance
                        </option>
                        <option value="PRE_EXPORT_BORROWING_BASE">
                          Pre-Export Borrowing Base
                        </option>
                        <option value="ENTERPRISE_SCF_REVERSE_FACTORING">
                          Enterprise SCF / Reverse Factoring
                        </option>
                      </select>
                    </div>

                    {/* Facility Amount */}
                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">
                        Amount ({ask.currency || dealCurrency})
                      </label>
                      <input
                        type="number"
                        value={ask.amount ?? ""}
                        onChange={(e) => handleUpdateAsk(idx, { amount: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value) })}
                        className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800"
                        required
                      />
                    </div>

                    {/* Advance Rate % */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">
                        Advance Rate %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={ask.advanceRatePct ?? ""}
                        onChange={(e) => handleUpdateAsk(idx, { advanceRatePct: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value) })}
                        className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </div>

                    {/* Tenor Min / Max */}
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1">
                        Tenor (Days)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={ask.tenorDaysMin ?? ""}
                          onChange={(e) => handleUpdateAsk(idx, { tenorDaysMin: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value) })}
                          className="w-1/2 rounded-md border border-neutral-300 bg-white px-1.5 py-1.5 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800"
                          placeholder="Min"
                        />
                        <span>-</span>
                        <input
                          type="number"
                          value={ask.tenorDaysMax ?? ""}
                          onChange={(e) => handleUpdateAsk(idx, { tenorDaysMax: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value) })}
                          className="w-1/2 rounded-md border border-neutral-300 bg-white px-1.5 py-1.5 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800"
                          placeholder="Max"
                        />
                      </div>
                    </div>

                    {/* Action */}
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveAsk(idx)}
                        disabled={financingAsks.length <= 1}
                        className="p-1.5 rounded text-neutral-400 hover:text-red-600 disabled:opacity-30"
                        title="Remove ask"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tenor Note & Recurring toggle */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="sm:col-span-9">
                      <input
                        type="text"
                        value={ask.tenorNote}
                        onChange={(e) => handleUpdateAsk(idx, { tenorNote: e.target.value })}
                        placeholder="Tenor or facility notes (e.g. provisional pending transit time confirmation)"
                        className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </div>
                    <div className="sm:col-span-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`recurring-${idx}`}
                        checked={ask.recurring}
                        onChange={(e) => handleUpdateAsk(idx, { recurring: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <label htmlFor={`recurring-${idx}`} className="text-xs text-neutral-700 dark:text-neutral-300">
                        Recurring Facility
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-xs font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save &amp; Recalculate Matches
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
