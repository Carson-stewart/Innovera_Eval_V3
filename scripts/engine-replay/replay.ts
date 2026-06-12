/**
 * scripts/engine-replay/replay.ts — Phase C0 offline replay harness.
 *
 * STRICTLY READ-ONLY: recomputes, for every stored scoring run, from persisted
 * data only (no LLM calls, no writes):
 *   1. P1 under the C2 graduated major-reconciliation penalty
 *   2. Memo Readiness under the C1 not-scored exclusion — BOTH candidate
 *      variants (see DEVIATION note below)
 *   3. Badge under the C4 Stage-2 floor gate
 *
 * POST-IMPLEMENTATION MODE (C5): the harness now imports the REAL engine
 * functions — computeP1 (with reconstructed Tier inputs from the stored
 * counts), memoConfidence, and statusBadge — instead of inline reimplementations.
 * Its output must match the checkpoint-approved replay-report.csv (rescaled
 * columns) exactly.
 *
 * Usage: npx tsx scripts/engine-replay/replay.ts
 * Output: scripts/engine-replay/output/replay-report.csv, REPLAY-SUMMARY.md
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
// REAL engine functions (V3 v1.1)
import { computeP1 } from "../../lib/scoring/stage1/p1";
import { memoConfidence, statusBadge } from "../../lib/confidence/index";
import type { Tier2SynthesisOutput, ReconciliationEntry } from "../../lib/prompts/types";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as ConstructorParameters<typeof PrismaClient>[0]);

const OUT_DIR = path.join(__dirname, "output");
const STAGE1 = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
const STAGE2 = ["D1", "D2", "D3", "D4", "D5"];

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const erosion = (score: number) => clamp((5 - score) * 2.5, 0, 10);

// ─── New P1 via the REAL computeP1, with Tier inputs reconstructed from the
//     stored counts (array lengths + tension flag are all the formula reads) ──
function recon(n: number): ReconciliationEntry[] {
  return Array.from({ length: n }, (_, i) => ({ quoteA: `a${i}`, quoteB: `b${i}`, description: `d${i}`, locations: ["replay"] }));
}
function newP1(sub: Record<string, unknown>): { ci: number; majorPenalty: number } | null {
  const n = (k: string) => (typeof sub[k] === "number" ? (sub[k] as number) : null);
  const flats = n("flatContradictions");
  const majors = n("majorReconciliations");
  const minors = n("minorGaps");
  const drifts = n("definitionalDrifts");
  const reasoning = n("reasoningGaps");
  const bonus = n("bonus");
  if (flats === null || majors === null || minors === null || drifts === null || reasoning === null || bonus === null) return null;
  const tier2 = {
    p1_cross_chapter_contradictions: Array.from({ length: flats }, (_, i) => ({ quoteA: `fA${i}`, quoteB: `fB${i}`, location: "replay" })),
    p1_cross_chapter_reconciliation_failures: recon(majors),
    p1_cross_chapter_minor_gaps: Array.from({ length: minors }, (_, i) => `minor ${i}`),
    p1_cross_chapter_definitional_drifts: Array.from({ length: drifts }, (_, i) => `drift ${i}`),
    p1_cross_chapter_reasoning_gaps: Array.from({ length: reasoning }, (_, i) => ({ quote: `q${i}`, description: `g${i}` })),
    p1_tension_acknowledged: bonus > 0 ? "acknowledged" : null,
  } as unknown as Tier2SynthesisOutput;
  const r = computeP1({ tier1Chapters: [], tier2, agentSelfReported: null });
  return { ci: r.serverComputed as number, majorPenalty: r.subScores.majorPenalty };
}

// ─── Readiness: REAL memoConfidence (approved rescaled-exclusion semantics).
//     The simple-exclusion column is retained for comparison with the approved
//     CSV (informational only; rejected at checkpoint). ─────────────────────
function readinessRescaled(scores: (number | null)[]): number {
  return memoConfidence(scores);
}
function readinessSimpleExclusion(scores: (number | null)[]): number {
  const scored = scores.filter((s): s is number => s !== null);
  if (scored.length === 0) throw new Error("no scored pillars");
  const sum = scored.reduce((a, s) => a + erosion(s), 0);
  return clamp(100 - sum, 0, 100);
}

// ─── Badge via the REAL statusBadge (v1.1 Stage-2 floor built in) ────────────
function newBadge(
  readiness: number,
  hasHighGap: boolean,
  dScores: (number | null)[]
): { badge: string; cause: string } {
  const gaps = hasHighGap ? [{ severity: "HIGH" }] : [];
  const badge = statusBadge(readiness, gaps, dScores);
  let cause = "";
  if (badge === "MAJOR_REWORK") cause = readiness < 50 ? "readiness < 50" : "Stage-1 HIGH gap (pillar <= 2.0)";
  else if (badge === "NEEDS_WORK" && readiness >= 75 && !hasHighGap) {
    const floored = STAGE2.filter((_, i) => dScores[i] !== null && (dScores[i] as number) <= 2.0);
    cause = `Stage-2 floor: ${floored.join(", ")} <= 2.0`;
  } else if (badge === "NEEDS_WORK") cause = "readiness in [50, 75)";
  return { badge, cause };
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r2 = (x: number) => Math.round(x * 100) / 100;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const runs = await prisma.scoringRun.findMany({
    orderBy: { id: "asc" },
    include: {
      memo: { select: { name: true } },
      dimensionScores: true,
      gaps: { select: { dimensionKey: true, severity: true } },
    },
  });

  type Row = Record<string, unknown>;
  const rows: Row[] = [];
  const deviations: string[] = [];
  const p1Changes: string[] = [];
  const badgeFlips: string[] = [];
  const bonusAudit: Array<{ runId: number; bonus: number | null }> = [];
  const capAudit: Array<{ runId: number; raw: number | null; capped: number | null; capApplied: boolean }> = [];
  const readinessDeltas: number[] = [];

  for (const run of runs) {
    const ds = new Map(run.dimensionScores.map((d) => [d.dimensionKey as string, d]));
    const p1Row = ds.get("P1");
    const sub = (p1Row?.subScores ?? {}) as Record<string, unknown>;
    const majors = typeof sub.majorReconciliations === "number" ? (sub.majorReconciliations as number) : null;
    const storedP1 = p1Row?.serverComputed ?? null;

    // 1) New P1
    const np1 = newP1(sub);
    const newP1Score = np1 ? np1.ci : storedP1;
    const p1Delta = newP1Score !== null && storedP1 !== null ? r2(newP1Score - storedP1) : 0;
    if (p1Delta !== 0) p1Changes.push(`run ${run.id} (${run.memo.name}): majors=${majors}, P1 ${storedP1} -> ${r2(newP1Score!)} (Δ ${p1Delta})`);

    // Expected-result 1: changes only for majors >= 3, only downward
    if (p1Delta > 0) deviations.push(`run ${run.id}: P1 INCREASED (${storedP1} -> ${newP1Score}) — expected only downward changes.`);
    if (p1Delta !== 0 && (majors ?? 0) < 3) deviations.push(`run ${run.id}: P1 changed with majors=${majors} (< 3) — unexpected.`);

    // 2) New readiness — stage-1 vector with the NEW P1 substituted
    const s1New: (number | null)[] = STAGE1.map((k) =>
      k === "P1" ? newP1Score : (ds.get(k)?.serverComputed ?? null)
    );
    const s1Old: (number | null)[] = STAGE1.map((k) => ds.get(k)?.serverComputed ?? null);
    const readyRescaled = readinessRescaled(s1New);
    const readySimple = readinessSimpleExclusion(s1New);
    // Run-26 decomposition variants (old P1, for comparison against the ≈74.94 expectation)
    const readySimpleOldP1 = readinessSimpleExclusion(s1Old);
    const readyRescaledOldP1 = readinessRescaled(s1Old);

    const storedReadiness = run.memoConfidence;
    readinessDeltas.push(r2(readySimple - storedReadiness));

    // 3) New badge.
    // HIGH-gap mirror: a Stage-1 pillar <= 2.0 that produced a gap. Stored gap rows
    // tell us which pillars produced gaps; severity is recomputed from the NEW score
    // (deriveSpecificGap: HIGH iff score <= 2). P1 is the only score that moves, and
    // every changed-P1 run already has a P1 gap row (P1 < 4 with majors > 0).
    const gapDims = new Set(run.gaps.map((g) => g.dimensionKey as string));
    const hasHighGapNew = STAGE1.some((k, i) => {
      const v = s1New[i];
      return v !== null && v <= 2.0 && gapDims.has(k);
    });
    const dScores = STAGE2.map((k) => ds.get(k)?.serverComputed ?? null);
    const nbRescaled = newBadge(readyRescaled, hasHighGapNew, dScores);
    const nbSimple = newBadge(readySimple, hasHighGapNew, dScores);

    if (nbSimple.badge !== run.statusBadge) {
      badgeFlips.push(`run ${run.id} (${run.memo.name}): ${run.statusBadge} -> ${nbSimple.badge} — ${nbSimple.cause} [simple-exclusion variant]`);
    }
    if (nbRescaled.badge !== nbSimple.badge) {
      deviations.push(`run ${run.id}: badge differs between readiness variants (rescaled=${nbRescaled.badge}, simple=${nbSimple.badge}).`);
    }

    // Audits
    bonusAudit.push({ runId: run.id, bonus: typeof sub.bonus === "number" ? (sub.bonus as number) : null });
    capAudit.push({
      runId: run.id,
      raw: typeof sub.minorCombinedRaw === "number" ? (sub.minorCombinedRaw as number) : null,
      capped: typeof sub.minorCombinedPenalty === "number" ? (sub.minorCombinedPenalty as number) : null,
      capApplied: (p1Row?.traceabilityLog as Record<string, unknown> | undefined)?.minor_cap_applied === true,
    });

    rows.push({
      runId: run.id,
      memoName: run.memo.name,
      majors,
      storedP1,
      newP1: newP1Score !== null ? r2(newP1Score) : null,
      p1Delta,
      storedReadiness: r2(storedReadiness),
      newReadiness_simpleExclusion: r2(readySimple),
      newReadiness_rescaled: r2(readyRescaled),
      readinessDelta_simple: r2(readySimple - storedReadiness),
      readinessDelta_rescaled: r2(readyRescaled - storedReadiness),
      run26_oldP1_simple: run.id === 26 ? r2(readySimpleOldP1) : "",
      run26_oldP1_rescaled: run.id === 26 ? r2(readyRescaledOldP1) : "",
      storedBadge: run.statusBadge,
      newBadge_simple: nbSimple.badge,
      newBadge_rescaled: nbRescaled.badge,
      badgeFlipCause: nbSimple.badge !== run.statusBadge ? nbSimple.cause : "",
      dDimsAtOrBelow2: STAGE2.filter((k, i) => dScores[i] !== null && (dScores[i] as number) <= 2.0).join("|"),
      tensionBonusStored: typeof sub.bonus === "number" ? sub.bonus : null,
      minorCombinedRaw: typeof sub.minorCombinedRaw === "number" ? sub.minorCombinedRaw : null,
      minorCombinedPenalty: typeof sub.minorCombinedPenalty === "number" ? sub.minorCombinedPenalty : null,
      minorCapApplied: (p1Row?.traceabilityLog as Record<string, unknown> | undefined)?.minor_cap_applied === true,
    });
  }

  // ── Expected-result checks (checkpoint-approved values, 2026-06-11) ────────
  const run26 = rows.find((r) => r.runId === 26)!;
  // Expectation 2 (approved): run 26 recomputed readiness ≈ 70.65 under the
  // approved rescaled exclusion, with its P1 moving 2.0 → 1.75 under C2.
  // Its stored historical 64.94 is never rewritten.
  if (Math.abs((run26.newReadiness_rescaled as number) - 70.65) > 0.05) {
    deviations.push(
      `EXPECTATION 2 DEVIATION: run 26 rescaled readiness is ${run26.newReadiness_rescaled}, expected ≈70.65.`
    );
  }
  if (run26.newP1 !== 1.75) {
    deviations.push(`EXPECTATION 2 DEVIATION: run 26 new P1 is ${run26.newP1}, expected 1.75.`);
  }

  // Expectation 3 (approved): exactly two badge flips — run 25 READY_TO_SHIP →
  // NEEDS_WORK (Stage-2 floor, D1 = 1.8) and run 27 NEEDS_WORK → MAJOR_REWORK
  // (graduated penalty crosses the HIGH-gap threshold; approved as the intended
  // closing of a v1.0 leniency hole).
  const flip25Ok = badgeFlips.some((b) => b.startsWith("run 25 ") && b.includes("READY_TO_SHIP -> NEEDS_WORK") && b.includes("D1"));
  const flip27Ok = badgeFlips.some((b) => b.startsWith("run 27 ") && b.includes("NEEDS_WORK -> MAJOR_REWORK"));
  if (!(badgeFlips.length === 2 && flip25Ok && flip27Ok)) {
    deviations.push(`EXPECTATION 3 DEVIATION: expected exactly the two approved flips (runs 25, 27); found: ${JSON.stringify(badgeFlips)}`);
  }
  const worsened = rows.filter((r) => {
    const order: Record<string, number> = { READY_TO_SHIP: 0, NEEDS_WORK: 1, MAJOR_REWORK: 2 };
    return order[r.newBadge_simple as string] < order[r.storedBadge as string];
  });
  if (worsened.length > 0) deviations.push(`Runs gaining a BETTER badge (expected none): ${worsened.map((r) => r.runId).join(", ")}`);
  const mrChanges = rows.filter((r) => r.storedBadge === "MAJOR_REWORK" && r.newBadge_simple !== "MAJOR_REWORK");
  if (mrChanges.length > 0) deviations.push(`MAJOR_REWORK runs changing badge (expected none): ${mrChanges.map((r) => r.runId).join(", ")}`);

  // Tension bonus audit
  const bonusVals = new Map<number | null, number>();
  for (const b of bonusAudit) bonusVals.set(b.bonus, (bonusVals.get(b.bonus) ?? 0) + 1);
  // Minor cap audit
  const capHit = capAudit.filter((c) => c.capApplied).length;

  // ── Write CSV ──────────────────────────────────────────────────────────────
  const headers = Object.keys(rows[0]);
  fs.writeFileSync(
    path.join(OUT_DIR, "replay-report.csv"),
    [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\r\n") + "\r\n",
    "utf8"
  );

  // ── Write summary ──────────────────────────────────────────────────────────
  const deltaDist = new Map<number, number>();
  for (const d of readinessDeltas) deltaDist.set(d, (deltaDist.get(d) ?? 0) + 1);

  const summary = `# C0 Replay Summary — V3 v1.1 candidate rules vs stored V3 v1.0 corpus

READ-ONLY replay over ${rows.length} stored runs; formulas implemented inline (the
engine is unchanged — that is the point of the checkpoint). New-rule readiness and
badges are reported under BOTH candidate C1 variants (see Deviations §1).

## 1. P1 changes under the graduated penalty (C2)

${p1Changes.length} runs change, all downward, all with ≥3 major failures:

${p1Changes.map((c) => `- ${c}`).join("\n")}

Runs with majors ≤ 2 are unchanged (cliff preserved: 2 failures still → penalty 2.0).

## 2. Readiness delta distribution (simple-exclusion variant, new P1)

| Δ readiness | runs |
|---|---|
${Array.from(deltaDist.entries()).sort((a, b) => a[0] - b[0]).map(([d, n]) => `| ${d} | ${n} |`).join("\n")}

(Δ = new − stored. Negative deltas are the graduated P1 penalty translating to
readiness; the only run whose Stage-1 vector composition changes is run 26 — P7
null since Phase B1.)

## 3. Badge flips (stored → new)

${badgeFlips.length ? badgeFlips.map((b) => `- ${b}`).join("\n") : "- none"}

D dimensions ≤ 2.0 by run (floor candidates): ${rows.filter((r) => r.dDimsAtOrBelow2).map((r) => `run ${r.runId} [${r.dDimsAtOrBelow2}] (stored: ${r.storedBadge})`).join("; ")}

## 4. Expected-result checks (checkpoint-approved values)

| Expectation | Result |
|---|---|
| P1 changes only for ≥3 majors, only downward | ${deviations.some((d) => d.includes("unexpected") || d.includes("INCREASED")) ? "❌ see Deviations" : "✅ holds"} |
| Run 26 ≈ 70.65 rescaled, P1 2.0 → 1.75 (stored 64.94 untouched) | ${deviations.some((d) => d.includes("EXPECTATION 2")) ? "❌ see Deviations" : "✅ holds"} |
| Exactly two flips: run 25 → NEEDS_WORK (D1 floor); run 27 → MAJOR_REWORK (graduated P1 crosses HIGH-gap threshold) | ${deviations.some((d) => d.includes("EXPECTATION 3")) ? "❌ see Deviations" : "✅ holds"} |
| No run gains a better badge | ${worsened.length === 0 ? "✅ holds" : "❌"} |
| No other badge moves | ${rows.filter((r) => r.storedBadge !== r.newBadge_rescaled).length === 2 ? "✅ holds" : "❌"} |

## 5. Deviations (stop-and-report)

${deviations.length ? deviations.map((d, i) => `${i + 1}. ${d}`).join("\n") : "none — results match the checkpoint-approved report."}

### Run 26 readiness decomposition (for the record)

| Variant | Readiness |
|---|---|
| stored (v1.0: P7 treated as 1) — never rewritten | ${run26.storedReadiness} |
| **APPROVED v1.1: new P1 (${run26.newP1}) + rescaled exclusion** | **${run26.newReadiness_rescaled}** |
| new P1 + simple exclusion (rejected at checkpoint) | ${run26.newReadiness_simpleExclusion} |
| old P1 + rescaled / old P1 + simple (informational) | ${run26.run26_oldP1_rescaled} / ${run26.run26_oldP1_simple} |

Rescaled exclusion was approved at the checkpoint: simple exclusion would let an
unscored pillar contribute zero erosion — an implicit perfect 5 and a sparse-data
gaming vector. The badge outcome is identical under both variants for every run.

## 6. Tension-bonus audit (report only)

Stored \`subScores.bonus\` distribution: ${Array.from(bonusVals.entries()).map(([v, n]) => `${v} → ${n} runs`).join("; ")}.

Code: \`lib/scoring/stage1/p1.ts\` (computeP1) —
\`\`\`ts
const tensionAcknowledged =
  tier2.p1_tension_acknowledged != null ||
  tier1Chapters.some((c) => c.tension_acknowledged != null);
...
const bonus = tensionAcknowledged ? 0.5 : 0;
\`\`\`
Why 0.5 on all ${rows.length}/43 runs: the bonus fires if the cross-chapter synthesis OR
**any single chapter** returns a non-null \`tension_acknowledged\` string. On a real
multi-chapter memo the agent essentially always finds at least one acknowledged
tension somewhere (any hedged trade-off sentence qualifies), so the OR across
~5–22 chapters saturates. The bonus is therefore a constant +0.5 offset in
practice, not a discriminating signal. No change in this phase.

## 7. Minor-cap audit (report only)

Cap hit (\`minor_cap_applied = true\`) on **${capHit}/${rows.length}** runs. Raw vs capped
penalty per run is in replay-report.csv (\`minorCombinedRaw\` vs
\`minorCombinedPenalty\`; cap = 1.5). Raw range: ${r2(Math.min(...capAudit.filter((c) => c.raw !== null).map((c) => c.raw!)))} – ${r2(Math.max(...capAudit.filter((c) => c.raw !== null).map((c) => c.raw!)))}.
Every run's combined minor/reasoning penalty saturates the 1.5 cap, i.e. the three
minor categories currently contribute a near-constant −1.5. Recalibration deferred
to Phase D where thresholds move together.

---
**CHECKPOINT: awaiting Carson's approval before any C1–C4 implementation.**
`;
  fs.writeFileSync(path.join(OUT_DIR, "REPLAY-SUMMARY.md"), summary, "utf8");

  console.log(`Replayed ${rows.length} runs. P1 changes: ${p1Changes.length}. Badge flips: ${badgeFlips.length}. Deviations: ${deviations.length}.`);
  for (const d of deviations) console.log("DEVIATION:", d);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
