/**
 * scripts/experiment-extraction/p1-evidence/extract-p1.ts
 *
 * P1 reconciliation evidence extraction. STRICTLY READ-ONLY:
 * findMany/findFirst/count queries only — zero create/update/upsert/delete.
 * Raw stored text exported verbatim; no interpretation.
 *
 * Usage: npx tsx scripts/experiment-extraction/p1-evidence/extract-p1.ts
 * Field mapping rationale: FIELD-NOTES.md.
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as ConstructorParameters<typeof PrismaClient>[0]);

const OUT_DIR = path.join(__dirname, "output");
const FOCUS_RUNS = [23, 35, 38, 41, 56, 58, 64];

interface FavoriteFriend { assertionCount?: number }

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function num(o: Record<string, unknown> | null | undefined, k: string): number | null {
  const v = o?.[k];
  return typeof v === "number" ? v : null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const runs = await prisma.scoringRun.findMany({
    orderBy: { id: "asc" },
    include: {
      memo: { select: { name: true } },
      dimensionScores: { where: { dimensionKey: "P1" } },
      redundancyAnalysis: { select: { sri: true, claimCount: true, favoriteFriends: true } },
    },
  });

  // ── Step 1: p1-summary.csv ────────────────────────────────────────────────
  const gaps: string[] = [];
  const rows = runs.map((run) => {
    const p1 = run.dimensionScores[0] ?? null;
    if (!p1) gaps.push(`Run ${run.id}: no P1 DimensionScore row`);
    const sub = (p1?.subScores ?? null) as Record<string, unknown> | null;
    const ff = run.redundancyAnalysis?.favoriteFriends as unknown as FavoriteFriend[] | null;
    const p1Score = p1?.serverComputed ?? null;
    if (p1Score !== null && (p1Score < 1 || p1Score > 5)) {
      // Checklist item: stop and flag rather than proceeding
      throw new Error(`Run ${run.id}: P1 serverComputed=${p1Score} is outside [1,5] — STOPPING per checklist.`);
    }
    return {
      runId: run.id,
      memoIdentity: run.memo.name.trim().toLowerCase(),
      p1Score,
      reconciliationFailureCount: num(sub, "majorReconciliations"),
      flatContradictions: num(sub, "flatContradictions"),
      minorGaps: num(sub, "minorGaps"),
      definitionalDrifts: num(sub, "definitionalDrifts"),
      reasoningGaps: num(sub, "reasoningGaps"),
      flatPenalty: num(sub, "flatPenalty"),
      majorPenalty: num(sub, "majorPenalty"),
      minorCombinedPenalty: num(sub, "minorCombinedPenalty"),
      totalPenalties: num(sub, "totalPenalties"),
      tensionBonus: num(sub, "bonus"),
      sriStored: run.redundancyAnalysis?.sri ?? null,
      favoriteFriendsCount: Array.isArray(ff) ? ff.length : null,
      claimCount: run.redundancyAnalysis?.claimCount ?? null,
    };
  });

  const headers = Object.keys(rows[0]);
  fs.writeFileSync(
    path.join(OUT_DIR, "p1-summary.csv"),
    [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell((r as Record<string, unknown>)[h])).join(","))].join("\r\n") + "\r\n",
    "utf8"
  );

  // ── Step 2: p1-evidence.json (focus runs, verbatim) ──────────────────────
  const evidence = [];
  for (const id of FOCUS_RUNS) {
    const run = runs.find((r) => r.id === id);
    if (!run) {
      evidence.push({ runId: id, gap: "Run not found in database." });
      gaps.push(`Focus run ${id}: not found`);
      continue;
    }
    const p1 = run.dimensionScores[0] ?? null;
    const gapRows = await prisma.gap.findMany({ where: { scoringRunId: id, dimensionKey: "P1" } });
    const editRows = await prisma.edit.findMany({ where: { scoringRunId: id, dimensionKey: "P1" } });
    evidence.push({
      runId: id,
      memoName: run.memo.name,
      scoredAt: run.scoredAt.toISOString(),
      p1DimensionScore: p1
        ? {
            score: p1.score,
            serverComputed: p1.serverComputed,
            agentSelfReported: p1.agentSelfReported,
            calibrationDrift: p1.calibrationDrift,
            subScores: p1.subScores,
            traceabilityLog: p1.traceabilityLog,
          }
        : null,
      p1GapRows: gapRows.map((g) => ({ issue: g.issue, impact: g.impact, fix: g.fix, severity: g.severity })),
      // Edit rows are the only stored artifact naming the specific conflicting
      // facts/figures (see FIELD-NOTES.md, incl. caveats: secondary LLM artifact,
      // 1–3 per finding, absent when P1 >= 4.0).
      p1EditRows: editRows.map((e) => ({ issue: e.issue, impact: e.impact, fix: e.fix, severity: e.severity })),
      perFailureDetailGap:
        "Agent-cited per-failure detail (ReconciliationEntry quoteA/quoteB/locations) is NOT persisted — " +
        "computeP1 reduces all finding arrays to counts before persistence; raw Tier-1/Tier-2 LLM responses " +
        "are not stored in any table (Inngest journal ephemeral, already confirmed unrecoverable).",
      redundancy: run.redundancyAnalysis
        ? { sri: run.redundancyAnalysis.sri, claimCount: run.redundancyAnalysis.claimCount }
        : null,
    });
  }
  fs.writeFileSync(path.join(OUT_DIR, "p1-evidence.json"), JSON.stringify(evidence, null, 2), "utf8");

  // ── Step 3: summary ───────────────────────────────────────────────────────
  const withP1 = rows.filter((r) => r.p1Score !== null);
  const pinnedAt2 = rows.filter((r) => r.p1Score === 2);
  const withEditDetail: number[] = [];
  for (const id of runs.map((r) => r.id)) {
    const c = await prisma.edit.count({ where: { scoringRunId: id, dimensionKey: "P1" } });
    if (c > 0) withEditDetail.push(id);
  }
  const focusSummaries = evidence.map((e) =>
    "gap" in e
      ? `| ${e.runId} | — | — | — | NOT FOUND |`
      : `| ${e.runId} | ${e.p1DimensionScore?.serverComputed ?? "null"} | ${(e.p1DimensionScore?.subScores as Record<string, unknown>)?.majorReconciliations ?? "—"} | ${e.p1EditRows.length} | ${e.p1GapRows.length} |`
  );

  const summary = `# P1 Evidence Extraction Summary (generated by extract-p1.ts, read-only)

Inventory only — no analysis, no hypothesis testing.

## Row counts
- Runs in database: **${runs.length}** (ids ${runs[0].id}–${runs[runs.length - 1].id}; identical id set to the Phase 1 extraction — no corpus drift).
- p1-summary.csv rows: **${rows.length}**
- Runs with a P1 DimensionScore: **${withP1.length}** of ${rows.length}
- Runs with P1 serverComputed exactly 2.0: **${pinnedAt2.length}** (ids: ${pinnedAt2.map((r) => r.runId).join(", ")})
- Runs with at least one P1 Edit row (named-fact detail): **${withEditDetail.length}** (ids: ${withEditDetail.join(", ")})

## Named-fact detail vs count-only (Step 0 recap)
- **Count-only (all runs):** P1 \`subScores\`/\`traceabilityLog\` store penalty math and counts; the agent's per-failure detail (\`ReconciliationEntry { quoteA, quoteB, description, locations[] }\`) is reduced to \`.length\` in \`computeP1\` (lib/scoring/stage1/p1.ts:33-46) and never persisted. Raw Tier-1/Tier-2 LLM responses are not stored anywhere.
- **Named facts (subset):** P1 \`Edit\` rows name specific conflicting figures and sections, but are a secondary LLM artifact: generated only when P1 < 4.0, typically 1–3 per finding (run 23: 6 counted failures → 3 edits), and silently empty on edit-generation failure.
- **Gap rows:** templated text, count interpolated, no facts.

## Focus runs (Step 2)
| runId | P1 | reconFailures | P1 edits | P1 gaps |
|---|---|---|---|---|
${focusSummaries.join("\n")}

## Data gaps
${gaps.length ? gaps.map((g) => `- ${g}`).join("\n") : "- none at run level"}
- Corpus-wide: agent-cited per-failure facts (quoteA/quoteB/locations) unrecoverable for ALL runs (not persisted; ephemeral Inngest journal already confirmed reset). The hypothesis test must rely on P1 Edit text as the named-fact proxy, with the caveats in FIELD-NOTES.md.
- Out-of-range check: no P1 value outside [1,5] found (script throws if one appears).

## Files
- output/p1-summary.csv — ${rows.length} rows
- output/p1-evidence.json — ${evidence.length} focus-run entries
`;
  fs.writeFileSync(path.join(OUT_DIR, "P1-EXTRACTION-SUMMARY.md"), summary, "utf8");

  console.log(`Extracted ${rows.length} runs; focus entries: ${evidence.length}; P1=2.0 runs: ${pinnedAt2.length}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});
