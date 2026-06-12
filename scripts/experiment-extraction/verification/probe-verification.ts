/**
 * Phase 2 verification — READ-ONLY DB probe. No writes of any kind.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../lib/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  // ── Item 1: badge re-derivation for runs 23,24,25,26,27,41 ──
  console.log("=== ITEM 1: badge inputs ===");
  for (const id of [23, 24, 25, 26, 27, 41]) {
    const r = await prisma.scoringRun.findUnique({
      where: { id },
      include: {
        memo: { select: { name: true } },
        dimensionScores: { select: { dimensionKey: true, serverComputed: true, score: true } },
        gaps: { select: { dimensionKey: true, severity: true, issue: true } },
      },
    });
    if (!r) { console.log(`run ${id}: NOT FOUND`); continue; }
    const s1 = r.dimensionScores.filter(d => d.dimensionKey.startsWith("P"));
    console.log(JSON.stringify({
      runId: id, memo: r.memo.name, scoredAt: r.scoredAt.toISOString(),
      memoConfidence: r.memoConfidence, storedBadge: r.statusBadge,
      stage1: Object.fromEntries(s1.map(d => [d.dimensionKey, d.serverComputed])),
      gaps: r.gaps.map(g => `${g.dimensionKey}:${g.severity}`),
      gapIssues: r.gaps.map(g => `${g.dimensionKey}[${g.severity}] ${g.issue.slice(0, 90)}`),
    }, null, 1));
  }

  // ── Item 3: risk storage shape for runs 44,53,56 vs control 43; plus all June-10 runs ──
  console.log("\n=== ITEM 3: risk rows ===");
  for (const id of [43, 44, 53, 56]) {
    const r = await prisma.scoringRun.findUnique({
      where: { id },
      include: { memo: { select: { name: true } }, confirmedRisks: true },
    });
    if (!r) { console.log(`run ${id}: NOT FOUND`); continue; }
    console.log(JSON.stringify({
      runId: id, memo: r.memo.name, scoredAt: r.scoredAt.toISOString(),
      framingId: r.framingId, includeInAnalysis: r.includeInAnalysis, dataNote: r.dataNote,
      confirmedRiskRowCount: r.confirmedRisks.length,
      risks: r.confirmedRisks.map(k => ({ sev: k.severity, approved: k.approved, src: k.source, stmt: k.statement.slice(0, 60) })),
    }, null, 1));
  }
  const june10 = await prisma.scoringRun.findMany({
    where: { id: { in: [44, 45, 46, 52, 53, 54, 55, 56, 57] } },
    include: { memo: { select: { name: true } }, confirmedRisks: { select: { id: true } } },
    orderBy: { id: "asc" },
  });
  console.log("\nJune-10 window summary:");
  for (const r of june10) {
    console.log(`  run ${r.id}  ${r.scoredAt.toISOString()}  riskRows=${r.confirmedRisks.length}  framingId=${r.framingId}  scoringModel=${r.scoringModel}  note=${JSON.stringify(r.dataNote)}`);
  }
  // diagnostics on those runs
  const diags = await prisma.diagnostic.findMany({ where: { scoringRunId: { in: [43,44,45,46,52,53,54,55,56,57] } } });
  console.log("Diagnostics on 43-57:", JSON.stringify(diags.map(d => ({ run: d.scoringRunId, type: d.type, msg: d.message.slice(0,100) }))));

  // ── Item 4: run 26 P7 detail ──
  console.log("\n=== ITEM 4: run 26 P7 ===");
  const ds = await prisma.dimensionScore.findFirst({
    where: { scoringRunId: 26, dimensionKey: "P7" },
  });
  console.log(JSON.stringify({
    score: ds?.score, serverComputed: ds?.serverComputed, agentSelfReported: ds?.agentSelfReported,
    calibrationDrift: ds?.calibrationDrift,
    subScores: ds?.subScores, traceabilityLog: ds?.traceabilityLog,
  }, null, 1));
  const run26 = await prisma.scoringRun.findUnique({ where: { id: 26 }, include: { memo: { select: { name: true } }, diagnostics: true } });
  console.log(JSON.stringify({ memo: run26?.memo.name, scoredAt: run26?.scoredAt.toISOString(), memoConfidence: run26?.memoConfidence, stage1Avg: run26?.stage1Avg, badge: run26?.statusBadge, dataNote: run26?.dataNote, diagnostics: run26?.diagnostics.map(d => `${d.type}: ${d.message.slice(0,150)}`) }, null, 1));

  // ── Item 4: out-of-range scan across all runs/dimensions ──
  console.log("\n=== ITEM 4: out-of-range scan (score or serverComputed outside [1,5]) ===");
  const all = await prisma.dimensionScore.findMany({
    select: { scoringRunId: true, dimensionKey: true, score: true, serverComputed: true, agentSelfReported: true },
  });
  const oor = all.filter(d =>
    (d.score !== null && (d.score < 1 || d.score > 5)) ||
    (d.serverComputed !== null && (d.serverComputed < 1 || d.serverComputed > 5))
  );
  console.log(`total dimensionScore rows: ${all.length}; out-of-range: ${oor.length}`);
  for (const d of oor) console.log("  " + JSON.stringify(d));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
