-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING_REVIEW', 'PROMOTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ResearchTaskKind" AS ENUM ('ONBOARDING', 'DISCOVERY', 'PROFILE');

-- CreateEnum
CREATE TYPE "ResearchTaskStatus" AS ENUM ('QUEUED', 'SEARCHED', 'DONE', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProviderType" ADD VALUE 'FAMILY_OFFICE';
ALTER TYPE "ProviderType" ADD VALUE 'PRIVATE_CREDIT_FUND';

-- CreateTable
CREATE TABLE "ProviderOnboarding" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "taskId" TEXT,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "applicationRoute" TEXT NOT NULL,
    "applicationUrl" TEXT,
    "accountRequiredBeforeForm" BOOLEAN,
    "formFieldsVisibility" TEXT NOT NULL,
    "contacts" JSONB NOT NULL,
    "formFields" JSONB NOT NULL,
    "documentsToPrepare" JSONB NOT NULL,
    "steps" TEXT[],
    "eligibilityChecks" TEXT[],
    "typicalTurnaround" TEXT,
    "confidence" "ProviderConfidence" NOT NULL,
    "sources" TEXT[],
    "notes" TEXT,
    "researchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCandidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "domain" TEXT,
    "suggestedType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whySurfaced" TEXT NOT NULL,
    "jurisdictionsHint" TEXT[],
    "sources" TEXT[],
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "promotedProviderId" TEXT,
    "taskId" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchBatch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchTask" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "kind" "ResearchTaskKind" NOT NULL,
    "status" "ResearchTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "candidateId" TEXT,
    "subject" TEXT NOT NULL,
    "payload" JSONB,
    "findings" TEXT,
    "citedUrls" TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "error" TEXT,
    "resultSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ProviderOnboarding_providerId_status_idx" ON "ProviderOnboarding"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCandidate_normalizedName_key" ON "ProviderCandidate"("normalizedName");

-- CreateIndex
CREATE INDEX "ResearchTask_batchId_status_idx" ON "ResearchTask"("batchId", "status");

-- AddForeignKey
ALTER TABLE "ProviderOnboarding" ADD CONSTRAINT "ProviderOnboarding_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchTask" ADD CONSTRAINT "ResearchTask_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ResearchBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

