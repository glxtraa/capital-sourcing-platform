import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/env";
import { matchAllProviders, buildMatchInputs } from "../src/lib/matching";

resolveDatabaseUrl();
const db = new PrismaClient();

async function main() {
  const dealId = process.argv[2] || "cmvtpebwb0002jt07ljuj90k4";
  const backupFile = process.argv[3] || "backups/db-snapshot-v2.4.13-2026-10-29T18-41-06-924Z.json";

  console.log(`Restoring deal "${dealId}" from snapshot "${backupFile}"...`);
  const root = JSON.parse(fs.readFileSync(backupFile, "utf8"));
  const data = root.data;

  const dealData = data.deal?.find((d: any) => d.id === dealId);
  if (!dealData) {
    throw new Error(`Deal ${dealId} not found in ${backupFile}`);
  }

  // 1. Deal
  await db.deal.upsert({
    where: { id: dealId },
    create: {
      id: dealData.id,
      orgId: dealData.orgId,
      name: dealData.name,
      status: dealData.status,
      createdAt: new Date(dealData.createdAt),
      updatedAt: new Date(dealData.updatedAt),
      reviewerNotes: dealData.reviewerNotes,
    },
    update: {
      name: dealData.name,
      status: dealData.status,
      reviewerNotes: dealData.reviewerNotes,
    },
  });

  // 2. Documents
  const docs = (data.uploadedDocument || []).filter((d: any) => d.dealId === dealId);
  for (const doc of docs) {
    let blobUrl = doc.blobUrl;
    if (blobUrl.includes("O7IaKoqsReduSHArvxuxst5fp4QWHs")) {
      blobUrl = blobUrl.replace("O7IaKoqsReduSHArvxuxst5fp4QWHs", "t3vv3PWiacgyUMd395xuL1YYWS4OcV");
    }

    await db.uploadedDocument.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        dealId: doc.dealId,
        fileName: doc.fileName,
        blobUrl,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        extractedFieldsRaw: doc.extractedFieldsRaw,
        documentTypes: doc.documentTypes || [],
        taintOverride: doc.taintOverride || null,
        uploadedAt: new Date(doc.uploadedAt),
      },
      update: {
        blobUrl,
      },
    });
  }

  // 3. Parties
  const parties = (data.party || []).filter((p: any) => p.dealId === dealId);
  for (const p of parties) {
    await db.party.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        dealId: p.dealId,
        role: p.role,
        legalName: p.legalName,
        jurisdiction: p.jurisdiction,
        isListed: p.isListed,
        publicRating: p.publicRating,
        bankName: p.bankName,
        bankAccount: p.bankAccount,
        notes: p.notes,
        primaryRightHolderName: p.primaryRightHolderName,
        primaryRightHolderVerified: p.primaryRightHolderVerified ?? false,
        createdAt: new Date(p.createdAt),
      },
      update: {},
    });
  }

  // 4. Financing Ask
  const asks = (data.financingAsk || []).filter((a: any) => a.dealId === dealId);
  for (const a of asks) {
    await db.financingAsk.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        dealId: a.dealId,
        structureType: a.structureType,
        amount: a.amount,
        currency: a.currency,
        advanceRatePct: a.advanceRatePct,
        tenorDaysMin: a.tenorDaysMin,
        tenorDaysMax: a.tenorDaysMax,
        tenorNote: a.tenorNote,
        recurring: a.recurring ?? false,
        recurringNote: a.recurringNote,
        createdAt: new Date(a.createdAt),
      },
      update: {},
    });
  }

  // 5. Risk Flags
  const flags = (data.riskFlag || []).filter((f: any) => f.dealId === dealId);
  for (const f of flags) {
    await db.riskFlag.upsert({
      where: { id: f.id },
      create: {
        id: f.id,
        dealId: f.dealId,
        category: f.category,
        severity: f.severity,
        description: f.description,
        resolvedAt: f.resolvedAt ? new Date(f.resolvedAt) : null,
        verificationStatus: f.verificationStatus || "UNVERIFIED",
        verifiedBy: f.verifiedBy || null,
        verifiedAt: f.verifiedAt ? new Date(f.verifiedAt) : null,
        verificationNotes: f.verificationNotes || null,
        sourceFileName: f.sourceFileName || null,
        evidenceSnippet: f.evidenceSnippet || null,
        createdAt: new Date(f.createdAt),
      },
      update: {},
    });
  }

  // 6. Term Sheet
  const sheets = (data.termSheet || []).filter((s: any) => s.dealId === dealId);
  for (const s of sheets) {
    await db.termSheet.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        dealId: s.dealId,
        markdown: s.markdown,
        version: s.version,
        createdAt: new Date(s.createdAt),
      },
      update: {},
    });
  }

  // 7. Re-match with current active providers
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    include: { parties: true, financingAsks: true },
  });
  if (deal && deal.parties.length > 0 && deal.financingAsks.length > 0) {
    const providers = await db.provider.findMany();
    const { dealInput, askInput } = buildMatchInputs(deal.parties, deal.financingAsks);
    const results = matchAllProviders(providers, dealInput, askInput);
    await db.providerMatch.deleteMany({ where: { dealId } });
    await db.providerMatch.createMany({
      data: results.map((r) => ({
        dealId,
        providerId: r.providerId,
        verdict: r.eligibleOnPaper ? "POSSIBLE" : "EXCLUDED",
        rationale: r.reasons.join("; ") || "No disqualifying factors found by the mechanical pre-filter.",
        isTier1: r.eligibleOnPaper,
      })),
    });
    console.log(`✓ Re-matched restored deal with ${providers.length} providers.`);
  }

  console.log(`✓ Deal "${dealData.name}" (${dealId}) fully restored with all relations!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
