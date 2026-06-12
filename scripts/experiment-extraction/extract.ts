/**
 * scripts/experiment-extraction/extract.ts
 *
 * Phase 1 — Experiment Dataset Extraction. STRICTLY READ-ONLY:
 * only findMany/findUnique/count queries; zero create/update/upsert/delete calls.
 * Writes output files under scripts/experiment-extraction/output/ only.
 *
 * Usage: npx tsx scripts/experiment-extraction/extract.ts
 * Requires DATABASE_URL in .env (same as the app).
 *
 * Field mapping rationale: see SCHEMA-NOTES.md.
 * Fix-era flag rationale: see FIX-TIMELINE.md.
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
} as ConstructorParameters<typeof PrismaClient>[0]);

const OUT_DIR = path.join(__dirname, "output");
const FRAMINGS_DIR = path.join(OUT_DIR, "framings");

const ANCHOR_MEMO_NAME = "2026-02-11_Daikin_Oxi_Corporate_1st_Gen.docx";
const ANCHOR_EXPECTED_RUN_ID = 25;

// FavoriteFriend JSON shape (lib/redundancy/types.ts — types mirrored here, NOT imported,
// to avoid touching frozen modules)
interface FFInstance { chapter: string; text: string }
interface FavoriteFriend {
  rank: number;
  label: string;
  assertionCount: number;
  chapterSpread: number;
  chapters: string[];
  instances: FFInstance[];
}

const TYPOLOGY_DISPLAY: Record<string, string> = {
  ONE_A: "1A", ONE_B: "1B", TWO_A: "2A", TWO_B: "2B",
};

const DIM_KEYS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "D1", "D2", "D3", "D4", "D5"] as const;

function inputFileType(memoName: string): string {
  const m = memoName.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return "unknown";
  if (m[1] === "docx") return "docx";
  if (m[1] === "pdf") return "pdf";
  if (m[1] === "md") return "md";
  return m[1];
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  fs.mkdirSync(FRAMINGS_DIR, { recursive: true });

  // ── Fetch everything (read-only) ──────────────────────────────────────────
  const runs = await prisma.scoringRun.findMany({
    orderBy: { id: "asc" },
    include: {
      memo: { select: { id: true, name: true, typology: true, chapters: true } },
      dimensionScores: { select: { dimensionKey: true, score: true } },
      confirmedRisks: { select: { severity: true, approved: true } },
      redundancyAnalysis: true,
      framing: { select: { id: true, name: true, sourceType: true, content: true } },
    },
  });
  const dbRunCount = await prisma.scoringRun.count();
  if (runs.length !== dbRunCount) {
    throw new Error(`Fetched ${runs.length} runs but DB count is ${dbRunCount}`);
  }

  // ── Anchor run: locate by memo filename, require exactly one match ───────
  const anchorRuns = runs.filter((r) => r.memo.name === ANCHOR_MEMO_NAME);
  if (anchorRuns.length !== 1) {
    throw new Error(
      `Ship-ready anchor: expected exactly 1 run for memo "${ANCHOR_MEMO_NAME}", found ${anchorRuns.length} ` +
      `(run ids: ${anchorRuns.map((r) => r.id).join(", ") || "none"}). STOPPING — not guessing.`
    );
  }
  const anchorRunId = anchorRuns[0].id;
  if (anchorRunId !== ANCHOR_EXPECTED_RUN_ID) {
    throw new Error(
      `Ship-ready anchor resolved to run ${anchorRunId}, but the task expects run #${ANCHOR_EXPECTED_RUN_ID}. STOPPING.`
    );
  }

  // ── Build per-run rows ────────────────────────────────────────────────────
  const gaps: string[] = [];
  const rows = runs.map((run) => {
    const dims: Record<string, number | null> = {};
    for (const k of DIM_KEYS) dims[k] = null;
    for (const ds of run.dimensionScores) dims[ds.dimensionKey] = ds.score;
    const missingDims = DIM_KEYS.filter((k) => dims[k] === null);
    if (missingDims.length > 0) {
      gaps.push(`Run ${run.id}: missing dimension scores: ${missingDims.join(", ")}`);
    }

    const risks = run.confirmedRisks;
    const red = run.redundancyAnalysis;
    const ff = (red?.favoriteFriends ?? []) as unknown as FavoriteFriend[];
    const ffArr = Array.isArray(ff) ? ff : [];
    // clusteredClaimCount: repeated-cluster instances + 1 per singleton cluster
    // (singletons are not stored in favoriteFriends; each contributes exactly 1 claim)
    const repeatedInstances = ffArr.reduce((s, f) => s + (f.assertionCount ?? 0), 0);
    const clusteredClaimCount =
      red == null ? null : repeatedInstances + (red.uniqueClusterCount - ffArr.length);
    if (!red) gaps.push(`Run ${run.id}: no RedundancyAnalysis row (redundancy fields null)`);

    const chapters = Array.isArray(run.memo.chapters) ? (run.memo.chapters as unknown[]) : null;
    if (chapters === null) gaps.push(`Run ${run.id}: memo.chapters is not an array (chapterCount null)`);

    return {
      // Identity & metadata
      runId: run.id,
      runTimestamp: run.scoredAt.toISOString(),
      memoName: run.memo.name,
      memoIdentity: run.memo.name.trim().toLowerCase(),
      typology: TYPOLOGY_DISPLAY[run.memo.typology] ?? run.memo.typology,
      inputFileType: inputFileType(run.memo.name),
      framingDocPresent: run.framingId !== null,
      framingDocFileRef: run.framing ? `framing#${run.framing.id}:${run.framing.name}` : null,
      modelId: run.scoringModel,
      temperature: null as null, // not persisted per run — see SCHEMA-NOTES.md
      chapterCount: chapters ? chapters.length : null,
      statusBadge: run.statusBadge,
      rubricVersion: run.rubricVersion,
      // Scores
      ...dims,
      memoReadiness: run.memoConfidence,
      decisionReadiness: run.decisionConfidence,
      stage1Avg: run.stage1Avg,
      stage2Avg: run.stage2Avg,
      criticalRiskCount: risks.filter((r) => r.severity === "CRITICAL").length,
      highRiskCount: risks.filter((r) => r.severity === "HIGH").length,
      mediumRiskCount: risks.filter((r) => r.severity === "MEDIUM").length,
      approvedCriticalCount: risks.filter((r) => r.severity === "CRITICAL" && r.approved).length,
      // Redundancy
      sriStored: red?.sri ?? null,
      claimCount: red?.claimCount ?? null,
      uniqueClusterCount: red?.uniqueClusterCount ?? null,
      thresholdStored: red?.threshold ?? null,
      clusteredClaimCount,
      claimCountMismatch: red && clusteredClaimCount !== null ? red.claimCount !== clusteredClaimCount : null,
      favoriteFriendsCount: red ? ffArr.length : null,
      redundancyStatus: red?.analysisStatus ?? null,
      redundancyVersion: run.redundancyVersion,
      includeInAnalysis: run.includeInAnalysis,
      dataNote: run.dataNote,
      // Fix-era flags — see FIX-TIMELINE.md (git history squashed; three flags
      // undatable → null; threshold flag is data-derived from the stored per-run threshold)
      postTempFix: null as null,
      postThresholdFix: red ? red.threshold === 0.7 : null,
      postCapRemoval: null as null,
      postDocxFix: null as null,
      // Anchor
      isShipReadyAnchor: run.id === anchorRunId,
    };
  });

  // ── runs.csv / runs.json ──────────────────────────────────────────────────
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvCell((r as Record<string, unknown>)[h])).join(",")),
  ].join("\r\n") + "\r\n";
  fs.writeFileSync(path.join(OUT_DIR, "runs.csv"), csv, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "runs.json"), JSON.stringify(rows, null, 2), "utf8");

  // ── claims.json ───────────────────────────────────────────────────────────
  // Per-claim records/embeddings are NOT persisted (see SCHEMA-NOTES.md). Claims are
  // reconstructed from favoriteFriends instances — repeated clusters only; singleton
  // claim text is not recoverable. hasEmbedding is null (unknown) everywhere.
  const claimsOut = runs.map((run) => {
    const red = run.redundancyAnalysis;
    const ffArr = ((red?.favoriteFriends ?? []) as unknown as FavoriteFriend[]) || [];
    const claims: Array<{ claimId: string; text: string; chapter: string; hasEmbedding: null; clusterId: string }> = [];
    const clusters: Array<{ clusterId: string; label: string; memberClaimIds: string[]; isFavoriteFriend: boolean }> = [];
    (Array.isArray(ffArr) ? ffArr : []).forEach((f, ci) => {
      const clusterId = `run${run.id}-cl${f.rank ?? ci + 1}`;
      const memberIds: string[] = [];
      (f.instances ?? []).forEach((inst, ii) => {
        const claimId = `${clusterId}-i${ii + 1}`;
        memberIds.push(claimId);
        claims.push({
          claimId,
          text: inst.text,
          chapter: inst.chapter,
          hasEmbedding: null, // embeddings are compute-and-discard; presence not stored
          clusterId,
        });
      });
      clusters.push({ clusterId, label: f.label, memberClaimIds: memberIds, isFavoriteFriend: true });
    });
    return {
      runId: run.id,
      note: red
        ? `Reconstructed from stored favoriteFriends JSON. Repeated clusters only — ${red.uniqueClusterCount - clusters.length} singleton cluster(s) of ${red.uniqueClusterCount} total are not persisted (no text stored). Embedding presence not persisted.`
        : "No RedundancyAnalysis row for this run.",
      sriStored: red?.sri ?? null,
      claimCount: red?.claimCount ?? null,
      uniqueClusterCount: red?.uniqueClusterCount ?? null,
      claims,
      clusters,
    };
  });
  fs.writeFileSync(path.join(OUT_DIR, "claims.json"), JSON.stringify(claimsOut, null, 2), "utf8");

  // ── framings/{runId}.txt + framings-index.csv ─────────────────────────────
  // Framing.content is already-parsed text for all source types (DOCX framings were
  // parsed at upload; raw bytes are not stored) — exported directly, no mammoth needed.
  const framingIndexRows: string[] = ["runId,framingId,framingName,sourceType,extractedFile,charCount"];
  let framingCount = 0;
  for (const run of runs) {
    if (!run.framing) continue;
    framingCount++;
    const fileName = `${run.id}.txt`;
    fs.writeFileSync(path.join(FRAMINGS_DIR, fileName), run.framing.content, "utf8");
    framingIndexRows.push(
      [run.id, run.framing.id, csvCell(run.framing.name), run.framing.sourceType,
       `framings/${fileName}`, run.framing.content.length].join(",")
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, "framings-index.csv"), framingIndexRows.join("\r\n") + "\r\n", "utf8");

  // ── EXTRACTION-SUMMARY.md ─────────────────────────────────────────────────
  const memoIdentityCounts = new Map<string, number>();
  for (const r of rows) memoIdentityCounts.set(r.memoIdentity, (memoIdentityCounts.get(r.memoIdentity) ?? 0) + 1);
  const mismatchRuns = rows.filter((r) => r.claimCountMismatch === true);
  const withRed = rows.filter((r) => r.sriStored !== null);
  const withClaims = claimsOut.filter((c) => c.claims.length > 0);
  const preThreshold = rows.filter((r) => r.postThresholdFix === false);
  const postThreshold = rows.filter((r) => r.postThresholdFix === true);
  const nullModel = rows.filter((r) => r.modelId === null);

  const summary = `# Extraction Summary — Phase 1 (generated by extract.ts, read-only)

Generated against the live database via read-only queries. No analysis, no conclusions — inventory only.

## 1. Total runs extracted
**${rows.length}** scoring runs (database count: ${dbRunCount}). Expected 43 — ${rows.length === 43 ? "matches" : "MISMATCH"}.

## 2. Ship-ready anchor
Found: run **#${anchorRunId}**, memo \`${ANCHOR_MEMO_NAME}\` (exactly one match, as required).
\`isShipReadyAnchor = true\` on this run only.

## 3. Fix timeline
Git history was squashed into the 2026-06-02 baseline commit; **none of the four fixes is
datable from git** (full evidence: FIX-TIMELINE.md — flagged for Carson's review).

| Fix | Commit | Datetime | Runs before / after |
|---|---|---|---|
| Temperature → 0 | not datable (in squashed baseline \`0164163\`) | unknown | unknown — \`postTempFix\` null for all runs |
| Threshold 0.85 → 0.70 | not datable from git; **data-derived per run from stored \`threshold\`** | unknown | ${preThreshold.length} runs at 0.85 (false) / ${postThreshold.length} runs at 0.70 (true) / ${rows.length - preThreshold.length - postThreshold.length} null |
| Cluster cap removal | not datable (in squashed baseline \`0164163\`) | unknown | unknown — \`postCapRemoval\` null for all runs |
| Docx parse fix | not datable (in squashed baseline \`0164163\`) | unknown | unknown — \`postDocxFix\` null for all runs |

## 4. Counts
- Runs with a durable framing link (\`framingDocPresent = true\`): **${framingCount}** (framing text exported for each). NOTE: pre-2026-06-10 runs had ephemeral framing links that were not persisted — false here means "no durable link", not "no framing used".
- Runs with a RedundancyAnalysis row: **${withRed.length}** of ${rows.length}
- Runs with at least one reconstructed claim in claims.json: **${withClaims.length}** (claims are recoverable only from repeated clusters stored in favoriteFriends; runs with SRI = 0 legitimately have zero stored claims)
- Runs with \`claimCountMismatch = true\`: **${mismatchRuns.length}**${mismatchRuns.length ? ` (run ids: ${mismatchRuns.map((r) => r.runId).join(", ")})` : ""}
- Runs with \`modelId\` null (pre-provenance): **${nullModel.length}**

## 5. Distinct memo identities (${memoIdentityCounts.size}) and run count per memo
| memoIdentity | runs |
|---|---|
${Array.from(memoIdentityCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

## 6. Data gaps
Schema-level gaps (detail in SCHEMA-NOTES.md):
- \`temperature\` not persisted per run → null for all rows.
- Per-claim records and embeddings not persisted; no Claim table. claims.json reconstructs repeated-cluster instances from \`favoriteFriends\` JSON only; **singleton claim text is unrecoverable**; \`hasEmbedding\` is null (unknown) for every claim.
- Typology enum has no 2C value (only 1A/1B/2A/2B).
- Input file type not stored; derived from memo filename extension (memos without extensions → "unknown").
- Framing links on runs created before 2026-06-10 (commit b25218f) were ephemeral and are not recoverable.
- Three of four fix-era flags undatable from squashed git history → null (FIX-TIMELINE.md, flagged for review).

Run-level gaps found during extraction:
${gaps.length ? gaps.map((g) => `- ${g}`).join("\n") : "- none"}

## 7. Files produced
- \`output/runs.csv\`, \`output/runs.json\` — ${rows.length} rows
- \`output/claims.json\` — ${claimsOut.length} run entries
- \`output/framings/\` — ${framingCount} text files; \`output/framings-index.csv\`
`;
  fs.writeFileSync(path.join(OUT_DIR, "EXTRACTION-SUMMARY.md"), summary, "utf8");

  console.log(`Extracted ${rows.length} runs. Anchor: run #${anchorRunId}.`);
  console.log(`Framings exported: ${framingCount}. claimCountMismatch runs: ${mismatchRuns.length}.`);
  console.log(`Output written to ${OUT_DIR}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});
