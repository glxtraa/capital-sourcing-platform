import { NextResponse, type NextRequest } from "next/server";
import { strToU8, zipSync } from "fflate";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { toCsv, CSV_BOM } from "@/lib/csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function flattenForSheet(rows: Record<string, any>[]): Record<string, any>[] {
  if (!rows || rows.length === 0) return [{ Status: "No records found" }];
  return rows.map((r) => {
    const flat: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v === null || v === undefined) {
        flat[k] = "";
      } else if (v instanceof Date) {
        flat[k] = v.toISOString();
      } else if (Array.isArray(v)) {
        flat[k] = v.map((item) => (typeof item === "object" ? JSON.stringify(item) : item)).join(", ");
      } else if (typeof v === "object") {
        flat[k] = JSON.stringify(v);
      } else {
        flat[k] = v;
      }
    }
    return flat;
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";
  const stamp = new Date().toISOString().slice(0, 10);

  // 1. Try to find startup deal
  const startupDeal = await db.startupDeal.findUnique({
    where: { id: dealId },
    include: {
      founders: { orderBy: { createdAt: "asc" } },
      capTable: true,
      financingAsks: true,
      riskFlags: { orderBy: { severity: "desc" } },
      competitors: { orderBy: { createdAt: "desc" } },
      commercialProspects: {
        include: { contacts: true },
        orderBy: { createdAt: "desc" },
      },
      documents: { orderBy: { uploadedAt: "desc" } },
      matches: {
        include: { investor: true },
        orderBy: { tier: "asc" },
      },
      syndicateBlueprints: { orderBy: { createdAt: "desc" } },
    },
  });

  if (startupDeal) {
    const dslRevisions = await db.dealDslRevision.findMany({
      where: { dealId },
      orderBy: { createdAt: "desc" },
    });

    const safeName = startupDeal.companyName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const filenameBase = `${safeName}-deal-pack-${stamp}`;

    // Contacts flattened
    const allContacts = startupDeal.commercialProspects.flatMap((p) =>
      p.contacts.map((c) => ({
        accountName: p.name,
        accountCategory: p.category,
        fullName: c.fullName,
        title: c.title,
        roleCategory: c.roleCategory,
        department: c.department || "",
        linkedinUrl: c.linkedinUrl || "",
        emailPattern: c.emailPattern || "",
        location: c.location || "",
        relevanceRationale: c.relevanceRationale || "",
        outreachAngle: c.outreachAngle || "",
      }))
    );

    // Formatted tables for individual deal
    const dealSections: { sheetName: string; rows: Record<string, any>[] }[] = [
      {
        sheetName: "Company Spec",
        rows: [
          {
            id: startupDeal.id,
            companyName: startupDeal.companyName,
            stage: startupDeal.stage,
            primaryVertical: startupDeal.primaryVertical,
            industry: startupDeal.industry || "",
            subIndustries: startupDeal.subIndustries.join(", "),
            targetCustomerProfile: startupDeal.targetCustomerProfile || "",
            businessModel: startupDeal.businessModel || "",
            legalEntityJurisdiction: startupDeal.legalEntityJurisdiction,
            status: startupDeal.status,
            createdAt: startupDeal.createdAt.toISOString(),
          },
        ],
      },
      {
        sheetName: "Founders & Execs",
        rows: startupDeal.founders.map((f) => ({
          name: f.name,
          role: f.role,
          equityOwnershipPct: `${f.equityOwnershipPct}%`,
          isTechnical: f.isTechnical ? "YES" : "NO",
          isRepeatFounder: f.isRepeatFounder ? "YES" : "NO",
          vestingConfirmed: f.vestingConfirmed ? "YES" : "NO",
          priorExits: f.priorExits.join(", "),
        })),
      },
      {
        sheetName: "Cap Table & SAFEs",
        rows: startupDeal.capTable
          ? [
              {
                foundersOwnershipPct: `${startupDeal.capTable.foundersOwnershipPct}%`,
                investorOwnershipPct: `${startupDeal.capTable.investorOwnershipPct}%`,
                optionPoolPct: `${startupDeal.capTable.optionPoolPct}%`,
                safesNotesOutstandingUsd: startupDeal.capTable.safesNotesOutstandingUsd,
                hasDeadEquity: startupDeal.capTable.hasDeadEquity ? "YES" : "NO",
                deadEquityNotes: startupDeal.capTable.deadEquityNotes || "",
                safeHoldersJson: startupDeal.capTable.safeHoldersJson,
                commonHoldersJson: startupDeal.capTable.commonHoldersJson,
              },
            ]
          : [],
      },
      {
        sheetName: "Financing Asks",
        rows: startupDeal.financingAsks.map((a) => ({
          targetRaiseUsd: a.targetRaiseUsd,
          instrumentType: a.instrumentType,
          valuationCapUsd: a.valuationCapUsd || "",
          discountPct: a.discountPct != null ? `${a.discountPct}%` : "",
          plannedRunwayMonths: a.plannedRunwayMonths,
          leadCommitted: a.leadCommitted ? "YES" : "NO",
          committedAmountUsd: a.committedAmountUsd,
        })),
      },
      {
        sheetName: "Competitors & Backers",
        rows: startupDeal.competitors.map((c) => ({
          name: c.name,
          overlapDegree: c.overlapDegree,
          description: c.description,
          knownInvestors: c.knownInvestors.join(", "),
          differentiation: c.differentiation || "",
          websiteUrl: c.websiteUrl || "",
          sourceUrl: c.sourceUrl || "",
          sourceVerified: c.sourceVerified ? "YES" : "NO",
        })),
      },
      {
        sheetName: "Commercial ICPs",
        rows: startupDeal.commercialProspects.map((p) => ({
          name: p.name,
          category: p.category,
          buyerPersona: p.buyerPersona || "",
          useCaseFit: p.useCaseFit,
          estimatedAcvTier: p.estimatedAcvTier,
          strategicSynergy: p.strategicSynergy || "",
          websiteUrl: p.websiteUrl || "",
          contactsCount: p.contacts.length,
        })),
      },
      {
        sheetName: "Executive Leads",
        rows: allContacts,
      },
      {
        sheetName: "Investor Matches",
        rows: startupDeal.matches.map((m) => ({
          investorName: m.investor.name,
          tier: m.tier,
          thesisResonanceScore: m.thesisResonanceScore != null ? `${m.thesisResonanceScore}/100` : "",
          rationale: m.rationale,
          portfolioConflictDetected: m.portfolioConflictDetected ? "YES" : "NO",
          competitorConflictNotes: m.competitorConflictNotes || "",
          conflictingPortfolioCompany: m.conflictingPortfolioCompany || "",
          headquarters: (m.investor as any).headquarters || "",
          checkSizeRangeUsd:
            m.investor.minCheckUsd && m.investor.maxCheckUsd
              ? `$${m.investor.minCheckUsd.toLocaleString()} - $${m.investor.maxCheckUsd.toLocaleString()}`
              : "",
          activelyFundingIndustry: m.activelyFundingIndustry !== false ? "YES" : "NO",
          websiteUrl: (m.investor as any).websiteUrl || "",
          contactEmail: (m.investor as any).contactEmail || "",
        })),
      },
      {
        sheetName: "Syndicate Blueprint",
        rows: startupDeal.syndicateBlueprints.map((b) => ({
          targetRaiseUsd: b.targetRaiseUsd,
          leadAllocationUsd: b.leadAllocationUsd,
          syndicateAllocationUsd: b.syndicateAllocationUsd,
          angelAllocationUsd: b.angelAllocationUsd,
          recommendedValuationCapUsd: b.recommendedValuationCapUsd || "",
          synthesisSummary: b.synthesisSummary,
          createdAt: b.createdAt.toISOString(),
        })),
      },
      {
        sheetName: "Risk Flags",
        rows: startupDeal.riskFlags.map((r) => ({
          category: r.category,
          severity: r.severity,
          description: r.description,
          resolved: r.resolved ? "RESOLVED" : "OPEN",
          verificationStatus: r.verificationStatus,
          verificationNotes: r.verificationNotes || "",
        })),
      },
      {
        sheetName: "DSL Revisions",
        rows: dslRevisions.map((rev) => ({
          versionNumber: rev.versionNumber,
          label: rev.label,
          dslType: rev.dslType,
          tabKey: rev.tabKey,
          authorType: rev.authorType,
          authorNote: rev.authorNote || "",
          diffSummary: rev.diffSummary || "",
          createdAt: rev.createdAt.toISOString(),
        })),
      },
    ];

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      for (const section of dealSections) {
        const flatRows = flattenForSheet(section.rows);
        const ws = XLSX.utils.json_to_sheet(flatRows);
        XLSX.utils.book_append_sheet(wb, ws, section.sheetName);
      }
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
        },
      });
    }

    if (format === "json") {
      const consolidated = {
        exportedAt: new Date().toISOString(),
        deal: startupDeal,
        dslRevisions,
      };
      return new NextResponse(JSON.stringify(consolidated, null, 2) + "\n", {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
        },
      });
    }

    if (format === "zip") {
      const files: Record<string, Uint8Array> = {};
      for (const section of dealSections) {
        const key = section.sheetName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        files[`${key}.csv`] = strToU8(CSV_BOM + toCsv(section.rows));
      }
      files["deal-manifest.json"] = strToU8(
        JSON.stringify({ exportedAt: new Date().toISOString(), deal: startupDeal }, null, 2) + "\n"
      );
      const zip = zipSync(files);
      return new NextResponse(Buffer.from(zip), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filenameBase}.zip"`,
        },
      });
    }
  }

  // 2. Fallback to regular Invoice deal if dealId matches
  const invoiceDeal = await db.deal.findUnique({
    where: { id: dealId },
    include: {
      parties: true,
      financingAsks: true,
      riskFlags: true,
      providerMatches: { include: { provider: true } },
      termSheets: true,
      documents: true,
    },
  });

  if (invoiceDeal) {
    const safeName = invoiceDeal.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const filenameBase = `${safeName}-invoice-pack-${stamp}`;

    if (format === "json") {
      return new NextResponse(JSON.stringify(invoiceDeal, null, 2) + "\n", {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
        },
      });
    }

    const wb = XLSX.utils.book_new();
    const wsDeal = XLSX.utils.json_to_sheet(flattenForSheet([invoiceDeal]));
    XLSX.utils.book_append_sheet(wb, wsDeal, "Deal Overview");

    const wsParties = XLSX.utils.json_to_sheet(flattenForSheet(invoiceDeal.parties));
    XLSX.utils.book_append_sheet(wb, wsParties, "Parties");

    const wsAsks = XLSX.utils.json_to_sheet(flattenForSheet(invoiceDeal.financingAsks));
    XLSX.utils.book_append_sheet(wb, wsAsks, "Financing Asks");

    const wsRisks = XLSX.utils.json_to_sheet(flattenForSheet(invoiceDeal.riskFlags));
    XLSX.utils.book_append_sheet(wb, wsRisks, "Risk Flags");

    const wsMatches = XLSX.utils.json_to_sheet(flattenForSheet(invoiceDeal.providerMatches));
    XLSX.utils.book_append_sheet(wb, wsMatches, "Matches");

    const wsTerms = XLSX.utils.json_to_sheet(flattenForSheet(invoiceDeal.termSheets));
    XLSX.utils.book_append_sheet(wb, wsTerms, "Term Sheets");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: "Deal not found" }, { status: 404 });
}
