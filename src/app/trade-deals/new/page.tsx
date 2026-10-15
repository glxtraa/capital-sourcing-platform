import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { TradeUploadDropzone } from "@/components/TradeUploadDropzone";

export default function NewTradeDealPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">New Trade Finance Deal</h1>
          <Badge tone="purple">Multi-Party Flow</Badge>
        </div>
        <p className="text-sm text-neutral-500">
          Upload paired commercial contracts (Supply Leg &amp; Offtake Leg), letters of credit,
          shipping documents, and regulatory licenses. The system automatically reconciles quantities,
          pricing spread, Incoterm risk transfer points, and evaluates Umbrella vs Leg-specific funder structures.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade Deal Intake</CardTitle>
        </CardHeader>
        <CardContent>
          <TradeUploadDropzone />
        </CardContent>
      </Card>
    </div>
  );
}
