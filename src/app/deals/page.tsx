import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { Card, CardContent, Button, EmptyState } from "@/components/ui/primitives";
import { DealStatusBadge } from "@/components/DealStatusBadge";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const orgId = await getCurrentOrgId();
  const deals = await db.deal.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { documents: true, providerMatches: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Deals</h1>
          <p className="text-sm text-neutral-500">
            Upload a company&apos;s deal documents, extract a structured spec, and match it
            against the capital provider database.
          </p>
        </div>
        <Link href="/deals/new">
          <Button>New deal</Button>
        </Link>
      </div>

      {deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description='Click "New deal" to upload your first set of documents.'
        />
      ) : (
        <div className="grid gap-3">
          {deals.map((deal) => (
            <Link key={deal.id} href={`/deals/${deal.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{deal.name}</p>
                    <p className="text-sm text-neutral-500">
                      {deal._count.documents} document{deal._count.documents === 1 ? "" : "s"} ·{" "}
                      {deal._count.providerMatches} provider match
                      {deal._count.providerMatches === 1 ? "" : "es"}
                    </p>
                  </div>
                  <DealStatusBadge status={deal.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
