-- CreateEnum
CREATE TYPE "Typology" AS ENUM ('ONE_A', 'ONE_B', 'TWO_A', 'TWO_B');

-- CreateEnum
CREATE TYPE "DimensionKey" AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'D1', 'D2', 'D3', 'D4', 'D5');

-- CreateEnum
CREATE TYPE "StatusBadge" AS ENUM ('READY_TO_SHIP', 'NEEDS_WORK', 'MAJOR_REWORK');

-- CreateEnum
CREATE TYPE "RiskClassification" AS ENUM ('BULL', 'BEAR', 'BILATERAL');

-- CreateEnum
CREATE TYPE "RiskSource" AS ENUM ('TYPOLOGY', 'FRAMING', 'EMPIRICAL', 'LLM_INFERENCE');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "DiagnosticType" AS ENUM ('ERROR', 'CALIBRATION_WARNING');

-- CreateEnum
CREATE TYPE "FramingSourceType" AS ENUM ('DOCX', 'WIZARD', 'CHAT');

-- CreateEnum
CREATE TYPE "SanityVerdict" AS ENUM ('READY_FOR_ANALYSIS', 'MAJOR_REWORK_NEEDED');

-- CreateEnum
CREATE TYPE "EloWinner" AS ENUM ('A', 'B', 'TIE');

-- CreateEnum
CREATE TYPE "EloMargin" AS ENUM ('CLEAR', 'MODERATE', 'SLIGHT', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "EloConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "BenchmarkTypology" AS ENUM ('ONE_A', 'ONE_B', 'TWO_A', 'TWO_B', 'CROSS');

-- CreateTable
CREATE TABLE "Memo" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "typology" "Typology" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Framing" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "FramingSourceType" NOT NULL,
    "content" TEXT NOT NULL,
    "typology" "Typology",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Framing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringRun" (
    "id" SERIAL NOT NULL,
    "memoId" INTEGER NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "memoConfidence" DOUBLE PRECISION NOT NULL,
    "decisionConfidence" DOUBLE PRECISION NOT NULL,
    "riskMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "statusBadge" "StatusBadge" NOT NULL,
    "stage1Avg" DOUBLE PRECISION NOT NULL,
    "stage2Avg" DOUBLE PRECISION NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scorerId" TEXT,

    CONSTRAINT "ScoringRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimensionScore" (
    "id" SERIAL NOT NULL,
    "scoringRunId" INTEGER NOT NULL,
    "dimensionKey" "DimensionKey" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "subScores" JSONB NOT NULL,
    "traceabilityLog" JSONB NOT NULL,
    "serverComputed" DOUBLE PRECISION NOT NULL,
    "agentSelfReported" DOUBLE PRECISION,
    "calibrationDrift" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DimensionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmedRisk" (
    "id" SERIAL NOT NULL,
    "scoringRunId" INTEGER NOT NULL,
    "statement" TEXT NOT NULL,
    "classification" "RiskClassification" NOT NULL,
    "source" "RiskSource" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConfirmedRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gap" (
    "id" SERIAL NOT NULL,
    "scoringRunId" INTEGER NOT NULL,
    "dimensionKey" "DimensionKey" NOT NULL,
    "issue" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "fix" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,

    CONSTRAINT "Gap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edit" (
    "id" SERIAL NOT NULL,
    "scoringRunId" INTEGER NOT NULL,
    "dimensionKey" "DimensionKey" NOT NULL,
    "issue" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "fix" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,

    CONSTRAINT "Edit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnostic" (
    "id" SERIAL NOT NULL,
    "scoringRunId" INTEGER NOT NULL,
    "type" "DiagnosticType" NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "Diagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanityCheck" (
    "id" SERIAL NOT NULL,
    "framingId" INTEGER NOT NULL,
    "verdict" "SanityVerdict" NOT NULL,
    "passCount" INTEGER NOT NULL,
    "failCount" INTEGER NOT NULL,
    "enhanceCount" INTEGER NOT NULL,
    "triageMatrix" JSONB NOT NULL,
    "revisedFraming" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SanityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanityIssue" (
    "id" SERIAL NOT NULL,
    "sanityCheckId" INTEGER NOT NULL,
    "issue" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "fix" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "evidenceBasis" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SanityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EloRecord" (
    "id" SERIAL NOT NULL,
    "memoId" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "comparisonCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EloRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EloComparison" (
    "id" SERIAL NOT NULL,
    "memoAId" INTEGER NOT NULL,
    "memoBId" INTEGER NOT NULL,
    "winner" "EloWinner" NOT NULL,
    "margin" "EloMargin" NOT NULL,
    "confidence" "EloConfidence" NOT NULL,
    "humanOverride" BOOLEAN NOT NULL DEFAULT false,
    "reasoning" TEXT,
    "comparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EloComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkEntry" (
    "id" SERIAL NOT NULL,
    "typology" "BenchmarkTypology" NOT NULL,
    "metric" TEXT NOT NULL,
    "plausibleRange" TEXT NOT NULL,
    "boundaryRange" TEXT,
    "outOfRange" TEXT,
    "sources" TEXT NOT NULL,

    CONSTRAINT "BenchmarkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EloRecord_memoId_key" ON "EloRecord"("memoId");

-- AddForeignKey
ALTER TABLE "ScoringRun" ADD CONSTRAINT "ScoringRun_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionScore" ADD CONSTRAINT "DimensionScore_scoringRunId_fkey" FOREIGN KEY ("scoringRunId") REFERENCES "ScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedRisk" ADD CONSTRAINT "ConfirmedRisk_scoringRunId_fkey" FOREIGN KEY ("scoringRunId") REFERENCES "ScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_scoringRunId_fkey" FOREIGN KEY ("scoringRunId") REFERENCES "ScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edit" ADD CONSTRAINT "Edit_scoringRunId_fkey" FOREIGN KEY ("scoringRunId") REFERENCES "ScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostic" ADD CONSTRAINT "Diagnostic_scoringRunId_fkey" FOREIGN KEY ("scoringRunId") REFERENCES "ScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanityCheck" ADD CONSTRAINT "SanityCheck_framingId_fkey" FOREIGN KEY ("framingId") REFERENCES "Framing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SanityIssue" ADD CONSTRAINT "SanityIssue_sanityCheckId_fkey" FOREIGN KEY ("sanityCheckId") REFERENCES "SanityCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EloRecord" ADD CONSTRAINT "EloRecord_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EloComparison" ADD CONSTRAINT "EloComparison_memoAId_fkey" FOREIGN KEY ("memoAId") REFERENCES "Memo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EloComparison" ADD CONSTRAINT "EloComparison_memoBId_fkey" FOREIGN KEY ("memoBId") REFERENCES "Memo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
