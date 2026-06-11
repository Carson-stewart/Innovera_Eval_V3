/**
 * scripts/backfill-run26-p7-null.ts — Phase B1 authorized one-row backfill.
 *
 * Run 26's P7 row carries the old `?? -1` persistence sentinel (the engine
 * scored it NOT_SCORED = null under the sparse-data protocol: 0 financial
 * claims). With score/serverComputed now nullable, this restores the engine's
 * actual output: -1 → null on exactly that one row.
 *
 * Deliberately NOT touched: run 26's memoConfidence, stage1Avg, statusBadge —
 * historical readiness stays as scored (corrected value comes from the C0
 * replay, informationally).
 *
 * Idempotent: refuses to run unless the row still holds exactly -1/-1.
 * Usage: npx tsx scripts/backfill-run26-p7-null.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const row = await prisma.dimensionScore.findFirst({
    where: { scoringRunId: 26, dimensionKey: "P7" },
  });
  if (!row) throw new Error("Run 26 P7 row not found — aborting.");

  console.log("BEFORE:", JSON.stringify({
    id: row.id, scoringRunId: row.scoringRunId, dimensionKey: row.dimensionKey,
    score: row.score, serverComputed: row.serverComputed,
    agentSelfReported: row.agentSelfReported, calibrationDrift: row.calibrationDrift,
  }));

  if (row.score !== -1 || row.serverComputed !== -1) {
    console.log("Row does not hold the -1 sentinel (already backfilled?) — nothing to do.");
    await prisma.$disconnect();
    return;
  }

  const updated = await prisma.dimensionScore.update({
    where: { id: row.id },
    data: { score: null, serverComputed: null },
  });

  console.log("AFTER: ", JSON.stringify({
    id: updated.id, scoringRunId: updated.scoringRunId, dimensionKey: updated.dimensionKey,
    score: updated.score, serverComputed: updated.serverComputed,
    agentSelfReported: updated.agentSelfReported, calibrationDrift: updated.calibrationDrift,
  }));
  console.log("Backfill complete — exactly one row changed.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
