import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { computeSessionFingerprint } from "@/dsl/provenance";

export const dynamic = "force-dynamic";

/**
 * GET /api/dsl-revisions?dealId=...&dslType=...&tabKey=...
 * Returns all persisted DSL revisions for the specified deal and DSL type,
 * sorted newest to oldest.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const dealId = searchParams.get("dealId");
    const dslType = searchParams.get("dslType");
    const tabKey = searchParams.get("tabKey");

    if (!dealId) {
      return NextResponse.json({ error: "Missing required dealId" }, { status: 400 });
    }

    const where: { dealId: string; dslType?: string; tabKey?: string } = { dealId };
    if (dslType) where.dslType = dslType;
    if (tabKey) where.tabKey = tabKey;

    const revisions = await db.dealDslRevision.findMany({
      where,
      orderBy: { versionNumber: "desc" },
    });

    return NextResponse.json({ ok: true, revisions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/dsl-revisions
 * Commits a new named DSL version to persistent storage and immediately applies
 * the changes to the underlying deal database record.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      assetClass = "STARTUP",
      dealId,
      tabKey = "spec",
      dslType = "STARTUP_DEAL_SPEC",
      label,
      authorType = "HUMAN_OVERRIDE",
      authorNote,
      payloadJson,
      diffSummary,
    } = body;

    if (!dealId || !payloadJson) {
      return NextResponse.json({ error: "Missing dealId or payloadJson" }, { status: 400 });
    }

    // 1. Determine next version number
    const latestRevision = await db.dealDslRevision.findFirst({
      where: { dealId, dslType },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const nextVersion = (latestRevision?.versionNumber ?? 0) + 1;
    const computedLabel = label || `v${nextVersion} (${authorType === "HUMAN_OVERRIDE" ? "Human Override" : "Agent Extraction"})`;

    // 2. Mark existing revisions as not current
    await db.dealDslRevision.updateMany({
      where: { dealId, dslType, isCurrent: true },
      data: { isCurrent: false },
    });

    // Capture human operator telemetry
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "127.0.0.1";
    const city = req.headers.get("x-vercel-ip-city");
    const country = req.headers.get("x-vercel-ip-country");
    const geoLocation = city && country ? `${city}, ${country}` : country || city || null;
    const userAgent = req.headers.get("user-agent") || "Browser Client";

    const otpSessionCookie = req.cookies.get("otp_session")?.value;
    const siteAuthCookie = req.cookies.get("site_auth")?.value;
    const authMethod = otpSessionCookie ? "GOOGLE_CHAT_OTP" : siteAuthCookie ? "SITE_PASSWORD" : "LOCAL_DEV_BYPASS";
    const sessionFingerprint = computeSessionFingerprint(otpSessionCookie || siteAuthCookie);

    const humanActor = {
      actorType: "HUMAN_OPERATOR" as const,
      authMethod,
      sessionFingerprint,
      clientIp,
      geoLocation,
      userAgentSummary: userAgent.slice(0, 120),
      actionType: authorType === "ROLLBACK_RESTORE" ? ("REVISION_ROLLBACK" as const) : ("MANUAL_DSL_EDIT" as const),
      auditComment: authorNote || null,
      processedAt: new Date().toISOString(),
    };

    // Enrich payload with operator telemetry without mutating existing keys
    const enrichedPayload = typeof payloadJson === "object" && payloadJson !== null
      ? { ...payloadJson, _lastHumanActor: humanActor }
      : payloadJson;

    // 3. Create the new revision
    const revision = await db.dealDslRevision.create({
      data: {
        assetClass,
        dealId,
        tabKey,
        dslType,
        versionNumber: nextVersion,
        label: computedLabel,
        authorType,
        authorNote: authorNote || null,
        payloadJson: enrichedPayload,
        diffSummary: diffSummary || null,
        isCurrent: true,
      },
    });

    // 4. Propagate changes directly into the deal records
    await applyDslPayloadToDealRecord(assetClass, dealId, dslType, payloadJson);

    return NextResponse.json({ ok: true, revision });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Synchronizes DSL fields into the relational database entities.
 */
