/**
 * scripts/noise-floor.ts — Step 4 measurement.
 * Compares each measurement run against the stored in-set run for the same memo.
 * Read-only. Reports SRI spread, claimCount spread, and per-dimension deltas.
 *
 * Creating new measurement runs (the re-scores this script compares): POST
 * /api/score with `allowEmptyRisks: true` — since the A4 guard, an empty
 * approvedRisks array without that flag is rejected with a 400. Flagged runs
 * are stamped dataNote = "risk gate bypassed" at creation (self-labeling).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as ConstructorParameters<typeof PrismaClient>[0]);

// [label, storedSrId, newSrId]
const PAIRS: Array<[string, number, number]> = [
  ["memo24 ecolab1.docx", 43, 44],
  ["memo23 ecolab2.docx", 42, 45],
  ["memo12 Visiomex.md", 30, 46],
];

async function load(srId: number) {
  const run = await prisma.scoringRun.findUnique({
    where: { id: srId },
    select: {
      id: true, stage1Avg: true, stage2Avg: true, memoConfidence: true,
      redundancyAnalysis: { select: { sri: true, claimCount: true, uniqueClusterCount: true } },
      dimensionScores: { select: { dimensionKey: true, score: true } },
    },
  });
  const dims = new Map<string, number>();
  // null = NOT_SCORED (nullable since Phase B1) — leave unset so it prints as "n/a"
  for (const d of run!.dimensionScores) {
    if (d.score !== null) dims.set(d.dimensionKey, d.score);
  }
  return { run: run!, dims };
}

const DIM_ORDER = ["P1","P2","P3","P4","P5","P6","P7","P8","D1","D2","D3","D4","D5"];

async function main() {
  let maxDimDelta = 0;
  const sriDeltas: number[] = [];
  for (const [label, storedId, newId] of PAIRS) {
    const a = await load(storedId);
    const b = await load(newId);
    const sriA = a.run.redundancyAnalysis?.sri ?? NaN;
    const sriB = b.run.redundancyAnalysis?.sri ?? NaN;
    const dSri = sriB - sriA;
    sriDeltas.push(Math.abs(dSri));
    console.log(`\n=== ${label}  (stored srId ${storedId} -> new srId ${newId}) ===`);
    console.log(`  SRI:        ${sriA}  ->  ${sriB}   Δ=${dSri >= 0 ? "+" : ""}${dSri.toFixed(3)}`);
    console.log(`  claimCount: ${a.run.redundancyAnalysis?.claimCount} -> ${b.run.redundancyAnalysis?.claimCount}   uniq: ${a.run.redundancyAnalysis?.uniqueClusterCount} -> ${b.run.redundancyAnalysis?.uniqueClusterCount}`);
    console.log(`  stage1Avg:  ${a.run.stage1Avg.toFixed(3)} -> ${b.run.stage1Avg.toFixed(3)}   Δ=${(b.run.stage1Avg - a.run.stage1Avg).toFixed(3)}`);
    console.log(`  stage2Avg:  ${a.run.stage2Avg.toFixed(3)} -> ${b.run.stage2Avg.toFixed(3)}   Δ=${(b.run.stage2Avg - a.run.stage2Avg).toFixed(3)}`);
    console.log(`  dimension deltas:`);
    let rowMax = 0;
    const parts: string[] = [];
    for (const k of DIM_ORDER) {
      const va = a.dims.get(k); const vb = b.dims.get(k);
      if (va === undefined || vb === undefined) { parts.push(`${k}:n/a`); continue; }
      const d = vb - va;
      if (Math.abs(d) > rowMax) rowMax = Math.abs(d);
      if (Math.abs(d) > maxDimDelta) maxDimDelta = Math.abs(d);
      parts.push(`${k}:${va.toFixed(2)}->${vb.toFixed(2)}(${d >= 0 ? "+" : ""}${d.toFixed(2)})`);
    }
    console.log("    " + parts.join("  "));
    console.log(`  max |dimension Δ| this memo: ${rowMax.toFixed(3)}`);
  }
  console.log("\n──────── NOISE FLOOR SUMMARY ────────");
  console.log(`  |SRI Δ|: ${sriDeltas.map((d) => d.toFixed(3)).join(", ")}  (max ${Math.max(...sriDeltas).toFixed(3)})`);
  console.log(`  max |dimension Δ| across all pairs: ${maxDimDelta.toFixed(3)}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
