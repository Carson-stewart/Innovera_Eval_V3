/**
 * scripts/split-redundancy.ts
 *
 * READ-ONLY: splits each repeated cluster in stored RedundancyAnalysis rows
 * into canonical / cross-reference / bare-restatement instances using a
 * heuristic phrase list. Computes a restatement-only SRI alongside the raw SRI
 * so the two can be compared before any fix lands.
 *
 * Usage:
 *   npx tsx scripts/split-redundancy.ts          # heuristic only (free, deterministic)
 *   npx tsx scripts/split-redundancy.ts --llm    # + LLM disagreement pass (uses API credits)
 *
 * Requires: DATABASE_URL in .env
 * --llm also requires: OPENROUTER_API_KEY in .env
 *
 * Writes nothing. Safe to run repeatedly.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { callModelJSON, SCORING_MODEL } from "../lib/openrouter";

// ── Types mirroring lib/redundancy/types.ts (not imported to avoid
//    any risk of pulling in server-side side-effects) ─────────────────────────
interface FavoriteFriendInstance {
  chapter: string;
  text: string;
}

interface FavoriteFriend {
  rank: number;
  label: string;
  assertionCount: number;
  chapterSpread: number;
  chapters: string[];
  instances: FavoriteFriendInstance[];
}

// ── Back-reference cue list ───────────────────────────────────────────────
//
// TUNING NOTES:
//   • All phrases are multi-word to avoid false fires on single ambiguous words.
//   • "above" and "previously" alone are NOT included — they fire on things like
//     "above 45% margin" or "previously unaddressed risks."
//   • "per the" and "per our" are excluded — they often introduce fresh data
//     ("per the audited financials") rather than a backward pointer.
//   • Add phrases here before any formal before/after experiment; re-run to see
//     how the gap changes across the existing baseline.
//
// Each matched cue is reported in the output so you can eyeball over-firing.
const CROSS_REF_CUES: readonly string[] = [
  // "as X" forms
  "as established",
  "as noted",
  "as discussed",
  "as mentioned",
  "as outlined",
  "as described",
  "as stated",
  "as shown",
  "as referenced",
  "as indicated",
  // "X above / earlier / in" forms
  "established in",
  "established above",
  "noted above",
  "noted earlier",
  "discussed above",
  "discussed earlier",
  "mentioned earlier",
  "mentioned above",
  "described above",
  "outlined above",
  "presented above",
  "presented earlier",
  "highlighted above",
  "highlighted earlier",
  // "see X" forms
  "see chapter",
  "see section",
  "see above",
  "see the",
  // "referenced" forms
  "referenced in",
  "referenced above",
  "referenced earlier",
  // compound adjectives / single-word back-pointers (unambiguous ones only)
  "aforementioned",
  "above-mentioned",
];

// Pre-compile regexes once.
// \b at start of each cue ensures we don't match mid-word.
// The replacement escapes regex metacharacters (particularly the hyphen in
// "above-mentioned").
const CUE_REGEXES: ReadonlyArray<{ cue: string; re: RegExp }> = CROSS_REF_CUES.map(
  (cue) => ({
    cue,
    re: new RegExp(
      `\\b${cue.replace(/[[\]{}()*+?.,\\^$|#]/g, "\\$&")}`,
      "i"
    ),
  })
);

function firstMatchedCue(text: string): string | null {
  for (const { cue, re } of CUE_REGEXES) {
    if (re.test(text)) return cue;
  }
  return null;
}

// ── Classification types ───────────────────────────────────────────────────
type InstanceLabel = "canonical" | "restatement" | "cross-ref";

interface ClassifiedInstance {
  chapter: string;
  text: string;
  label: InstanceLabel;
  matchedCue: string | null;
}

interface ClusterAnalysis {
  rank: number;
  label: string;
  assertionCount: number;   // from stored field
  instancesLength: number;  // actual instances.length (should equal assertionCount)
  refCount: number;
  nonRefCount: number;
  bareRestatements: number;
  isReferencedOnly: boolean; // nonRefCount === 0: fact is referenced but never stated in full
  sanityOk: boolean;         // bareRestatements + refCount === assertionCount - 1
  classified: ClassifiedInstance[];
}

interface RunAnalysis {
  runId: number;
  memoId: number;
  memoName: string;
  rubricVersion: string;
  statusBadge: string;
  scoredAt: Date;
  analysisStatus: string;
  errorMessage: string | null;
  scorerId: string | null;
  threshold: number;
  claimCount: number;
  uniqueClusterCount: number;
  sriStored: number;
  sriRecomputed: number;    // cross-check: should match sriStored within rounding
  sriRestatements: number;  // restatement-only SRI (the new number)
  sriGap: number;           // sriRecomputed - sriRestatements
  referencedOnlyCount: number;
  clusters: ClusterAnalysis[];
  sanityFailures: number;
  totalInstances: number;
  totalCrossRefs: number;
}

// ── Prisma client (read-only queries only) ─────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ── Formatting helpers ─────────────────────────────────────────────────────
const r3 = (n: number) => n.toFixed(3);
const pct = (n: number) => (n * 100).toFixed(1) + "%";
const snippet = (s: string, max = 130) => (s.length > max ? s.slice(0, max) + "…" : s);
const col = (s: string | number, w: number) => String(s).slice(0, w).padEnd(w);
const colR = (s: string | number, w: number) => String(s).slice(0, w).padStart(w);
function sep(char = "─", n = 78): void { console.log(char.repeat(n)); }

// ── Parse and validate favoriteFriends JSON ────────────────────────────────
function parseFavoriteFriends(raw: unknown): FavoriteFriend[] | null {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).rank !== "number" ||
      !Array.isArray((item as Record<string, unknown>).instances)
    ) {
      return null;
    }
  }
  return raw as FavoriteFriend[];
}

// ── Classify a single stored cluster ──────────────────────────────────────
function classifyCluster(ff: FavoriteFriend): ClusterAnalysis {
  const classified: ClassifiedInstance[] = [];
  let refCount = 0;

  for (const inst of ff.instances) {
    const cue = firstMatchedCue(inst.text);
    if (cue !== null) {
      classified.push({ chapter: inst.chapter, text: inst.text, label: "cross-ref", matchedCue: cue });
      refCount++;
    } else {
      // Tentatively "restatement"; first non-ref gets upgraded to "canonical" below.
      classified.push({ chapter: inst.chapter, text: inst.text, label: "restatement", matchedCue: null });
    }
  }

  const nonRefCount = ff.instances.length - refCount;
  const isReferencedOnly = nonRefCount === 0;

  // Upgrade the first non-ref to canonical (array order = stored order).
  let canonicalAssigned = false;
  for (const ci of classified) {
    if (ci.label === "restatement" && !canonicalAssigned) {
      ci.label = "canonical";
      canonicalAssigned = true;
    }
  }

  // bareRestatements = non-ref count minus the one canonical slot
  const bareRestatements = Math.max(0, nonRefCount - 1);

  // Sanity: bareRestatements + refCount must equal assertionCount − 1
  // (that right-hand side is exactly this cluster's contribution to the raw SRI numerator)
  const sanityOk = bareRestatements + refCount === ff.assertionCount - 1;

  return {
    rank: ff.rank,
    label: ff.label,
    assertionCount: ff.assertionCount,
    instancesLength: ff.instances.length,
    refCount,
    nonRefCount,
    bareRestatements,
    isReferencedOnly,
    sanityOk,
    classified,
  };
}

// ── Analyze one database row ───────────────────────────────────────────────
function analyzeRow(row: {
  id: number;
  sri: number;
  claimCount: number;
  uniqueClusterCount: number;
  threshold: number;
  analysisStatus: string;
  errorMessage: string | null;
  favoriteFriends: unknown;
  scoringRun: {
    memoId: number;
    rubricVersion: string;
    statusBadge: string;
    scoredAt: Date;
    scorerId: string | null;
    memo: { name: string };
  };
}): RunAnalysis {
  const ff = parseFavoriteFriends(row.favoriteFriends);
  const clusters: ClusterAnalysis[] = ff ? ff.map(classifyCluster) : [];

  // Recomputed raw SRI:
  //   favoriteFriends only contains clusters with assertionCount > 1 (singletons excluded),
  //   so summing (assertionCount − 1) over them gives the same numerator as the stored SRI.
  const recomputedNumerator = ff
    ? ff.reduce((s, c) => s + (c.assertionCount - 1), 0)
    : 0;
  const sriRecomputed =
    row.claimCount > 0 ? Math.round((recomputedNumerator / row.claimCount) * 1000) / 1000 : 0;

  // Restatement-only SRI (the new instrument)
  const totalBare = clusters.reduce((s, c) => s + c.bareRestatements, 0);
  const sriRestatements =
    row.claimCount > 0 ? Math.round((totalBare / row.claimCount) * 1000) / 1000 : 0;

  const sriGap = Math.round((sriRecomputed - sriRestatements) * 1000) / 1000;

  const totalInstances = clusters.reduce((s, c) => s + c.instancesLength, 0);
  const totalCrossRefs = clusters.reduce((s, c) => s + c.refCount, 0);

  return {
    runId: row.id,
    memoId: row.scoringRun.memoId,
    memoName: row.scoringRun.memo.name,
    rubricVersion: row.scoringRun.rubricVersion,
    statusBadge: row.scoringRun.statusBadge,
    scoredAt: row.scoringRun.scoredAt,
    analysisStatus: row.analysisStatus,
    errorMessage: row.errorMessage,
    scorerId: row.scoringRun.scorerId,
    threshold: row.threshold,
    claimCount: row.claimCount,
    uniqueClusterCount: row.uniqueClusterCount,
    sriStored: row.sri,
    sriRecomputed,
    sriRestatements,
    sriGap,
    referencedOnlyCount: clusters.filter((c) => c.isReferencedOnly).length,
    clusters,
    sanityFailures: clusters.filter((c) => !c.sanityOk).length,
    totalInstances,
    totalCrossRefs,
  };
}

// ── LLM disagreement pass (--llm flag only) ────────────────────────────────
//
// Sends batches of instances to the scoring model at temperature 0.
// Reports where LLM and heuristic disagree — useful for calibrating
// the cue list before a formal experiment.
//
// Model used: SCORING_MODEL from lib/openrouter.ts (currently claude-sonnet-4-5).
// Cost: ~1 API call per 20 instances. Expect a few calls for a typical run.

const LLM_SYSTEM = `You classify instances of a repeated claim in a business memo.

For each numbered instance you receive, decide:
  "assertion"       – the fact is being stated fresh (a canonical or repeated statement of the fact itself)
  "cross_reference" – this instance is a deliberate pointer back to where the fact was already established
                      (it names or implies the earlier section, uses back-reference phrasing, etc.)

Return ONLY valid JSON:
{ "results": [{ "index": 1, "classification": "assertion"|"cross_reference", "confidence": "high"|"low" }] }

The results array must have exactly the same length as the input, in the same order.`;

interface LLMResult {
  index: number;
  classification: "assertion" | "cross_reference";
  confidence: "high" | "low";
}

interface LLMBatchInput {
  index: number;
  chapter: string;
  clusterLabel: string;
  text: string;
}

async function runLLMBatch(batch: LLMBatchInput[]): Promise<LLMResult[]> {
  const userContent = batch
    .map(
      (b) =>
        `[${b.index}] cluster="${snippet(b.clusterLabel, 60)}" chapter="${b.chapter}"\ntext: "${snippet(b.text, 300)}"`
    )
    .join("\n\n");

  const raw = await callModelJSON<{ results?: Array<{ index?: number; classification?: string; confidence?: string }> }>({
    system: LLM_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Classify ${batch.length} instance(s):\n\n${userContent}`,
      },
    ],
  });

  return (raw.results ?? []).map((r, i) => ({
    index: typeof r.index === "number" ? r.index : batch[i]?.index ?? i + 1,
    classification:
      r.classification === "cross_reference" ? "cross_reference" : "assertion",
    confidence: r.confidence === "low" ? "low" : "high",
  }));
}

// ── Print cluster detail ───────────────────────────────────────────────────
function printClusterDetail(
  ca: ClusterAnalysis,
  maxInstances = 6,
  llmResults?: Map<number, LLMResult>
): void {
  const sanityMark = ca.sanityOk ? "✓" : "✗ SANITY FAIL";
  const refOnlyNote = ca.isReferencedOnly
    ? "  ⚠ REFERENCED-ONLY — fact never stated in full"
    : "";
  const instanceMismatch =
    ca.instancesLength !== ca.assertionCount
      ? `  ⚠ instances.length(${ca.instancesLength}) ≠ assertionCount(${ca.assertionCount})`
      : "";

  console.log(
    `  [Cluster #${ca.rank}]  assertionCount=${ca.assertionCount}  ` +
      `canonical=1  restatements=${ca.bareRestatements}  cross-refs=${ca.refCount}  ${sanityMark}${refOnlyNote}${instanceMismatch}`
  );
  console.log(`    label: "${snippet(ca.label, 100)}"`);

  const shown = ca.classified.slice(0, maxInstances);
  for (let i = 0; i < shown.length; i++) {
    const inst = shown[i];
    const globalIdx = i + 1; // 1-based within this cluster display
    const cueStr = inst.matchedCue ? `  → cue: "${inst.matchedCue}"` : "";
    const labelPad = inst.label.padEnd(11);

    // LLM annotation if available
    let llmNote = "";
    if (llmResults) {
      const llmR = llmResults.get(globalIdx);
      if (llmR) {
        const llmLabel = llmR.classification === "cross_reference" ? "cross-ref" : "assertion";
        const agrees = (inst.label === "cross-ref") === (llmR.classification === "cross_reference");
        llmNote = agrees ? "" : `  ← LLM: ${llmLabel} [${llmR.confidence}] DISAGREE`;
      }
    }

    console.log(`    [${labelPad}] ch="${inst.chapter}"${cueStr}${llmNote}`);
    console.log(`       "${snippet(inst.text, 160)}"`);
  }
  if (ca.classified.length > maxInstances) {
    console.log(
      `    … (${ca.classified.length - maxInstances} more instances not shown)`
    );
  }
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const useLlm = process.argv.includes("--llm");

  console.log(
    "\n╔══════════════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║       split-redundancy.ts  —  READ-ONLY diagnostic                      ║"
  );
  if (useLlm) {
    console.log(
      "║       Mode: HEURISTIC + LLM disagreement pass  (uses API credits)       ║"
    );
    console.log(
      `║       LLM model: ${SCORING_MODEL.padEnd(53)}║`
    );
  } else {
    console.log(
      "║       Mode: HEURISTIC ONLY  (free, fully deterministic)                 ║"
    );
  }
  console.log(
    "╚══════════════════════════════════════════════════════════════════════════╝\n"
  );

  // ── Fetch all rows ──────────────────────────────────────────────────────
  const rows = await prisma.redundancyAnalysis.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      scoringRun: {
        select: {
          memoId: true,
          rubricVersion: true,
          statusBadge: true,
          scoredAt: true,
          scorerId: true,
          memo: { select: { name: true } },
        },
      },
    },
  });

  if (rows.length === 0) {
    console.log("No RedundancyAnalysis rows found. Score a memo first.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${rows.length} RedundancyAnalysis row(s).\n`);

  const analyses = rows.map(analyzeRow);

  // ── Model version check ─────────────────────────────────────────────────
  sep("═");
  console.log("MODEL VERSION CHECK");
  sep();
  const anyScorerId = analyses.some((a) => a.scorerId !== null);
  if (anyScorerId) {
    console.log("scorerId values found (may identify the scoring operator, not the model):");
    for (const a of analyses) {
      console.log(`  run ${a.runId}: "${a.scorerId}"`);
    }
  } else {
    console.log(
      "scorerId is null on every run — the LLM model version is NOT tracked per run."
    );
    console.log(
      "The scoring model is a module-level constant in lib/openrouter.ts"
    );
    console.log(`  (currently: SCORING_MODEL = "${SCORING_MODEL}")`);
    console.log(
      "All runs are only reliably comparable if they were scored against the same"
    );
    console.log(
      "model version. Recommendation: write the model string to scorerId (or a"
    );
    console.log(
      "dedicated field) before any formal before/after experiment."
    );
  }
  console.log();

  // ── Summary table ───────────────────────────────────────────────────────
  sep("═");
  console.log("SUMMARY TABLE  (all runs, oldest first)");
  sep();
  console.log(
    col("runId", 6) +
      col("memoId", 7) +
      col("memo name", 26) +
      colR("claims", 7) +
      colR("raw✓", 8) +
      colR("rstSRI", 8) +
      colR("gap", 7) +
      colR("xrefs", 6) +
      colR("refOnly", 8) +
      "  status"
  );
  sep("-");

  for (const a of analyses) {
    if (a.analysisStatus !== "completed") {
      console.log(
        col(a.runId, 6) +
          col(a.memoId, 7) +
          col(a.memoName, 26) +
          "  — " +
          a.analysisStatus +
          (a.errorMessage ? `: ${snippet(a.errorMessage, 40)}` : "")
      );
      continue;
    }
    const sriOk =
      Math.abs(a.sriStored - a.sriRecomputed) < 0.002 ? "✓" : "✗";
    console.log(
      col(a.runId, 6) +
        col(a.memoId, 7) +
        col(a.memoName, 26) +
        colR(a.claimCount, 7) +
        colR(r3(a.sriStored) + sriOk, 8) +
        colR(r3(a.sriRestatements), 8) +
        colR(r3(a.sriGap), 7) +
        colR(a.totalCrossRefs, 6) +
        colR(a.referencedOnlyCount, 8) +
        "  " +
        a.statusBadge
    );
  }
  console.log();

  // ── Aggregate one-line read ─────────────────────────────────────────────
  const completed = analyses.filter((a) => a.analysisStatus === "completed");
  if (completed.length > 0) {
    const avgRaw = completed.reduce((s, a) => s + a.sriStored, 0) / completed.length;
    const avgRst = completed.reduce((s, a) => s + a.sriRestatements, 0) / completed.length;
    const avgGap = avgRaw - avgRst;
    const gapFraction = avgRaw > 0 ? avgGap / avgRaw : 0;
    const totalXrefs = completed.reduce((s, a) => s + a.totalCrossRefs, 0);
    const totalInst = completed.reduce((s, a) => s + a.totalInstances, 0);

    console.log(`Across ${completed.length} completed run(s):`);
    console.log(
      `  avg raw SRI          = ${r3(avgRaw)}`
    );
    console.log(
      `  avg restatement SRI  = ${r3(avgRst)}`
    );
    console.log(
      `  avg gap              = ${r3(avgGap)}  (${pct(gapFraction)} of measured redundancy is likely cross-referencing)`
    );
    console.log(
      `  cross-refs detected  = ${totalXrefs} / ${totalInst} repeated-cluster instances (${pct(totalInst > 0 ? totalXrefs / totalInst : 0)})`
    );
    if (gapFraction < 0.05) {
      console.log(
        "\n  ➜ Gap is very small. Current memos barely cross-reference — the raw"
      );
      console.log(
        "    SRI baseline is trustworthy as-is. The restatement SRI will be the"
      );
      console.log(
        "    cleaner instrument once fixes arrive, but today the two are near-identical."
      );
    } else if (gapFraction < 0.20) {
      console.log(
        "\n  ➜ Gap is moderate. Some legitimate referencing is already present."
      );
      console.log(
        "    Inspect the cross-ref instances below — if the heuristic is right,"
      );
      console.log(
        "    the restatement SRI is already the better baseline number."
      );
    } else {
      console.log(
        "\n  ➜ Gap is large. A meaningful share of what the raw SRI counts is likely"
      );
      console.log(
        "    legitimate cross-referencing. Eyeball the matched instances below;"
      );
      console.log(
        "    if the heuristic is over-firing, narrow the cue list and re-run."
      );
    }
    console.log();
  }

  // ── Per-run detail ──────────────────────────────────────────────────────
  for (const a of analyses) {
    sep("═");
    console.log(
      `RUN ${a.runId}  |  memo #${a.memoId}: "${a.memoName}"  |  ${a.rubricVersion}  |  ${a.statusBadge}`
    );
    console.log(
      `  scoredAt: ${a.scoredAt.toISOString()}  |  analysisStatus: ${a.analysisStatus}`
    );
    console.log(
      `  scorerId: ${a.scorerId ?? "(null — model version not tracked)"}`
    );
    console.log(
      `  threshold: ${a.threshold}  |  claimCount: ${a.claimCount}  |  uniqueClusterCount: ${a.uniqueClusterCount}`
    );
    sep();

    if (a.analysisStatus !== "completed") {
      console.log(
        `  Skipped — analysisStatus="${a.analysisStatus}"` +
          (a.errorMessage ? `  error: ${a.errorMessage}` : "")
      );
      console.log();
      continue;
    }

    const sriMatchStr =
      Math.abs(a.sriStored - a.sriRecomputed) < 0.002
        ? "✓ matches stored"
        : `✗ MISMATCH  (stored=${r3(a.sriStored)})`;

    console.log(`  SRI (stored):           ${r3(a.sriStored)}`);
    console.log(`  SRI (recomputed):       ${r3(a.sriRecomputed)}  ${sriMatchStr}`);
    console.log(`  SRI (restatements):     ${r3(a.sriRestatements)}  ← new instrument`);
    console.log(
      `  gap (cross-refs share): ${r3(a.sriGap)}  (${pct(a.sriRecomputed > 0 ? a.sriGap / a.sriRecomputed : 0)} of measured redundancy)`
    );

    if (a.sanityFailures > 0) {
      console.log(
        `  ⚠ SANITY FAILURES: ${a.sanityFailures} cluster(s) failed: bareRestatements + refCount ≠ assertionCount − 1`
      );
    }
    if (a.referencedOnlyCount > 0) {
      console.log(
        `  ⚠ REFERENCED-ONLY: ${a.referencedOnlyCount} cluster(s) where every instance is a cross-ref (fact never stated in full)`
      );
    }

    // ── LLM pass (per run) ────────────────────────────────────────────────
    let llmResultMap: Map<number, LLMResult> | undefined;

    if (useLlm && a.clusters.length > 0) {
      console.log(
        `\n  Running LLM disagreement pass (${a.totalInstances} instance(s) in ${a.clusters.length} cluster(s))…`
      );
      const BATCH = 20;

      // Flatten all instances with a sequential 1-based index
      const flat: Array<LLMBatchInput & { clusterRank: number; instIdx: number }> = [];
      let globalIdx = 1;
      for (const ca of a.clusters) {
        for (let i = 0; i < ca.classified.length; i++) {
          flat.push({
            index: globalIdx++,
            chapter: ca.classified[i].chapter,
            text: ca.classified[i].text,
            clusterLabel: ca.label,
            clusterRank: ca.rank,
            instIdx: i,
          });
        }
      }

      const allLLM: LLMResult[] = [];
      for (let b = 0; b < flat.length; b += BATCH) {
        const batch = flat.slice(b, b + BATCH);
        process.stdout.write(`    batch ${Math.floor(b / BATCH) + 1}/${Math.ceil(flat.length / BATCH)}… `);
        const results = await runLLMBatch(batch);
        allLLM.push(...results);
        console.log("done");
      }

      // Build a per-cluster, per-instance lookup
      // Key: clusterRank * 1000 + instIdx (display-index within cluster, 1-based)
      llmResultMap = new Map();
      let flatIdx = 0;
      for (const ca of a.clusters) {
        for (let i = 0; i < ca.classified.length; i++) {
          const llmR = allLLM[flatIdx++];
          if (llmR) {
            // Store under key = display index within this cluster (1-based)
            // We pass clusterRank separately; map key = clusterRank * 10000 + (i+1)
            llmResultMap.set(ca.rank * 10000 + (i + 1), llmR);
          }
        }
      }

      // Count agreements / disagreements
      let agrees = 0;
      let disagrees = 0;
      flatIdx = 0;
      for (const ca of a.clusters) {
        for (let i = 0; i < ca.classified.length; i++) {
          const llmR = allLLM[flatIdx++];
          if (!llmR) continue;
          const heuristicCrossRef = ca.classified[i].label === "cross-ref";
          const llmCrossRef = llmR.classification === "cross_reference";
          if (heuristicCrossRef === llmCrossRef) agrees++;
          else disagrees++;
        }
      }
      console.log(
        `  LLM pass complete: ${agrees} agreements, ${disagrees} disagreements out of ${a.totalInstances} instances.\n`
      );
    }

    // ── Per-cluster detail ────────────────────────────────────────────────
    const topN = Math.min(5, a.clusters.length);
    if (topN > 0) {
      console.log(`\n  Top ${topN} cluster(s) by assertion count:`);
      console.log();
    } else {
      console.log("  No repeated clusters (favoriteFriends is empty or unparseable).");
    }

    for (let ci = 0; ci < topN; ci++) {
      const ca = a.clusters[ci];

      // Build a local LLM result map for this cluster's display: key = display-inst index (1-based)
      let clusterLlmMap: Map<number, LLMResult> | undefined;
      if (llmResultMap) {
        clusterLlmMap = new Map();
        for (let i = 0; i < ca.classified.length; i++) {
          const r = llmResultMap.get(ca.rank * 10000 + (i + 1));
          if (r) clusterLlmMap.set(i + 1, r);
        }
      }

      printClusterDetail(ca, 6, clusterLlmMap);
    }

    if (a.clusters.length > topN) {
      console.log(
        `  (${a.clusters.length - topN} more cluster(s) not shown — all accounted for in the SRI numbers above)\n`
      );
    }
  }

  sep("═");
  console.log("\nDiagnostic complete. No writes were made to the database.");
  console.log("This script is safe to run repeatedly.\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
