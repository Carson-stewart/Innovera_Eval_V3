/**
 * READ-ONLY audit of twin runs #67, #68, #69 (docs/phase-e/RUN-AUDIT-67-68-69.md).
 * Prisma reads only — no writes, no cache stores, no re-fires.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { prisma } from "../../lib/db";
import { splitChapters } from "../../lib/ingest/splitChapters";
import { memoConfidence, statusBadge } from "../../lib/confidence/index";
import { computeP1CacheKey } from "../../lib/scoring/p1Cache";
import { RUBRIC_VERSION } from "../../lib/scoring/version";

const RUN_IDS = [67, 68, 69];
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const STAGE1 = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
const STAGE2 = ["D1", "D2", "D3", "D4", "D5"];

// Same normalization as scoreMemo.ts countScorableChapters (replicated read-only)
const SCORABLE_SET = [
  "customer and demand validation", "product and technology", "market research",
  "competitor analysis", "gtm and partners", "revenue model", "unit economics",
  "finance and operations", "team and execution", "legal and ip",
];
const norm = (t: string) =>
  t.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const countScorable = (titles: string[]) =>
  SCORABLE_SET.filter((target) => titles.map(norm).some((t) => t.includes(target))).length;

async function main() {
  for (const id of RUN_IDS) {
    const run = await prisma.scoringRun.findUnique({
      where: { id },
      include: {
        memo: { select: { id: true, name: true, content: true, typology: true, createdAt: true } },
        framing: {
          select: {
            id: true, name: true, parentFramingId: true, revisionNumber: true,
            revisionSource: true, content: true, createdAt: true,
            parent: { select: { id: true, name: true } },
          },
        },
        dimensionScores: { orderBy: { id: "asc" } },
        confirmedRisks: true,
        gaps: true,
        edits: true,
        diagnostics: true,
        redundancyAnalysis: true,
      },
    });
    if (!run) { console.log(`run ${id}: NOT FOUND`); continue; }

    console.log(`\n${"=".repeat(70)}\nRUN #${id}`);
    console.log(`memo: #${run.memo.id} ${run.memo.name} (uploaded ${run.memo.createdAt.toISOString()})`);
    console.log(`memo content: ${run.memo.content?.length ?? 0} chars, sha256=${sha(run.memo.content ?? "").slice(0, 16)}`);
    console.log(
      `framing: #${run.framing?.id} ${run.framing?.name} | rev=${run.framing?.revisionNumber ?? "ROOT"} ` +
      `parent=${run.framing?.parentFramingId ?? "-"} (${run.framing?.parent?.name ?? "n/a"}) src=${run.framing?.revisionSource ?? "-"}`
    );
    console.log(`framing content: ${run.framing?.content.length} chars, sha256=${sha(run.framing?.content ?? "").slice(0, 16)}`);
    console.log(
      `rubric=${run.rubricVersion} model=${run.scoringModel} redundancyVersion=${run.redundancyVersion} scoredAt=${run.scoredAt.toISOString()}`
    );
    console.log(
      `stored: memoConfidence=${run.memoConfidence} decisionConfidence=${run.decisionConfidence} badge=${run.statusBadge} ` +
      `stage1Avg=${run.stage1Avg} stage2Avg=${run.stage2Avg} scoredPillarCount=${run.scoredPillarCount} ` +
      `scorableChapterCount=${run.scorableChapterCount} verificationGroupId=${run.verificationGroupId} dataNote=${JSON.stringify(run.dataNote)}`
    );

    // ── dimensions ──
    const dims = new Map(run.dimensionScores.map((d) => [String(d.dimensionKey), d]));
    const s1 = STAGE1.map((k) => dims.get(k)?.serverComputed ?? null);
    const s2 = STAGE2.map((k) => dims.get(k)?.serverComputed ?? null);
    console.log(`dimension rows: ${run.dimensionScores.length}`);
    for (const k of [...STAGE1, ...STAGE2]) {
      const d = dims.get(k);
      if (!d) { console.log(`  ${k}: MISSING ROW`); continue; }
      const sub = (d.subScores ?? {}) as Record<string, unknown>;
      const extra =
        k === "P1"
          ? ` majors=${sub.majorReconciliations} minors=${sub.minorIssues ?? sub.minorReconciliations} ` +
            `cache=${(d.traceabilityLog as Record<string, unknown>)?.p1_findings_cache} ` +
            `cacheKey=${(d.traceabilityLog as Record<string, unknown>)?.p1_findings_cache_key}`
          : "";
      console.log(
        `  ${k}: server=${d.serverComputed} score=${d.score} agent=${d.agentSelfReported} drift=${d.calibrationDrift}${extra}`
      );
    }

    // ── B: recompute ──
    const recomputedConf = memoConfidence(s1);
    const scoredS1 = s1.filter((x): x is number => x !== null);
    const recomputedStage1Avg = scoredS1.reduce((a, b) => a + b, 0) / scoredS1.length;
    const scoredS2 = s2.filter((x): x is number => x !== null);
    const recomputedStage2Avg = scoredS2.length ? scoredS2.reduce((a, b) => a + b, 0) / scoredS2.length : 0;
    const badge = statusBadge(recomputedConf, run.gaps.map((g) => ({ severity: String(g.severity) })), s2);
    console.log(
      `RECOMPUTED: readiness=${recomputedConf.toFixed(4)} (stored ${run.memoConfidence}) ` +
      `stage1Avg=${recomputedStage1Avg.toFixed(4)} (stored ${run.stage1Avg}) ` +
      `stage2Avg=${recomputedStage2Avg.toFixed(4)} (stored ${run.stage2Avg}) ` +
      `badge=${badge} (stored ${run.statusBadge})`
    );
    const p1majors = ((dims.get("P1")?.subScores ?? {}) as Record<string, unknown>).majorReconciliations;
    console.log(
      `badge inputs: HIGH gaps=${run.gaps.filter((g) => String(g.severity) === "HIGH").length} ` +
      `P1 majors=${p1majors} stage2<=2.0: ${s2.filter((x) => x !== null && x <= 2).length} pillars<=2.0: ${scoredS1.filter((x) => x <= 2).length}`
    );

    // ── chapters ──
    const chapters = splitChapters(run.memo.content ?? "");
    const scoredCh = chapters.filter((c) => c.scored);
    console.log(
      `parse: ${chapters.length} chapters (${scoredCh.length} scored), countScorable=${countScorable(chapters.map((c) => c.title))} ` +
      `(stored scorableChapterCount=${run.scorableChapterCount})`
    );
    console.log(`chapter titles: ${chapters.map((c) => c.title + (c.scored ? "" : "*")).join(" | ")}`);

    // ── A: artifacts ──
    console.log(
      `gaps=${run.gaps.length} [${run.gaps.map((g) => `${g.dimensionKey}:${g.severity}`).join(", ")}]`
    );
    console.log(
      `edits=${run.edits.length} [${run.edits.map((e) => `${e.dimensionKey}:${e.severity}`).join(", ")}]`
    );
    console.log(
      `risks=${run.confirmedRisks.length} approved=${run.confirmedRisks.filter((r) => r.approved).length} ` +
      `critical=${run.confirmedRisks.filter((r) => String(r.severity) === "CRITICAL").length} ` +
      `addressed-statuses=[${run.confirmedRisks.map((r) => r.addressedStatus ?? "-").join(",")}]`
    );
    console.log(`diagnostics=${run.diagnostics.length} [${run.diagnostics.map((d) => `${d.type}: ${d.message.slice(0, 80)}`).join(" | ")}]`);
    const ra = run.redundancyAnalysis;
    console.log(
      ra
        ? `redundancy: status=${ra.analysisStatus} sri=${ra.sri} claims=${ra.claimCount} clusters=${ra.uniqueClusterCount} ` +
          `threshold=${ra.threshold} favoriteFriends=${Array.isArray(ra.favoriteFriends) ? (ra.favoriteFriends as unknown[]).length : "?"} err=${ra.errorMessage ?? "-"}`
        : "redundancy: ROW MISSING"
    );

    // ── C: P1 cache key recomputation ──
    if (run.framing && run.memo.content) {
      const key = computeP1CacheKey(RUBRIC_VERSION, run.framing.content, run.memo.content);
      const cacheRow = await prisma.p1FindingsCache.findUnique({ where: { contentHash: key } });
      console.log(
        `p1 cache key (recomputed) = ${key.slice(0, 16)}… | row exists: ${!!cacheRow}` +
        (cacheRow ? ` (created ${cacheRow.createdAt.toISOString()}, rubric ${cacheRow.rubricVersion})` : "")
      );
    }
  }

  // ── C: cross-run comparisons (67 vs 68) ──
  console.log(`\n${"=".repeat(70)}\nCROSS-RUN 67 vs 68`);
  const [a, b] = await Promise.all(
    [67, 68].map((id) =>
      prisma.scoringRun.findUnique({
        where: { id },
        include: {
          memo: { select: { id: true, content: true } },
          framing: { select: { id: true, content: true } },
          dimensionScores: true,
        },
      })
    )
  );
  if (a && b) {
    console.log(`memoId: ${a.memo.id} vs ${b.memo.id} | same row: ${a.memo.id === b.memo.id}`);
    console.log(
      `memo content hash: ${sha(a.memo.content ?? "").slice(0, 16)} vs ${sha(b.memo.content ?? "").slice(0, 16)} | identical: ${(a.memo.content ?? "") === (b.memo.content ?? "")}`
    );
    console.log(
      `framingId: ${a.framing?.id} vs ${b.framing?.id} | framing content identical: ${(a.framing?.content ?? "") === (b.framing?.content ?? "x")}`
    );
    const da = new Map(a.dimensionScores.map((d) => [String(d.dimensionKey), d]));
    const db = new Map(b.dimensionScores.map((d) => [String(d.dimensionKey), d]));
    console.log("dim | #67 | #68 | delta | readiness contribution (Δ×2.5, stage1)");
    let s1ContribTotal = 0;
    for (const k of [...STAGE1, ...STAGE2]) {
      const va = da.get(k)?.serverComputed ?? null;
      const vb = db.get(k)?.serverComputed ?? null;
      const delta = va !== null && vb !== null ? va - vb : null;
      const contrib = delta !== null && STAGE1.includes(k) ? delta * 2.5 : null;
      if (contrib !== null) s1ContribTotal += contrib;
      console.log(
        `  ${k}: ${va} | ${vb} | ${delta?.toFixed(2) ?? "-"} | ${contrib?.toFixed(2) ?? "-"}`
      );
    }
    console.log(`stage-1 readiness contribution total (67 minus 68): ${s1ContribTotal.toFixed(2)}`);

    // P1 findings comparison
    const p1a = da.get("P1"); const p1b = db.get("P1");
    console.log(
      `P1 findings json identical: ${JSON.stringify(p1a?.findings) === JSON.stringify(p1b?.findings)} | ` +
      `subScores identical: ${JSON.stringify(p1a?.subScores) === JSON.stringify(p1b?.subScores)}`
    );
  }

  // all cache rows (for key-bug check)
  const cacheRows = await prisma.p1FindingsCache.findMany({
    select: { id: true, contentHash: true, rubricVersion: true, createdAt: true },
    orderBy: { id: "asc" },
  });
  console.log(`\nP1FindingsCache rows: ${cacheRows.length}`);
  for (const r of cacheRows.slice(-8)) {
    console.log(`  ${r.id}: ${r.contentHash.slice(0, 16)}… ${r.rubricVersion} ${r.createdAt.toISOString()}`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
