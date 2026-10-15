"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import { X, Loader2, Save, FileText } from "lucide-react";

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
    }>;
    debtorSummary?: {
      annualTurnoverUsd: number | null;
      yearsOperating: number | null;
    } | null;
    financingAsks: Array<{
      id?: string;
      amountUsd?: number;
      amount?: number;
      advanceRatePct?: number | null;
      targetTenorDays?: number | null;
      tenorDaysMax?: number | null;
    }>;
  };
  onClose: () => void;
}

export function EditInvoiceDealModal({ deal, onClose }: EditInvoiceDealModalProps) {
  const router = useRouter();
  const debtorParty =
    deal.parties.find((p) => p.role === "DEBTOR" || p.role === "OBLIGOR")?.legalName ??
    deal.parties.find((p) => p.role === "DEBTOR" || p.role === "OBLIGOR")?.name ??
    "Acme Debtor";
  const borrowerParty =
    deal.parties.find((p) => p.role === "BORROWER" || p.role === "CLIENT")?.legalName ??
    deal.parties.find((p) => p.role === "BORROWER" || p.role === "CLIENT")?.name ??
    "Borrower Corp";
  const ask = deal.financingAsks[0];

  const [name, setName] = useState(deal.name);
  const [currency, setCurrency] = useState(deal.currency || "USD");
  const [debtorName, setDebtorName] = useState(debtorParty);
  const [borrowerName, setBorrowerName] = useState(borrowerParty);

  const [annualTurnoverUsd, setAnnualTurnoverUsd] = useState(deal.debtorSummary?.annualTurnoverUsd ?? 5000000);
  const [yearsOperating, setYearsOperating] = useState(deal.debtorSummary?.yearsOperating ?? 5);

  const [amountUsd, setAmountUsd] = useState(ask?.amountUsd ?? (typeof ask?.amount === "number" ? ask.amount : 250000));
  const [advanceRatePct, setAdvanceRatePct] = useState(ask?.advanceRatePct ?? 85);
  const [targetTenorDays, setTargetTenorDays] = useState(ask?.targetTenorDays ?? (typeof ask?.tenorDaysMax === "number" ? ask.tenorDaysMax : 60));

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          currency,
          parties: [
            { name: debtorName, role: "DEBTOR" },
            { name: borrowerName, role: "BORROWER" },
          ],
          debtorSummary: {
            annualTurnoverUsd: Number(annualTurnoverUsd),
            yearsOperating: Number(yearsOperating),
          },
          financingAsks: [
            {
              amountUsd: Number(amountUsd),
              advanceRatePct: Number(advanceRatePct),
              targetTenorDays: Number(targetTenorDays),
            },
          ],
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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
              Edit Invoice Deal Spec
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
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
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Debtor Company</label>
              <input
                type="text"
                value={debtorName}
                onChange={(e) => setDebtorName(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                required
              />
            </div>
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Borrower Company</label>
              <input
                type="text"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Debtor Annual Turnover ($ USD)</label>
              <input
                type="number"
                value={annualTurnoverUsd}
                onChange={(e) => setAnnualTurnoverUsd(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
              />
            </div>
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Years Operating</label>
              <input
                type="number"
                value={yearsOperating}
                onChange={(e) => setYearsOperating(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Facility Amount ($ USD)</label>
              <input
                type="number"
                value={amountUsd}
                onChange={(e) => setAmountUsd(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
                required
              />
            </div>
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Advance Rate %</label>
              <input
                type="number"
                value={advanceRatePct}
                onChange={(e) => setAdvanceRatePct(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
              />
            </div>
            <div>
              <label className="font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Target Tenor (Days)</label>
              <input
                type="number"
                value={targetTenorDays}
                onChange={(e) => setTargetTenorDays(Number(e.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 font-mono"
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-neutral-900 text-white gap-1.5 dark:bg-white dark:text-neutral-900">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save &amp; Recalculate Matches
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
