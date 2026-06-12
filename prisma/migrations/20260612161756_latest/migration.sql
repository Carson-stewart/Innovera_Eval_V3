-- AlterTable
ALTER TABLE "DimensionScore" ADD COLUMN     "findings" JSONB,
ALTER COLUMN "score" DROP NOT NULL,
ALTER COLUMN "serverComputed" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Framing" ADD COLUMN     "parentFramingId" INTEGER,
ADD COLUMN     "revisionNumber" INTEGER,
ADD COLUMN     "revisionSource" TEXT,
ADD COLUMN     "sourceCheckId" INTEGER;

-- AlterTable
ALTER TABLE "SanityCheck" ADD COLUMN     "anchorInventory" JSONB,
ADD COLUMN     "checkerVersion" TEXT,
ADD COLUMN     "gateVerdict" TEXT;

-- AlterTable
ALTER TABLE "ScoringRun" ADD COLUMN     "scorableChapterCount" INTEGER,
ADD COLUMN     "scoredPillarCount" INTEGER,
ADD COLUMN     "verificationGroupId" INTEGER;

-- CreateTable
CREATE TABLE "P1FindingsCache" (
    "id" SERIAL NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "P1FindingsCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "P1FindingsCache_contentHash_key" ON "P1FindingsCache"("contentHash");

-- AddForeignKey
ALTER TABLE "Framing" ADD CONSTRAINT "Framing_parentFramingId_fkey" FOREIGN KEY ("parentFramingId") REFERENCES "Framing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