export async function applyDslPayloadToDealRecord(
  assetClass: string,
  dealId: string,
  dslType: string,
  payload: Record<string, unknown>
) {
  if (assetClass === "STARTUP" || dslType === "STARTUP_DEAL_SPEC") {
    // 1. Update StartupDeal core fields
    const dataToUpdate: Record<string, unknown> = {};
    if (typeof payload.companyName === "string" && payload.companyName.trim()) {
      dataToUpdate.companyName = payload.companyName.trim();
    }
    if (typeof payload.stage === "string") {
      dataToUpdate.stage = payload.stage;
    }
    if (typeof payload.primaryVertical === "string") {
      dataToUpdate.primaryVertical = payload.primaryVertical;
    }
    if (typeof payload.industry === "string") {
      dataToUpdate.industry = payload.industry;
    }
    if (Array.isArray(payload.subIndustries)) {
      dataToUpdate.subIndustries = payload.subIndustries.filter((s) => typeof s === "string" && s.trim().length > 0);
    }
    if (typeof payload.targetCustomerProfile === "string") {
      dataToUpdate.targetCustomerProfile = payload.targetCustomerProfile;
    }
    if (typeof payload.businessModel === "string") {
      dataToUpdate.businessModel = payload.businessModel;
    }
    if (typeof payload.legalEntityJurisdiction === "string" && payload.legalEntityJurisdiction.trim()) {
      dataToUpdate.legalEntityJurisdiction = payload.legalEntityJurisdiction.trim();
    }

    if (Object.keys(dataToUpdate).length > 0) {
      await db.startupDeal.update({
        where: { id: dealId },
        data: dataToUpdate,
      });
    }

    // 2. Update financing ask if provided
    if (typeof payload.targetRaiseUsd === "number") {
      const ask = await db.startupFinancingAsk.findFirst({ where: { dealId } });
      if (ask) {
        await db.startupFinancingAsk.update({
          where: { id: ask.id },
          data: {
            targetRaiseUsd: payload.targetRaiseUsd,
            ...(typeof payload.valuationCapUsd === "number" ? { valuationCapUsd: payload.valuationCapUsd } : {}),
            ...(typeof payload.instrumentType === "string" ? { instrumentType: payload.instrumentType as any } : {}),
          },
        });
      }
    }

    // 3. Update cap table if provided
    if (typeof payload.foundersOwnershipPct === "number") {
      await db.startupCapTable.upsert({
        where: { dealId },
        create: {
          dealId,
          foundersOwnershipPct: payload.foundersOwnershipPct,
          investorOwnershipPct: typeof payload.investorOwnershipPct === "number" ? payload.investorOwnershipPct : 0,
          optionPoolPct: typeof payload.optionPoolPct === "number" ? payload.optionPoolPct : 10,
          safesNotesOutstandingUsd:
            typeof payload.safesNotesOutstandingUsd === "number" ? payload.safesNotesOutstandingUsd : 0,
        },
        update: {
          foundersOwnershipPct: payload.foundersOwnershipPct,
          ...(typeof payload.investorOwnershipPct === "number" ? { investorOwnershipPct: payload.investorOwnershipPct } : {}),
          ...(typeof payload.optionPoolPct === "number" ? { optionPoolPct: payload.optionPoolPct } : {}),
          ...(typeof payload.safesNotesOutstandingUsd === "number" ? { safesNotesOutstandingUsd: payload.safesNotesOutstandingUsd } : {}),
        },
      });
    }
  } else if (assetClass === "TRADE" || dslType === "TRADE_DEAL_SPEC") {
    const dataToUpdate: Record<string, unknown> = {};
    if (typeof payload.name === "string" && payload.name.trim()) dataToUpdate.name = payload.name.trim();
    if (typeof payload.corridor === "string") dataToUpdate.corridor = payload.corridor as any;

    if (Object.keys(dataToUpdate).length > 0) {
      await db.tradeDeal.update({
        where: { id: dealId },
        data: dataToUpdate,
      });
    }
  } else if (assetClass === "INVOICE" || dslType === "INVOICE_DEAL_SPEC") {
    const rawName = typeof payload.companyName === "string" ? payload.companyName : typeof payload.name === "string" ? payload.name : null;
    if (rawName && rawName.trim()) {
      await db.deal.update({
        where: { id: dealId },
        data: { name: rawName.trim() },
      });
    }
  }
}
