"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { X, Loader2, Save, Plus, Trash2, Shield, Users, DollarSign } from "lucide-react";

export interface SafeHolderData {
  id?: string;
  holderName: string;
  investmentAmountUsd: number;
  instrumentType: string;
  valuationCapUsd: number | null;
  discountPct: number | null;
  dateOrNotes?: string | null;
}

export interface CommonHolderData {
  id?: string;
  holderName: string;
  roleOrRelationship: string;
  shareCount: number | null;
  ownershipPct: number;
  vestingTerms?: string | null;
}

interface EditCapTableModalProps {
  dealId: string;
  initialSafes: SafeHolderData[];
  initialCommon: CommonHolderData[];
  initialSafesTotal: number;
  onClose: () => void;
}

export function EditCapTableModal({
  dealId,
  initialSafes,
  initialCommon,
  initialSafesTotal,
  onClose,
}: EditCapTableModalProps) {
  const router = useRouter();
  const [modalTab, setModalTab] = useState<"safes" | "common">("safes");
  const [safes, setSafes] = useState<SafeHolderData[]>(
    initialSafes.length > 0
      ? initialSafes
      : [
          {
            holderName: "Seed Angel Syndicate",
            investmentAmountUsd: initialSafesTotal > 0 ? initialSafesTotal : 500000,
            instrumentType: "POST_MONEY_SAFE",
            valuationCapUsd: 12000000,
            discountPct: 20,
            dateOrNotes: "Standard Post-Money SAFE",
          },
        ],
  );

  const [common, setCommon] = useState<CommonHolderData[]>(initialCommon);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSafeBalance = safes.reduce((acc, s) => acc + (Number(s.investmentAmountUsd) || 0), 0);
  const totalCommonPct = common.reduce((acc, c) => acc + (Number(c.ownershipPct) || 0), 0);

  function addSafe() {
    setSafes((prev) => [
      ...prev,
      {
        holderName: "New SAFE Investor",
        investmentAmountUsd: 100000,
        instrumentType: "POST_MONEY_SAFE",
        valuationCapUsd: 15000000,
        discountPct: 20,
        dateOrNotes: "Post-Money SAFE",
      },
    ]);
  }

  function removeSafe(index: number) {
    setSafes((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateSafe(index: number, patch: Partial<SafeHolderData>) {
    setSafes((prev) => prev.map((s, idx) => (idx === index ? { ...s, ...patch } : s)));
  }

  function addCommon() {
    setCommon((prev) => [
      ...prev,
      {
        holderName: "Key Team Member",
        roleOrRelationship: "Founding Engineer",
        shareCount: 500000,
        ownershipPct: 5,
        vestingTerms: "4-year monthly, 1-year cliff",
      },
    ]);
  }

  function removeCommon(index: number) {
    setCommon((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateCommon(index: number, patch: Partial<CommonHolderData>) {
    setCommon((prev) => prev.map((c, idx) => (idx === index ? { ...c, ...patch } : c)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/vc-deals/${dealId}/cap-table`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          safesNotesOutstandingUsd: totalSafeBalance,
          safeHolders: safes,
          commonHolders: common,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save Cap Table updates.");
      }

      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving Cap Table.");
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              Manage Cap Table &amp; SAFE Balances
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Review and edit pre-round convertible SAFEs, noteholders, and common stock allocations.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Tab Switcher: SAFE first! */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 px-6 dark:border-neutral-800 dark:bg-neutral-950/40">
          <button
            type="button"
            onClick={() => setModalTab("safes")}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold tracking-wide transition-all ${
              modalTab === "safes"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300 bg-white dark:bg-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span>SAFE Owner Balances ({safes.length})</span>
            <span className="font-mono text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded ml-1">
              ${totalSafeBalance.toLocaleString()} USD
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab("common")}
            className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-semibold tracking-wide transition-all ${
              modalTab === "common"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300 bg-white dark:bg-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400"
            }`}
          >
            <Users className="h-4 w-4 text-blue-600" />
            <span>Common Stock Holders ({common.length})</span>
            <span className="font-mono text-[11px] text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded ml-1">
              {totalCommonPct}%
            </span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {/* TAB 1: SAFE OWNER BALANCES */}
          {modalTab === "safes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    SAFE &amp; Convertible Note Balances
                  </h3>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    Individual investor principal, security type, valuation cap, and conversion discounts.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSafe}
                  className="gap-1.5 text-xs text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add SAFE Note
                </Button>
              </div>

              <div className="space-y-3">
                {safes.map((safe, idx) => (
                  <div
                    key={safe.id || idx}
                    className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          SAFE Owner / Investor Name
                        </label>
                        <input
                          type="text"
                          value={safe.holderName}
                          onChange={(e) => updateSafe(idx, { holderName: e.target.value })}
                          placeholder="e.g. Y Combinator, SV Angel, Pioneer Fund"
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                          required
                        />
                      </div>
                      <div className="w-48">
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Security Instrument
                        </label>
                        <select
                          value={safe.instrumentType}
                          onChange={(e) => updateSafe(idx, { instrumentType: e.target.value })}
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        >
                          <option value="POST_MONEY_SAFE">Post-Money SAFE</option>
                          <option value="PRE_MONEY_SAFE">Pre-Money SAFE</option>
                          <option value="CONVERTIBLE_NOTE">Convertible Promissory Note</option>
                          <option value="MFN_SAFE">MFN SAFE (Most Favored Nation)</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSafe(idx)}
                        className="text-neutral-400 hover:text-red-600 p-1 mt-5"
                        title="Remove SAFE Note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Principal Balance ($ USD)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-neutral-400 font-mono text-xs">
                            $
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={5000}
                            value={safe.investmentAmountUsd}
                            onChange={(e) => updateSafe(idx, { investmentAmountUsd: Number(e.target.value) })}
                            className="w-full rounded border border-neutral-200 bg-white pl-6 pr-2.5 py-1.5 font-mono text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Valuation Cap ($ USD, or leave blank if uncapped)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={100000}
                          value={safe.valuationCapUsd ?? ""}
                          onChange={(e) =>
                            updateSafe(idx, {
                              valuationCapUsd: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="Uncapped"
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Discount % (e.g. 20)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={safe.discountPct ?? ""}
                          onChange={(e) =>
                            updateSafe(idx, {
                              discountPct: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="0"
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                        Notes / Issuance Context
                      </label>
                      <input
                        type="text"
                        value={safe.dateOrNotes ?? ""}
                        onChange={(e) => updateSafe(idx, { dateOrNotes: e.target.value })}
                        placeholder="e.g. YC Batch W24, 20% discount on priced round"
                        className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Total Outstanding SAFE Balances:
                  </span>
                  <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    ${totalSafeBalance.toLocaleString()} USD
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMON STOCK HOLDERS */}
          {modalTab === "common" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Common Stock Holders &amp; Option Pool
                  </h3>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    Founders, early employees, advisors, and unallocated ESOP equity grants.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCommon}
                  className="gap-1.5 text-xs text-blue-700 border-blue-300 dark:border-blue-800 dark:text-blue-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Common Holder
                </Button>
              </div>

              <div className="space-y-3">
                {common.map((holder, idx) => (
                  <div
                    key={holder.id || idx}
                    className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Shareholder Name
                        </label>
                        <input
                          type="text"
                          value={holder.holderName}
                          onChange={(e) => updateCommon(idx, { holderName: e.target.value })}
                          placeholder="e.g. Elena Rostova, ESOP Pool"
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                          required
                        />
                      </div>
                      <div className="w-52">
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Role / Relationship
                        </label>
                        <input
                          type="text"
                          value={holder.roleOrRelationship}
                          onChange={(e) => updateCommon(idx, { roleOrRelationship: e.target.value })}
                          placeholder="e.g. CEO / Co-Founder, ESOP"
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCommon(idx)}
                        className="text-neutral-400 hover:text-red-600 p-1 mt-5"
                        title="Remove Common Holder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Pre-Round Ownership %
                        </label>
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          max={100}
                          value={holder.ownershipPct}
                          onChange={(e) => updateCommon(idx, { ownershipPct: Number(e.target.value) })}
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Common Shares Count
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={holder.shareCount ?? ""}
                          onChange={(e) =>
                            updateCommon(idx, {
                              shareCount: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="e.g. 4500000"
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Vesting Schedule
                        </label>
                        <input
                          type="text"
                          value={holder.vestingTerms ?? ""}
                          onChange={(e) => updateCommon(idx, { vestingTerms: e.target.value })}
                          placeholder="4-year monthly, 1-year cliff"
                          className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <span className="font-semibold text-blue-900 dark:text-blue-200">
                    Total Common Equity Allocated:
                  </span>
                  <span className="font-mono text-sm font-bold text-blue-700 dark:text-blue-300">
                    {totalCommonPct}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Cap Table &amp; SAFE Balances
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
