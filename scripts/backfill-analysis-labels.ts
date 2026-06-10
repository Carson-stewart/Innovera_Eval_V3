/**
 * scripts/backfill-analysis-labels.ts
 *
 * Step 3: mark the clean analysis set WITHOUT deletes. Backfills the additive
 * nullable ScoringRun fields includeInAnalysis, dataNote, and redundancyVersion
 * on existing rows. Touches ONLY these three metadata columns — never a score,
 * never a redundancy value, never a row deletion.
 *
 * Version boundaries are grounded in the stored per-run `threshold` field and
 * the claim-set reconciliation diagnostic (git history is squashed into one
 * 2026-06-02 baseline commit and cannot date the boundaries).
 *
 * Run:  npx tsx scripts/backfill-analysis-labels.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { REDUNDANCY_VERSION } from "../lib/redundancy/version";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as ConstructorParameters<typeof PrismaClient>[0]);

// Buggy pre-clustering-drop runs (unaccounted > 0 in the reconciliation diagnostic).
const BUGGY_RA_IDS = [7, 10, 11];
// Legacy 0.85-threshold batch.
const LEGACY_RA_IDS = [1, 2, 3, 4, 6];

async function main() {
  const runs = await prisma.scoringRun.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, memoId: true, scoredAt: true, scoringModel: true,
      memo: { select: { name: true } },
      redundancyAnalysis: { select: { id: true, sri: true, threshold: true } },
    },
  });

  type Plan = { srId: number; include: boolean; version: string | null; note: string | null; label: string };
  const plans: Plan[] = [];

  for (const r of runs) {
    const ra = r.redundancyAnalysis;
    const raId = ra?.id ?? null;
    const isDocx = /\.docx/i.test(r.memo.name);

    // Step-2 / step-4 measurement runs: the ones carrying a pinned scoringModel
    // (they were scored AFTER the pin). Keep, but exclude from analysis.
    if (r.scoringModel) {
      plans.push({
        srId: r.id, include: false, version: REDUNDANCY_VERSION,
        note: "Measurement run (post-model-pin) for noise-floor measurement; not part of the analysis set.",
        label: "MEASUREMENT",
      });
      continue;
    }

    if (raId !== null && BUGGY_RA_IDS.includes(raId)) {
      plans.push({
        srId: r.id, include: false, version: "0.70-preclusterdrop",
        note: `Pre-clustering embedding-drop bug (raId ${raId}): claimCount exceeded the clustered set (unaccounted > 0); SRI unreliable. Dimension scores remain valid (engine frozen).`,
        label: "BUGGY",
      });
      continue;
    }

    if (raId !== null && LEGACY_RA_IDS.includes(raId)) {
      plans.push({
        srId: r.id, include: false, version: "0.85-legacy",
        note: `Legacy cosine threshold 0.85 (raId ${raId}); under-clustered, SRI not comparable to 0.70 runs. Dimension scores remain valid (engine frozen).`,
        label: "LEGACY-0.85",
      });
      continue;
    }

    if (raId === null) {
      // Oldest run, predates redundancy analysis entirely.
      plans.push({
        srId: r.id, include: true, version: null,
        note: "Predates redundancy analysis (no SRI/threshold). Dimension scores comparable on the frozen engine; excluded from SRI comparisons.",
        label: "INCLUDE (no-SRI)",
      });
      continue;
    }

    // Healthy 0.70 reconciled run.
    plans.push({
      srId: r.id, include: true, version: "0.70-reconciled",
      note: isDocx
        ? "Included. docx memo: redundancy not directly comparable across the convertToHtml parser change (undatable from git; conservative boundary = 2026-06-02 vs 2026-06-08 docx runs)."
        : null,
      label: "INCLUDE",
    });
  }

  // Apply.
  for (const p of plans) {
    await prisma.scoringRun.update({
      where: { id: p.srId },
      data: { includeInAnalysis: p.include, dataNote: p.note, redundancyVersion: p.version },
    });
  }

  // Report.
  const included = plans.filter((p) => p.include);
  const excluded = plans.filter((p) => !p.include);
  console.log(`Applied labels to ${plans.length} runs.`);
  console.log(`INCLUDED: ${included.length}   EXCLUDED: ${excluded.length}\n`);
  console.log("srId  include  version              label             memo");
  for (const r of runs) {
    const p = plans.find((x) => x.srId === r.id)!;
    console.log(
      String(r.id).padEnd(5),
      (p.include ? "yes" : "no").padEnd(8),
      String(p.version ?? "(none)").padEnd(20),
      p.label.padEnd(17),
      r.memo.name.slice(0, 28),
    );
  }

  // Invariants.
  const includedRuns = await prisma.scoringRun.findMany({
    where: { includeInAnalysis: true }, select: { id: true, memoId: true },
  });
  const memoCounts = new Map<number, number[]>();
  for (const r of includedRuns) memoCounts.set(r.memoId, [...(memoCounts.get(r.memoId) ?? []), r.id]);
  const dupes = Array.from(memoCounts.entries()).filter(([, ids]) => ids.length > 1);
  console.log(`\nIncluded set: ${includedRuns.length} runs across ${memoCounts.size} memos.`);
  console.log("Duplicate memoIds within INCLUDED set:", dupes.length === 0 ? "NONE ✓" : JSON.stringify(dupes));

  // Confirm kept-run identities for the two duplicated memos.
  for (const mid of [4, 11]) {
    const ids = memoCounts.get(mid) ?? [];
    const ra = await prisma.redundancyAnalysis.findMany({ where: { scoringRunId: { in: ids } }, select: { id: true } });
    console.log(`memo ${mid}: included run srId=${ids.join(",")} (raId ${ra.map((x) => x.id).join(",")})`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error("ERR", e); process.exit(1); });
