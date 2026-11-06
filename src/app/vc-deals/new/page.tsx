import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { VcUploadDropzone } from "@/components/VcUploadDropzone";
import { Sparkles, FileSpreadsheet, Globe, FileText } from "lucide-react";

export default function NewVcDealPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            New Startup VC Deal Intake
          </h1>
          <Badge tone="green">Multi-Tier Syndicate Flow</Badge>
        </div>
        <p className="text-sm text-neutral-500">
          Drop pitch decks, raw cap table spreadsheets (.xlsx, .xls, .csv), or paste Google Sheets model links.
          No manual forms required — the AI agent infers the company name, stage, sector, jurisdiction, target raise, valuation cap, and cap table automatically.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <CardTitle>Startup Data Room Intake</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <VcUploadDropzone />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-neutral-500">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <FileText className="h-4 w-4 text-blue-600 shrink-0" />
          <span>Pitch Decks (.pdf) parsed with vision OCR</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Multi-sheet Excel &amp; CSV workbooks supported</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <Globe className="h-4 w-4 text-purple-600 shrink-0" />
          <span>Live Google Sheets links ingested automatically</span>
        </div>
      </div>
    </div>
  );
}
