/**
 * scripts/diagnose-sri.ts
 *
 * READ-ONLY diagnostic for two observed problems:
 *
 *   PART 1 — The Wobble: same memo scored twice → materially different SRI.
 *            Checks whether memo content changed between runs (Branch A) by
 *            comparing Memo.updatedAt to each ScoringRun.scoredAt.
 *
 *   PART 2 — The Short List: stored SRI > sum(favoriteFriends.assertionCount - 1).
 *            Identifies how many assertions are unaccounted for, walks the raw
 *            stored JSON to see if entries are truly absent or merely miscounted.
 *
 * Usage:
 *   npx tsx scripts/diagnose-sri.ts
 *
 * Requires DATABASE_URL in .env. Writes nothing.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
// Section C dry-run ONLY — mirrors the live scoreMemo redundancy step in memory.
// These are imported but NEVER persist anything; the dry-run writes no DB rows.
import { extractAllClaims } from "../lib/redundancy/extractClaims";
import { embedTexts } from "../lib/redundancy/embed";
import { clusterClaims, SIMILARITY_THRESHOLD } from "../lib/redundancy/cluster";
import { computeMetrics } from "../lib/redundancy/metrics";

// ── Prisma client ─────────────────────────────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ── Types (mirroring lib/redundancy/types.ts) ─────────────────────────────
interface FFInstance { chapter: string; text: string; }
interface FavoriteFriend {
  rank: number;
  label: string;
  assertionCount: number;
  chapterSpread: number;
  chapters: string[];
  instances: FFInstance[];
}

// ── Helpers ───────────────────────────────────────────────────────────────
const r3 = (n: number) => n.toFixed(3);
const col  = (s: string | number, w: number) => String(s).slice(0, w).padEnd(w);
const colR = (s: string | number, w: number) => String(s).slice(0, w).padStart(w);
function sep(char = "─", n = 80): void { console.log(char.repeat(n)); }
const snippet = (s: string, max = 90) => s.length > max ? s.slice(0, max) + "…" : s;

// ── Parse favoriteFriends JSON (permissive — report parse errors rather than null) ──
interface ParseResult {
  ok: boolean;
  friends: FavoriteFriend[];
  parseErrors: string[];
}

function parseFavoriteFriends(raw: unknown): ParseResult {
  const errors: string[] = [];
  if (!Array.isArray(raw)) {
    return { ok: false, friends: [], parseErrors: [`Not an array (got ${typeof raw})`] };
  }

  const friends: FavoriteFriend[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;
    if (typeof item !== "object" || item === null) {
      errors.push(`[${i}] not an object`); continue;
    }
    if (typeof item.rank !== "number") {
      errors.push(`[${i}] rank is ${typeof item.rank} (expected number)`);
    }
    if (typeof item.assertionCount !== "number") {
      errors.push(`[${i}] assertionCount is ${typeof item.assertionCount} (expected number)`);
    }
    if (!Array.isArray(item.instances)) {
      errors.push(`[${i}] instances is ${typeof item.instances} (expected array)`);
    }
    // Push the entry regardless — we want to see all entries
    friends.push({
      rank:           typeof item.rank           === "number" ? item.rank           : -1,
      label:          typeof item.label          === "string" ? item.label          : "(no label)",
      assertionCount: typeof item.assertionCount === "number" ? item.assertionCount : 0,
      chapterSpread:  typeof item.chapterSpread  === "number" ? item.chapterSpread  : 0,
      chapters:       Array.isArray(item.chapters) ? (item.chapters as string[]) : [],
      instances:      Array.isArray(item.instances) ? (item.instances as FFInstance[]) : [],
    });
  }
  return { ok: errors.length === 0, friends, parseErrors: errors };
}

// ── Claim-set reconciliation for one run (Section A) ──────────────────────
//
// SRI = (claimCount − uniqueClusterCount) / claimCount is a pure-function
// identity, so it is always self-consistent. The useful check is whether
// claimCount, uniqueClusterCount, and the saved favoriteFriends describe the
// SAME set of claims — i.e. whether every counted claim actually landed in a
// cluster. Reconstruct the claim total from the saved list:
//
//   multiClusterCount   = favoriteFriends.length              (clusters of size > 1)
//   sumAssertions       = Σ assertionCount over favoriteFriends
//   singletons          = uniqueClusterCount − multiClusterCount  (clusters of size 1)
//   reconstructedClaims = sumAssertions + singletons
//   unaccounted         = claimCount − reconstructedClaims
//
//   unaccounted == 0  → claimCount, uniqueClusterCount, favoriteFriends are
//                       mutually consistent; the run is clean.
//   unaccounted >  0  → that many claims were counted in claimCount but never
//                       landed in ANY cluster (not even as singletons). The
//                       redundancy is genuinely missing from the saved data —
//                       NOT a parser artifact.
//
// `unaccounted` is algebraically identical to the redundant-assertion gap
//   gap = (claimCount − uniqueClusterCount) − Σ(assertionCount − 1)
// — the script prints both and confirms they match.
interface Reconciliation {
  sriStored:           number;
  claimCount:          number;
  uniqueClusterCount:  number;
  expectedRedundant:   number;   // claimCount − uniqueClusterCount
  sriImplied:          number;   // expectedRedundant / claimCount (identity check)
  ffCount:             number;   // favoriteFriends entries in stored JSON
  ffRedundant:         number;   // sum(ff.assertionCount − 1) over stored entries
  ffSRI:               number;   // ffRedundant / claimCount

  // Section A — claim-set reconciliation
  multiClusterCount:   number;   // favoriteFriends.length (clusters of size > 1)
  sumAssertions:       number;   // Σ assertionCount over favoriteFriends
  singletons:          number;   // uniqueClusterCount − multiClusterCount
  reconstructedClaims: number;   // sumAssertions + singletons
  unaccounted:         number;   // claimCount − reconstructedClaims  (== gap)

  gap:                 number;   // expectedRedundant − ffRedundant  (>0 = missing clusters)
  parseErrors:         string[];
}

function reconcile(row: {
  sri: number;
  claimCount: number;
  uniqueClusterCount: number;
  favoriteFriends: unknown;
}): Reconciliation {
  const expectedRedundant = row.claimCount - row.uniqueClusterCount;
  const sriImplied = row.claimCount > 0 ? expectedRedundant / row.claimCount : 0;

  const { friends, parseErrors } = parseFavoriteFriends(row.favoriteFriends);
  const ffRedundant = friends.reduce((s, f) => s + Math.max(0, f.assertionCount - 1), 0);
  const ffSRI = row.claimCount > 0 ? ffRedundant / row.claimCount : 0;
  const gap = expectedRedundant - ffRedundant;

  // Section A — claim-set reconciliation (saved fields only)
  const multiClusterCount   = friends.length;
  const sumAssertions       = friends.reduce((s, f) => s + Math.max(0, f.assertionCount), 0);
  const singletons          = row.uniqueClusterCount - multiClusterCount;
  const reconstructedClaims = sumAssertions + singletons;
  const unaccounted         = row.claimCount - reconstructedClaims;

  return {
    sriStored:          row.sri,
    claimCount:         row.claimCount,
    uniqueClusterCount: row.uniqueClusterCount,
    expectedRedundant,
    sriImplied:         Math.round(sriImplied * 1000) / 1000,
    ffCount:            friends.length,
    ffRedundant,
    ffSRI:              Math.round(ffSRI * 1000) / 1000,
    multiClusterCount,
    sumAssertions,
    singletons,
    reconstructedClaims,
    unaccounted,
    gap,
    parseErrors,
  };
}

// ── SECTION C: code-read summary (printed in every run) ────────────────────
function printMechanismCodeRead(): void {
  sep("═");
  console.log("SECTION C — MECHANISM (code read of the CURRENT live path)");
  sep();
  console.log(`
  embed.ts (lib/redundancy/embed.ts):
    • Sparse-array pattern IS still present:
        line 33  const allEmbeddings: number[][] = new Array(texts.length);
        line 55  allEmbeddings[i + item.index] = item.embedding;
      'i' is the batch offset, item.index is batch-relative → global index is correct,
      but any input the API omits from a batch leaves an UNDEFINED hole in the array.

  scoreMemo.ts (inngest/functions/scoreMemo.ts):
    • Downstream fallback IS present:
        line 615  const vectors = await embedTexts(claims.map((c) => c.text));
        line 618  embedding: vectors[i] ?? [],
      A hole therefore becomes an EMPTY [] embedding rather than throwing.

  WHERE DOES claimCount COME FROM? (the decisive question)
    • claimCount is NOT claims.length. computeMetrics derives it from the clusters:
        metrics.ts line 33  const totalClaims = clusters.reduce((s,c) => s + c.assertionCount, 0);
    • clusterClaims (cluster.ts) builds a UnionFind over ALL claims — including those
      with an empty [] embedding. cosineSimilarity returns 0 for a zero-norm vector
      (cluster.ts line 41), so an empty-embedding claim never unions and falls out as a
      SINGLETON cluster — it is still counted in BOTH claimCount and uniqueClusterCount.
    • Consequence: in the CURRENT code, claimCount and uniqueClusterCount are derived
      from the same cluster set, so they are mutually consistent BY CONSTRUCTION and
      unaccounted is ALWAYS 0. An empty embedding degrades clustering QUALITY (a missed
      paraphrase) but cannot make a claim vanish from the counts.

  PERSIST STEP (saved-list drop ruled out):
    • scoreMemo.ts line 635  favoriteFriends: metrics.favoriteFriends as never
      writes the list with NO intermediate filter or slice. The only filter is in
      metrics.ts line 51 (assertionCount > 1, the singleton exclusion) — which the
      reconciliation already accounts for via the 'singletons' term.

  IMPLICATION FOR THE WIPE:
    • The current pipeline is structurally incapable of producing unaccounted > 0.
      Any stored run with unaccounted > 0 was written by an OLDER version that took
      claimCount BEFORE an embedding-failure filter while clustering only the survivors
      (a pre-clustering drop). That is stale data — re-scoring resolves it.
    • The optional --dry-run below is the conclusive live confirmation.
`);
}

// ── SECTION C: optional live dry-run (persists NOTHING) ─────────────────────
// Runs ONE memo through the current extract→embed→cluster→computeMetrics path
// in memory and asserts unaccounted == 0 and zero empty embeddings. Calls the
// model + embeddings API. Writes no DB rows, no ScoringRun, no files.
async function dryRun(prisma: PrismaClient, memoIdArg: number | null): Promise<void> {
  sep("═");
  console.log("SECTION C — LIVE DRY-RUN  (current pipeline, persists NOTHING)");
  sep();

  // Pick the memo: explicit id, else the most recently updated one with chapters.
  const memo = memoIdArg
    ? await prisma.memo.findUnique({ where: { id: memoIdArg }, select: { id: true, name: true, chapters: true } })
    : await prisma.memo.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, chapters: true },
      });

  if (!memo) { console.log(`  No memo found${memoIdArg ? ` for id ${memoIdArg}` : ""}.`); return; }

  const chapters = Array.isArray(memo.chapters)
    ? (memo.chapters as Array<{ title: string; text: string; scored?: boolean }>)
    : [];
  const scoredChapters = chapters.filter((c) => c.scored);
  console.log(`  Memo #${memo.id} "${memo.name}" — ${scoredChapters.length} scored chapter(s).`);
  if (scoredChapters.length === 0) { console.log("  No scored chapters; nothing to run."); return; }

  // Mirror scoreMemo.ts exactly — extract → embed → cluster → metrics, in memory.
  const claims = await extractAllClaims(scoredChapters.map((c) => ({ title: c.title, text: c.text })));
  console.log(`  Extracted ${claims.length} atomic claim(s).`);
  if (claims.length === 0) { console.log("  No claims extracted; nothing to run."); return; }

  const vectors = await embedTexts(claims.map((c) => c.text));
  const claimsWithEmbeddings = claims.map((c, i) => ({ ...c, embedding: vectors[i] ?? [] }));
  const emptyEmbeddings = claimsWithEmbeddings.filter((c) => c.embedding.length === 0).length;

  const clusters = clusterClaims(claimsWithEmbeddings, SIMILARITY_THRESHOLD);
  const metrics = computeMetrics(clusters, SIMILARITY_THRESHOLD);

  // Reconcile the in-memory result exactly as Section A does for stored rows.
  const rec = reconcile({
    sri: metrics.sri,
    claimCount: metrics.claimCount,
    uniqueClusterCount: metrics.uniqueClusterCount,
    favoriteFriends: metrics.favoriteFriends,
  });

  console.log(`  claimCount=${rec.claimCount}  uniqueClusterCount=${rec.uniqueClusterCount}  ` +
    `multiClusters=${rec.multiClusterCount}  singletons=${rec.singletons}`);
  console.log(`  reconstructedClaims=${rec.reconstructedClaims}  unaccounted=${rec.unaccounted}  ` +
    `(gap=${rec.gap})  emptyEmbeddings=${emptyEmbeddings}`);
  console.log();

  const unaccOk = rec.unaccounted === 0;
  const emptyOk = emptyEmbeddings === 0;
  console.log(`  ASSERT unaccounted == 0 : ${unaccOk ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`  ASSERT no empty []      : ${emptyOk ? "✓ PASS" : `✗ FAIL (${emptyEmbeddings} empty)`}`);
  console.log();
  if (unaccOk && emptyOk) {
    console.log("  ➜ Current pipeline produces a fully-reconciled result with no dropped claims.");
  } else {
    console.log("  ➜ Current pipeline did NOT reconcile — investigate before any wipe.");
  }
  console.log("\n  (Dry-run persisted nothing: no DB rows, no ScoringRun, no files.)");
}

// ── CLI parsing ─────────────────────────────────────────────────────────
// --dry-run            run Section C live dry-run on the most-recent memo (calls model)
// --dry-run=<memoId>   run Section C live dry-run on a specific memo
function parseDryRunArg(argv: string[]): { dryRun: boolean; memoId: number | null } {
  const flag = argv.find((a) => a === "--dry-run" || a.startsWith("--dry-run="));
  if (!flag) return { dryRun: false, memoId: null };
  const eq = flag.indexOf("=");
  const id = eq >= 0 ? Number(flag.slice(eq + 1)) : NaN;
  return { dryRun: true, memoId: Number.isFinite(id) ? id : null };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(
    "\n╔══════════════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║       diagnose-sri.ts  —  READ-ONLY diagnostic                          ║"
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════════════╝\n"
  );

  const { dryRun: doDryRun, memoId: dryRunMemoId } = parseDryRunArg(process.argv.slice(2));

  // Fetch all redundancy rows + scoring run + memo timestamps
  const rows = await prisma.redundancyAnalysis.findMany({
    orderBy: { id: "asc" },
    include: {
      scoringRun: {
        select: {
          id: true,
          memoId: true,
          rubricVersion: true,
          statusBadge: true,
          scoredAt: true,
          scorerId: true,
          memo: {
            select: {
              id: true,
              name: true,
              typology: true,
              createdAt: true,
              updatedAt: true,
              // We do NOT select content (can be large) unless needed
            },
          },
        },
      },
    },
  });

  if (rows.length === 0) {
    console.log("No RedundancyAnalysis rows found.");
    await prisma.$disconnect();
    return;
  }

  console.log(`${rows.length} RedundancyAnalysis row(s) found.\n`);

  // ── PART 1 SETUP: group runs by memo to find re-scored pairs ──────────────
  const byMemo = new Map<number, typeof rows>();
  for (const row of rows) {
    const mid = row.scoringRun.memoId;
    if (!byMemo.has(mid)) byMemo.set(mid, []);
    byMemo.get(mid)!.push(row);
  }

  // ── PART 1: Wobble — timestamp check ─────────────────────────────────────
  sep("═");
  console.log("PART 1 — WOBBLE CHECK  (memos with multiple scoring runs)");
  sep();

  const wobbleMemos = Array.from(byMemo.entries())
    .filter(([, runs]) => runs.length > 1)
    .sort((a, b) => a[0] - b[0]);

  if (wobbleMemos.length === 0) {
    console.log("No memo has been scored more than once — cannot check wobble.");
  } else {
    for (const [memoId, memoRows] of wobbleMemos) {
      const memo = memoRows[0].scoringRun.memo;
      console.log(`\nMemo #${memoId}: "${memo.name}"  (${memo.typology})`);
      console.log(`  memo.createdAt : ${memo.createdAt.toISOString()}`);
      console.log(`  memo.updatedAt : ${memo.updatedAt.toISOString()}`);

      // Sort runs by scoredAt
      const sorted = [...memoRows].sort(
        (a, b) => a.scoringRun.scoredAt.getTime() - b.scoringRun.scoredAt.getTime()
      );

      console.log(`  ${sorted.length} runs:`);
      for (const row of sorted) {
        const rec = reconcile(row);
        const scoredAt = row.scoringRun.scoredAt;

        // Did memo content change before this run?
        const memoChangedBeforeThisRun = memo.updatedAt > memo.createdAt;
        const updateFellBeforeThisRun =
          memo.updatedAt.getTime() > memo.createdAt.getTime() &&
          memo.updatedAt.getTime() < scoredAt.getTime();
        const updateFellBetween = sorted.length >= 2 && (() => {
          // Check if updatedAt falls strictly between previous run and this one
          const idx = sorted.indexOf(row);
          if (idx === 0) return false;
          const prevScoredAt = sorted[idx - 1].scoringRun.scoredAt;
          return (
            memo.updatedAt.getTime() > prevScoredAt.getTime() &&
            memo.updatedAt.getTime() < scoredAt.getTime()
          );
        })();

        const changeFlag = updateFellBetween
          ? "  ← ⚠ memo.updatedAt fell BETWEEN prev run and this run"
          : updateFellBeforeThisRun && !memoChangedBeforeThisRun
          ? ""
          : "";

        console.log(
          `    raId=${col(row.id, 4)} srId=${col(row.scoringRun.id, 4)}  ` +
            `scoredAt=${scoredAt.toISOString()}  ` +
            `status=${row.analysisStatus}  ` +
            `claims=${colR(rec.claimCount, 4)}  ` +
            `sri=${r3(rec.sriStored)}${changeFlag}`
        );
      }

      // Summary: did content change?
      const firstScored = sorted[0].scoringRun.scoredAt;
      const lastScored  = sorted[sorted.length - 1].scoringRun.scoredAt;
      const updatedBetweenRuns =
        memo.updatedAt.getTime() > firstScored.getTime() &&
        memo.updatedAt.getTime() < lastScored.getTime();
      const updatedBeforeAllRuns = memo.updatedAt.getTime() <= firstScored.getTime();

      if (updatedBetweenRuns) {
        console.log(
          `  ➜ Branch A evidence: memo.updatedAt (${memo.updatedAt.toISOString()}) falls`
        );
        console.log(
          `    BETWEEN the first and last scoring run → content likely changed mid-series.`
        );
      } else if (updatedBeforeAllRuns) {
        const sriValues = sorted
          .filter((r) => r.analysisStatus === "completed")
          .map((r) => r.sri);
        const sriVariance = sriValues.length >= 2
          ? Math.abs(sriValues[sriValues.length - 1] - sriValues[0])
          : 0;
        if (sriVariance >= 0.05) {
          console.log(
            `  ➜ memo.updatedAt is at/before ALL scoring runs — content appears unchanged.`
          );
          console.log(
            `    SRI variance = ${r3(sriVariance)} despite stable content → Branch C evidence`
          );
          console.log(
            `    (provider-side non-determinism or model-version drift at temperature 0).`
          );
        } else {
          console.log(`  ➜ memo.updatedAt before all runs; SRI variance small (${r3(sriVariance)}) — stable.`);
        }
      } else {
        console.log(`  ➜ memo.updatedAt is after all scoring runs — unusual; check for clock skew.`);
      }
    }
  }
  console.log();

  // ── PART 2: Short list — SRI vs favoriteFriends reconciliation ────────────
  sep("═");
  console.log("PART 2 — SHORT LIST CHECK  (stored SRI vs persisted favoriteFriends)");
  sep();
  console.log(
    col("raId", 5) +
      col("srId", 5) +
      col("memo", 20) +
      colR("claims", 7) +
      colR("uniq", 6) +
      colR("expRed", 7) +
      colR("sri✓", 8) +
      colR("#FF", 5) +
      colR("ffRed", 7) +
      colR("gap", 7) +
      "  parseErr"
  );
  sep("-");

  for (const row of rows) {
    if (row.analysisStatus !== "completed") {
      console.log(
        col(row.id, 5) +
          col(row.scoringRun.id, 5) +
          col(row.scoringRun.memo.name, 20) +
          "  — " + row.analysisStatus
      );
      continue;
    }
    const rec = reconcile(row);
    const sriCheck = Math.abs(rec.sriStored - rec.sriImplied) < 0.002 ? "✓" : "✗";
    const gapStr = rec.gap > 0 ? `+${rec.gap}  ⚠` : String(rec.gap);
    console.log(
      col(row.id, 5) +
        col(row.scoringRun.id, 5) +
        col(row.scoringRun.memo.name, 20) +
        colR(rec.claimCount, 7) +
        colR(rec.uniqueClusterCount, 6) +
        colR(rec.expectedRedundant, 7) +
        colR(r3(rec.sriStored) + sriCheck, 8) +
        colR(rec.ffCount, 5) +
        colR(rec.ffRedundant, 7) +
        colR(gapStr, 7) +
        (rec.parseErrors.length > 0 ? `  ${rec.parseErrors.length} err(s)` : "")
    );
  }
  console.log();

  // ── Deep-dive: full JSON accounting for runs with a gap > 0 ──────────────
  sep("═");
  console.log("DEEP-DIVE: runs where gap > 0  (full favoriteFriends accounting)");
  sep();

  const gappedRows = rows.filter((r) => {
    if (r.analysisStatus !== "completed") return false;
    const rec = reconcile(r);
    return rec.gap > 0;
  });

  if (gappedRows.length === 0) {
    console.log("No gap found — stored SRI matches persisted favoriteFriends on all runs.");
    console.log(
      "(If the split-redundancy script showed a gap, the cause was in that script's " +
        "parseFavoriteFriends returning null, not in the stored data itself.)"
    );
  } else {
    for (const row of gappedRows) {
      const rec = reconcile(row);
      console.log(
        `\nraId=${row.id}  srId=${row.scoringRun.id}  memo="${row.scoringRun.memo.name}"  ` +
          `gap=${rec.gap} missing assertions`
      );
      console.log(
        `  expectedRedundant=${rec.expectedRedundant}  ffRedundant=${rec.ffRedundant}  ` +
          `gap=${rec.gap}`
      );
      console.log(`  claimCount=${rec.claimCount}  uniqueClusterCount=${rec.uniqueClusterCount}  sriStored=${r3(rec.sriStored)}`);

      const { friends, parseErrors } = parseFavoriteFriends(row.favoriteFriends);
      if (parseErrors.length > 0) {
        console.log(`  Parse errors (${parseErrors.length}):`);
        parseErrors.forEach((e) => console.log(`    ${e}`));
      }

      console.log(`\n  Stored favoriteFriends entries (${friends.length} total):`);
      const totalAccountedFor = friends.reduce((s, f) => s + f.assertionCount, 0);
      const totalRedundant    = friends.reduce((s, f) => s + Math.max(0, f.assertionCount - 1), 0);
      console.log(
        `  sum(assertionCount) = ${totalAccountedFor}  sum(assertionCount-1) = ${totalRedundant}`
      );
      console.log(
        `  Missing claims: ${rec.claimCount - totalAccountedFor - rec.uniqueClusterCount + friends.length} ` +
          `singleton clusters + ${rec.gap} redundant-assertion-bearing clusters not in FF`
      );
      console.log();

      // Print every FF entry in compact form
      for (const ff of friends) {
        const instLen = ff.instances.length;
        const acMismatch = instLen !== ff.assertionCount ? `  ← instances.length(${instLen}) ≠ assertionCount(${ff.assertionCount})` : "";
        console.log(
          `  [#${ff.rank}] assertionCount=${ff.assertionCount}  instances=${instLen}  spread=${ff.chapterSpread}${acMismatch}`
        );
        console.log(`         label: "${snippet(ff.label)}"`);
      }

      // Are there raw JSON entries beyond what parseFavoriteFriends captured?
      const rawLen = Array.isArray(row.favoriteFriends) ? (row.favoriteFriends as unknown[]).length : "N/A";
      console.log(`\n  Raw JSON array length (direct): ${rawLen}`);
      console.log(`  parseFavoriteFriends returned:  ${friends.length}`);
      if (rawLen !== friends.length) {
        console.log(`  ⚠ MISMATCH: raw array has ${rawLen} entries but parser returned ${friends.length}.`);
        console.log(`  Parse errors above explain which entries were problematic.`);
      }
      console.log();
    }
  }

  // ── SECTION A: claim-set reconciliation ───────────────────────────────────
  sep("═");
  console.log("SECTION A — CLAIM-SET RECONCILIATION  (every counted claim should land in a cluster)");
  sep();
  console.log(
    col("raId", 5) +
      col("memo", 20) +
      colR("claims", 7) +
      colR("uniq", 6) +
      colR("multi", 6) +
      colR("sumAsrt", 8) +
      colR("singl", 6) +
      colR("recon", 7) +
      colR("unacct", 8) +
      colR("gap", 6) +
      "  match?"
  );
  sep("-");

  const completedRows = rows.filter((r) => r.analysisStatus === "completed");
  let allFormulasMatch = true;
  let cleanRuns = 0;
  let dirtyRuns = 0;
  const recById = new Map<number, Reconciliation>();

  for (const row of rows) {
    if (row.analysisStatus !== "completed") {
      console.log(col(row.id, 5) + col(row.scoringRun.memo.name, 20) + "  — " + row.analysisStatus);
      continue;
    }
    const rec = reconcile(row);
    recById.set(row.id, rec);
    // The two gap formulas MUST be equal: unaccounted === gap (algebraic identity).
    const formulaMatch = rec.unaccounted === rec.gap;
    if (!formulaMatch) allFormulasMatch = false;
    if (rec.unaccounted === 0) cleanRuns++; else dirtyRuns++;

    const unacctStr = rec.unaccounted > 0 ? `+${rec.unaccounted} ⚠` : String(rec.unaccounted);
    const matchStr = formulaMatch ? "✓ (==gap)" : `✗ ${rec.unaccounted}≠${rec.gap}`;
    console.log(
      col(row.id, 5) +
        col(row.scoringRun.memo.name, 20) +
        colR(rec.claimCount, 7) +
        colR(rec.uniqueClusterCount, 6) +
        colR(rec.multiClusterCount, 6) +
        colR(rec.sumAssertions, 8) +
        colR(rec.singletons, 6) +
        colR(rec.reconstructedClaims, 7) +
        colR(unacctStr, 8) +
        colR(rec.gap, 6) +
        "  " + matchStr +
        (rec.parseErrors.length > 0 ? `  (${rec.parseErrors.length} parseErr)` : "")
    );
  }
  console.log();
  console.log(
    `  Formula equality (unaccounted === gap): ${allFormulasMatch ? "✓ all rows match" : "✗ MISMATCH — see ✗ rows above"}`
  );
  console.log(`  Clean runs (unaccounted == 0): ${cleanRuns}    Dirty runs (unaccounted > 0): ${dirtyRuns}`);
  console.log(
    "  unaccounted == 0 → claimCount / uniqueClusterCount / favoriteFriends are mutually consistent."
  );
  console.log(
    "  unaccounted >  0 → that many claims were counted but never landed in any cluster (genuinely"
  );
  console.log(
    "                     missing from saved data — NOT a parser artifact: the permissive parser counts"
  );
  console.log(
    "                     every entry, and split-redundancy.ts already produced non-zero recomputed SRIs"
  );
  console.log(
    "                     on the mismatch runs, which is impossible if the parser had bailed."
  );
  console.log();

  // ── SECTION B: version segmentation ────────────────────────────────────────
  sep("═");
  console.log("SECTION B — VERSION SEGMENTATION  (is unaccounted > 0 confined to older runs?)");
  sep();

  // rubricVersion — report, but note if uniform (cannot discriminate)
  const rubricVersions = new Set(completedRows.map((r) => r.scoringRun.rubricVersion));
  console.log(`\n  rubricVersion label(s): ${Array.from(rubricVersions).map((v) => `"${v}"`).join(", ")}`);
  if (rubricVersions.size <= 1) {
    console.log("    → identical across all runs; this field CANNOT discriminate versions.");
  }

  // Helper to summarize a group
  function summarize(label: string, group: typeof completedRows): void {
    if (group.length === 0) { console.log(`  ${label}: (no runs)`); return; }
    const recs = group.map((r) => recById.get(r.id)!);
    const dirty = recs.filter((rc) => rc.unaccounted > 0);
    const totalUnacct = recs.reduce((s, rc) => s + rc.unaccounted, 0);
    console.log(
      `  ${label}: ${group.length} run(s), ${dirty.length} with unaccounted>0, ` +
        `total unaccounted=${totalUnacct}`
    );
  }

  // Group by threshold (0.85 = pre-recalibration, 0.70 = current)
  console.log("\n  By cosine threshold (0.85 = pre-recalibration, 0.70 = current):");
  const thresholds = Array.from(new Set(completedRows.map((r) => r.threshold))).sort((a, b) => b - a);
  for (const t of thresholds) {
    summarize(`threshold=${t}`, completedRows.filter((r) => r.threshold === t));
  }

  // Group by scoredAt date bucket (YYYY-MM-DD)
  console.log("\n  By scoredAt date bucket:");
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);
  const dateBuckets = Array.from(new Set(completedRows.map((r) => dateKey(r.scoringRun.scoredAt)))).sort();
  for (const dk of dateBuckets) {
    summarize(`scoredAt ${dk}`, completedRows.filter((r) => dateKey(r.scoringRun.scoredAt) === dk));
  }

  // ── QUESTION 1 VERDICT ──────────────────────────────────────────────────
  // Recency is CHRONOLOGICAL (scoredAt), not threshold-based. Note that
  // threshold does NOT discriminate dirty from clean here: 0.85 is the OLDEST
  // batch and is fully clean, while the dirty runs share threshold 0.70 with
  // the clean newest batch. So order strictly by scoredAt and ask whether the
  // most recent runs are clean.
  console.log();
  sep("-");
  const byTime = [...completedRows].sort(
    (a, b) => a.scoringRun.scoredAt.getTime() - b.scoringRun.scoredAt.getTime()
  );
  const dirtyByTime = byTime.filter((r) => recById.get(r.id)!.unaccounted > 0);
  const latestDirty = dirtyByTime[dirtyByTime.length - 1];
  const cleanAfterLastDirty = latestDirty
    ? byTime.filter(
        (r) =>
          r.scoringRun.scoredAt.getTime() > latestDirty.scoringRun.scoredAt.getTime()
      ).length
    : byTime.length;
  const latestDate = dateBuckets[dateBuckets.length - 1];
  const latestBucketDirty = completedRows.filter(
    (r) => dateKey(r.scoringRun.scoredAt) === latestDate && recById.get(r.id)!.unaccounted > 0
  ).length;
  const mostRecentRun = byTime[byTime.length - 1];
  const mostRecentDirty = recById.get(mostRecentRun.id)!.unaccounted > 0;

  console.log("QUESTION 1 — Is unaccounted > 0 present in the most recent runs, or only in older ones?");
  console.log(`  Total dirty runs: ${dirtyRuns}.`);
  if (latestDirty) {
    console.log(
      `  Most recent dirty run: raId=${latestDirty.id} @ ${latestDirty.scoringRun.scoredAt.toISOString()}.`
    );
    console.log(`  Clean runs scored AFTER that last dirty run: ${cleanAfterLastDirty}.`);
  }
  console.log(
    `  Latest date bucket "${latestDate}": ${latestBucketDirty} dirty run(s).  ` +
      `Most recent run overall (raId=${mostRecentRun.id}): ${mostRecentDirty ? "DIRTY" : "clean"}.`
  );
  console.log();
  if (dirtyRuns === 0) {
    console.log("  VERDICT: No run has unaccounted > 0. All saved data reconciles cleanly.");
  } else if (!mostRecentDirty && latestBucketDirty === 0) {
    console.log("  VERDICT: unaccounted > 0 is CONFINED TO OLDER RUNS. The most recent batch reconciles");
    console.log("           cleanly (every run scored after the last dirty one is clean). This is stale");
    console.log("           data from an earlier code version — corroborated by Section C, which shows");
    console.log("           the current pipeline is structurally incapable of producing unaccounted > 0.");
    console.log("           → Re-scoring under the current version is expected to resolve it. Safe to");
    console.log("             wipe + re-score.");
  } else {
    console.log("  VERDICT: unaccounted > 0 is PRESENT IN THE MOST RECENT RUNS. Treat as a possible LIVE");
    console.log("           bug — run Section C --dry-run to confirm before any wipe. DO NOT wipe until");
    console.log("           the current pipeline is shown to reconcile.");
  }
  console.log();

  // ── Summary: arithmetic identity check ───────────────────────────────────
  sep("═");
  console.log("ARITHMETIC IDENTITY CHECK  (SRI = (claimCount - uniqueClusterCount) / claimCount)");
  sep();
  let allMatch = true;
  for (const row of rows) {
    if (row.analysisStatus !== "completed") continue;
    const rec = reconcile(row);
    const diff = Math.abs(rec.sriStored - rec.sriImplied);
    if (diff >= 0.002) {
      allMatch = false;
      console.log(
        `  raId=${row.id} MISMATCH: sriStored=${r3(rec.sriStored)}  sriImplied=${r3(rec.sriImplied)}  diff=${diff.toFixed(4)}`
      );
    }
  }
  if (allMatch) {
    console.log(
      "  All completed runs pass: sri == (claimCount - uniqueClusterCount) / claimCount  (within 0.002 rounding)."
    );
    console.log(
      "  This confirms: uniqueClusterCount and claimCount are internally consistent — the gap lives entirely"
    );
    console.log(
      "  in the favoriteFriends JSON being incomplete, not in the SRI/count fields being wrong."
    );
  }
  console.log();

  // ── SECTION C: mechanism code-read (always) + optional live dry-run ───────
  printMechanismCodeRead();
  if (doDryRun) {
    console.log();
    await dryRun(prisma, dryRunMemoId);
  } else {
    console.log("\n  (Live dry-run skipped. Run with --dry-run [--dry-run=<memoId>] to confirm the");
    console.log("   current pipeline produces unaccounted == 0 with no empty embeddings.)");
  }
  console.log();

  sep("═");
  console.log("\nDiagnostic complete. No writes were made to the database.\n");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
