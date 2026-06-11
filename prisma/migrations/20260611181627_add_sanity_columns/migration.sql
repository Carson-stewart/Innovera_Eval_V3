/*
  Warnings:

  - Added the required column `category` to the `SanityIssue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `checkId` to the `SanityIssue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SanityVerdict" ADD VALUE 'READY_FOR_DELIVERY';
ALTER TYPE "SanityVerdict" ADD VALUE 'REVISIONS_REQUIRED';

-- AlterTable
ALTER TABLE "ConfirmedRisk" ADD COLUMN     "addressedNote" TEXT,
ADD COLUMN     "addressedStatus" TEXT;

-- AlterTable
ALTER TABLE "SanityCheck" ADD COLUMN     "typology" TEXT,
ADD COLUMN     "typologyConfidence" TEXT;

-- AlterTable
ALTER TABLE "SanityIssue" ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "checkId" TEXT NOT NULL,
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
ADD COLUMN     "fidelityTier" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "rewrite" TEXT;

-- AlterTable
ALTER TABLE "ScoringRun" ADD COLUMN     "dataNote" TEXT,
ADD COLUMN     "framingId" INTEGER,
ADD COLUMN     "includeInAnalysis" BOOLEAN,
ADD COLUMN     "redundancyVersion" TEXT,
ADD COLUMN     "scoringModel" TEXT;

-- CreateTable
CREATE TABLE "RedundancyAnalysis" (
    "id" SERIAL NOT NULL,
    "scoringRunId" INTEGER NOT NULL,
    "sri" DOUBLE PRECISION NOT NULL,
    "claimCount" INTEGER NOT NULL,
    "uniqueClusterCount" INTEGER NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "favoriteFriends" JSONB NOT NULL,
    "perChapterGain" JSONB,
    "analysisStatus" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedundancyAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedundancyAnalysis_scoringRunId_key" ON "RedundancyAnalysis"("scoringRunId");

-- AddForeignKey
ALTER TABLE "ScoringRun" ADD CONSTRAINT "ScoringRun_framingId_fkey" FOREIGN KEY ("framingId") REFERENCES "Framing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedundancyAnalysis" ADD CONSTRAINT "RedundancyAnalysis_scoringRunId_fkey" FOREIGN KEY ("scoringRunId") REFERENCES "ScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
