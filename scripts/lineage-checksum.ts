/**
 * Row-integrity checksum for the framing-lineage schema change (T2).
 * Hashes every existing Framing, SanityCheck and ScoringRun row over the
 * columns that existed BEFORE the change, so a before/after comparison
 * proves the additive migration touched nothing.
 *
 *   npx tsx scripts/lineage-checksum.ts [--exclude-framings 60,61]
 *
 * --exclude-framings: skip rows created AFTER the baseline snapshot (new
 * revision rows), so the remaining hash is comparable to the baseline.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "../lib/db";

async function main() {
  const exIdx = process.argv.indexOf("--exclude-framings");
  const excluded =
    exIdx >= 0 ? process.argv[exIdx + 1].split(",").map((s) => parseInt(s, 10)) : [];

  const framings = await prisma.framing.findMany({
    where: excluded.length ? { id: { notIn: excluded } } : undefined,
    orderBy: { id: "asc" },
    select: { id: true, name: true, sourceType: true, content: true, typology: true, createdAt: true },
  });
  const checks = await prisma.sanityCheck.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, framingId: true, verdict: true, passCount: true, failCount: true,
      enhanceCount: true, triageMatrix: true, revisedFraming: true, typology: true,
      typologyConfidence: true, createdAt: true, checkerVersion: true,
      gateVerdict: true, anchorInventory: true,
    },
  });
  const runs = await prisma.scoringRun.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, memoId: true, rubricVersion: true, memoConfidence: true,
      decisionConfidence: true, statusBadge: true, stage1Avg: true, stage2Avg: true,
      scoredAt: true, framingId: true, includeInAnalysis: true, dataNote: true,
    },
  });

  const hash = (label: string, rows: unknown[]) => {
    const h = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    console.log(`${label}: ${rows.length} rows  sha256=${h}`);
  };
  hash("Framing    ", framings);
  hash("SanityCheck", checks);
  hash("ScoringRun ", runs);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
