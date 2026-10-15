import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { UploadDropzone } from "@/components/UploadDropzone";

export default function NewDealPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New Invoice Deal</h1>
        <p className="text-sm text-neutral-500">
          Upload receivables, factoring, or supplier finance documents (invoices, debtor ledgers, supply agreements).
        </p>
        <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/60 p-3 text-xs dark:border-purple-900 dark:bg-purple-950/30 flex items-center justify-between">
          <span className="text-purple-800 dark:text-purple-300">
            Structuring a commodity or cross-border tripartite trade (Buy Leg + Sell Leg, Incoterms, cargo BL)?
          </span>
          <a
            href="/trade-deals/new"
            className="font-semibold text-purple-700 underline hover:text-purple-900 dark:text-purple-300 dark:hover:text-purple-100 shrink-0 ml-2"
          >
            Go to Trade Finance Deal Intake &rarr;
          </a>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadDropzone />
        </CardContent>
      </Card>
    </div>
  );
}
