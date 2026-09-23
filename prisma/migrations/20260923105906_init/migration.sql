-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('UPLOADING', 'EXTRACTING', 'NEEDS_REVIEW', 'READY', 'MATCHING', 'RESEARCHING', 'COMPLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FinancingStructureType" AS ENUM ('POST_SHIPMENT_RECEIVABLES_DISCOUNTING', 'PRE_SHIPMENT_PROCUREMENT_FINANCE', 'PRE_EXPORT_BORROWING_BASE', 'ENTERPRISE_SCF_REVERSE_FACTORING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('BORROWER', 'OBLIGOR', 'SUPPLIER', 'INTERMEDIARY', 'GUARANTOR');

-- CreateEnum
CREATE TYPE "RiskFlagCategory" AS ENUM ('CHAIN_OF_TITLE', 'CURRENCY_MISMATCH', 'QUANTITY_OR_TERM_MISMATCH', 'DOCUMENTARY_FRAUD_PATTERN', 'STALE_DEADLINE', 'MISSING_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('BANK', 'SPECIALIST_FACTOR', 'MARKETPLACE', 'ENTERPRISE_SCF_PLATFORM', 'TRADE_FINANCE_FUND');

-- CreateEnum
CREATE TYPE "ProviderConfidence" AS ENUM ('VERIFIED_SITE', 'VERIFIED_SECONDARY', 'UNVERIFIED_NEEDS_CHECK');

-- CreateEnum
CREATE TYPE "MatchVerdict" AS ENUM ('GOOD', 'POSSIBLE', 'POOR', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "ResearchRunKind" AS ENUM ('EXTRACTION', 'PROVIDER_MATCHING', 'PROVIDER_RESEARCH_REFRESH', 'PROVIDER_RESEARCH_NEW', 'LENDER_BENCHMARK');

-- CreateEnum
CREATE TYPE "ResearchRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'NEEDS_HUMAN_INPUT');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'UPLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewerNotes" TEXT,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL,
    "legalName" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "isListed" BOOLEAN,
    "publicRating" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "notes" TEXT,
    "primaryRightHolderName" TEXT,
    "primaryRightHolderVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancingAsk" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "structureType" "FinancingStructureType" NOT NULL DEFAULT 'UNKNOWN',
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "advanceRatePct" DOUBLE PRECISION,
    "tenorDaysMin" INTEGER,
    "tenorDaysMax" INTEGER,
    "tenorNote" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancingAsk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskFlag" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "category" "RiskFlagCategory" NOT NULL,
    "severity" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "extractedFieldsRaw" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "product" TEXT NOT NULL,
    "recourse" TEXT,
    "sellerJurisdictions" TEXT[],
    "obligorJurisdictions" TEXT[],
    "currencies" TEXT[],
    "minTicketUsd" DOUBLE PRECISION,
    "maxTicketUsd" DOUBLE PRECISION,
    "typicalMinAnnualVolumeUsd" DOUBLE PRECISION,
    "gatingFactor" TEXT,
    "feeNotes" TEXT,
    "applicationProcess" TEXT,
    "applicationUrl" TEXT,
    "contact" TEXT,
    "timeToTermSheet" TEXT,
    "confidence" "ProviderConfidence" NOT NULL DEFAULT 'UNVERIFIED_NEEDS_CHECK',
    "lastVerified" TIMESTAMP(3),
    "sources" TEXT[],
    "notes" TEXT,
    "financingStructuresSupported" "FinancingStructureType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderDocumentRequirement" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ProviderDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderMatch" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "verdict" "MatchVerdict" NOT NULL,
    "rationale" TEXT NOT NULL,
    "isTier1" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "kind" "ResearchRunKind" NOT NULL,
    "status" "ResearchRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredBy" TEXT NOT NULL,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermSheet" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "proposedRatePct" DOUBLE PRECISION,
    "rateRationale" TEXT,
    "advanceRatePct" DOUBLE PRECISION,
    "tenorDaysMin" INTEGER,
    "tenorDaysMax" INTEGER,
    "tenorNote" TEXT,
    "currency" TEXT,
    "securityTerms" TEXT,
    "conditionsPrecedent" TEXT,
    "benchmarkTableJson" JSONB,
    "leverageAssessment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderMatch_dealId_providerId_key" ON "ProviderMatch"("dealId", "providerId");

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancingAsk" ADD CONSTRAINT "FinancingAsk_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFlag" ADD CONSTRAINT "RiskFlag_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDocumentRequirement" ADD CONSTRAINT "ProviderDocumentRequirement_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderMatch" ADD CONSTRAINT "ProviderMatch_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderMatch" ADD CONSTRAINT "ProviderMatch_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermSheet" ADD CONSTRAINT "TermSheet_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
