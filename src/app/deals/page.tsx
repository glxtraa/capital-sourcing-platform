import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/auth";
import { Card, CardContent, Button, EmptyState } from "@/components/ui/primitives";
import { DealStatusBadge } from "@/components/DealStatusBadge";
import { DeleteDealButton } from "@/components/DeleteDealButton";

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
      {/* Banner linking to Trade Finance platform */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-900/60 dark:bg-purple-950/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              New Module
            </span>
            <span className="rounded-full bg-purple-200/70 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Deterministic DSL &amp; Multi-Leg Engine
            </span>
          </div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-1">
            Looking for Tripartite Trade Finance Deals?
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
            Structure bilateral contracts (Coal, Agri, Seafood), run automated cashflow gap reconciliation, and calculate deterministic term sheets.
          </p>
        </div>
        <Link href="/trade-deals">
          <Button className="bg-purple-600 text-white hover:bg-purple-700 text-xs shadow-xs">
            Open Trade Deals Workspace &rarr;
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Invoice Deals</h1>
          <p className="text-sm text-neutral-500">
            Upload a company&apos;s invoice financing deal documents, extract a structured spec, and match it
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
            <Card key={deal.id} className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4">
                <Link href={`/deals/${deal.id}`} className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">
                    {deal.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {deal._count.documents} document{deal._count.documents === 1 ? "" : "s"} ·{" "}
                    {deal._count.providerMatches} provider match
                    {deal._count.providerMatches === 1 ? "" : "es"}
                  </p>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <DealStatusBadge status={deal.status} />
                  <DeleteDealButton
                    dealId={deal.id}
                    dealName={deal.name}
                    variant="icon"
                    redirectOnDelete={false}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
