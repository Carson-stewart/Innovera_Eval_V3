/**
 * D2a replay check (READ-ONLY): does an explicit "majorReconciliations >= 2 →
 * HIGH gap regardless of CI" trigger change any badge across the 43-run corpus
 * under v1.1 values? Ships only if the answer is zero.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import { computeP1 } from "../../lib/scoring/stage1/p1";
import { memoConfidence, statusBadge } from "../../lib/confidence/index";
import type { Tier2SynthesisOutput, ReconciliationEntry } from "../../lib/prompts/types";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as ConstructorParameters<typeof PrismaClient>[0]);
const STAGE1 = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
const STAGE2 = ["D1", "D2", "D3", "D4", "D5"];

function recon(n: number): ReconciliationEntry[] {
  return Array.from({ length: n }, (_, i) => ({ quoteA: `a${i}`, quoteB: `b${i}`, description: `d${i}`, locations: ["x"] }));
}

async function main() {
  const runs = await prisma.scoringRun.findMany({
    orderBy: { id: "asc" },
    include: { dimensionScores: true, gaps: { select: { dimensionKey: true } } },
  });
  let flips = 0;
  const f2runs: string[] = [];
  for (const run of runs) {
    const ds = new Map(run.dimensionScores.map((d) => [d.dimensionKey as string, d]));
    const sub = (ds.get("P1")?.subScores ?? {}) as Record<string, number>;
    const majors = sub.majorReconciliations ?? 0;
    const tier2 = {
      p1_cross_chapter_contradictions: Array.from({ length: sub.flatContradictions ?? 0 }, (_, i) => ({ quoteA: `f${i}`, quoteB: `g${i}`, location: "x" })),
      p1_cross_chapter_reconciliation_failures: recon(majors),
      p1_cross_chapter_minor_gaps: Array.from({ length: sub.minorGaps ?? 0 }, (_, i) => `m${i}`),
      p1_cross_chapter_definitional_drifts: Array.from({ length: sub.definitionalDrifts ?? 0 }, (_, i) => `d${i}`),
      p1_cross_chapter_reasoning_gaps: Array.from({ length: sub.reasoningGaps ?? 0 }, (_, i) => ({ quote: `q${i}`, description: `r${i}` })),
      p1_tension_acknowledged: (sub.bonus ?? 0) > 0 ? "ack" : null,
    } as unknown as Tier2SynthesisOutput;
    const newCI = computeP1({ tier1Chapters: [], tier2, agentSelfReported: null }).serverComputed as number;

    const s1 = STAGE1.map((k) => (k === "P1" ? newCI : (ds.get(k)?.serverComputed ?? null)));
    const d2 = STAGE2.map((k) => ds.get(k)?.serverComputed ?? null);
    const readiness = memoConfidence(s1);
    const gapDims = new Set(run.gaps.map((g) => g.dimensionKey as string));
    // v1.1 HIGH-gap rule WITHOUT the explicit trigger: pillar <= 2.0 with a gap
    const highWithout = STAGE1.some((k, i) => s1[i] !== null && (s1[i] as number) <= 2.0 && gapDims.has(k));
    // WITH the explicit trigger: additionally, majors >= 2 forces a P1 HIGH gap
    const highWith = highWithout || majors >= 2;
    const badgeWithout = statusBadge(readiness, highWithout ? [{ severity: "HIGH" }] : [], d2);
    const badgeWith = statusBadge(readiness, highWith ? [{ severity: "HIGH" }] : [], d2);
    if (majors >= 2) f2runs.push(`run ${run.id}: majors=${majors}, newCI=${newCI} ${newCI <= 2.0 ? "(already <= 2.0)" : "(!! CI ABOVE 2.0 !!)"}`);
    if (badgeWith !== badgeWithout) { flips++; console.log(`FLIP: run ${run.id} ${badgeWithout} -> ${badgeWith}`); }
  }
  console.log(`Runs with majors >= 2: ${f2runs.length}; all with v1.1 CI <= 2.0: ${f2runs.every((s) => s.includes("already"))}`);
  console.log(`Badge changes from the explicit trigger: ${flips}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
