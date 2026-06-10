/**
 * scripts/test-extraction-variance.ts
 *
 * READ-ONLY: loads one memo's text from the DB, calls extractAllClaims
 * THREE TIMES at temperature 0, then prints and diffs the three claim sets.
 *
 * This answers empirically whether extraction is a variance source:
 *   • If all three runs return the same claims  → Branch C is unlikely; wobble
 *     is more likely Branch A (memo content changed) or provider-side sampling
 *     that happened to be stable in this test.
 *   • If the three runs differ in count or content → Branch C confirmed:
 *     temperature 0 is not producing a deterministic output on this
 *     model/provider combination, and the SRI cannot be used for clean
 *     before/after comparison without claim-set stabilisation.
 *
 * Usage:
 *   npx tsx scripts/test-extraction-variance.ts [memoId]
 *   npx tsx scripts/test-extraction-variance.ts 4       # test Ecolab
 *   npx tsx scripts/test-extraction-variance.ts 11      # test Pasha
 *   npx tsx scripts/test-extraction-variance.ts 4 11    # test both (default if no args)
 *
 * Requires: DATABASE_URL and OPENROUTER_API_KEY in .env
 * Writes nothing. Spends ~3 LLM calls per memo.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { splitChapters } from "../lib/ingest/splitChapters";
import { extractAllClaims } from "../lib/redundancy/extractClaims";

// ── Prisma client ─────────────────────────────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ── Helpers ───────────────────────────────────────────────────────────────
function sep(char = "─", n = 80): void { console.log(char.repeat(n)); }
const snippet = (s: string, max = 110) => s.length > max ? s.slice(0, max) + "…" : s;

// ── Diff two claim-text sets ──────────────────────────────────────────────
//
// "Same" is defined as exact text match (case-sensitive) after trimming.
// We don't use semantic similarity here — only exact matches. The point is
// to detect whether the LLM adds, drops, or rephrases claims across runs.
interface DiffResult {
  inANotB: string[];    // claims in set A but not B
  inBNotA: string[];    // claims in set B but not A
  commonCount: number;
}

function diffClaimSets(a: string[], b: string[]): DiffResult {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    inANotB: a.filter((c) => !setB.has(c)),
    inBNotA: b.filter((c) => !setA.has(c)),
    commonCount: a.filter((c) => setB.has(c)).length,
  };
}

// ── Run three extractions and report ──────────────────────────────────────
async function testMemo(memoId: number): Promise<void> {
  sep("═");
  console.log(`MEMO #${memoId} — extraction variance test`);
  sep();

  // Load memo from DB
  const memo = await prisma.memo.findUnique({
    where: { id: memoId },
    select: { id: true, name: true, content: true, updatedAt: true },
  });

  if (!memo) {
    console.log(`  Memo #${memoId} not found in database.`);
    return;
  }
  if (!memo.content) {
    console.log(`  Memo #${memoId} ("${memo.name}") has no content stored.`);
    return;
  }

  console.log(`  name      : "${memo.name}"`);
  console.log(`  updatedAt : ${memo.updatedAt.toISOString()}`);
  console.log(`  content   : ${memo.content.length} chars`);

  // Split into chapters exactly as the scoring pipeline does
  const allChapters = splitChapters(memo.content);
  const scoredChapters = allChapters.filter((c) => c.scored);
  console.log(
    `  chapters  : ${allChapters.length} total, ${scoredChapters.length} scored`
  );
  console.log(
    `  chapter titles (scored): ${scoredChapters.map((c) => `"${c.title}"`).join(", ")}`
  );
  console.log();

  if (scoredChapters.length === 0) {
    console.log("  No scored chapters — skipping extraction test.");
    return;
  }

  const extractionInput = scoredChapters.map((c) => ({ title: c.title, text: c.text }));

  // Run 3 extractions
  const allRuns: Array<{ texts: string[]; elapsed: number }> = [];
  for (let run = 1; run <= 3; run++) {
    process.stdout.write(`  Run ${run}/3… `);
    const start = Date.now();
    const claims = await extractAllClaims(extractionInput);
    const elapsed = Date.now() - start;
    allRuns.push({ texts: claims.map((c) => c.text), elapsed });
    console.log(`done (${claims.length} claims, ${elapsed}ms)`);
  }

  console.log();

  // Print claim counts
  console.log(
    `  Claim counts: ${allRuns.map((r, i) => `run${i + 1}=${r.texts.length}`).join("  ")}`
  );
  const allSameCount = allRuns.every((r) => r.texts.length === allRuns[0].texts.length);
  console.log(`  Counts identical: ${allSameCount ? "YES" : "NO  ← different extraction depth"}`);
  console.log();

  // Pairwise diffs
  const pairs: Array<[number, number]> = [[0, 1], [0, 2], [1, 2]];
  for (const [i, j] of pairs) {
    const d = diffClaimSets(allRuns[i].texts, allRuns[j].texts);
    const total = Math.max(allRuns[i].texts.length, allRuns[j].texts.length);
    const exactMatch = d.inANotB.length === 0 && d.inBNotA.length === 0;
    console.log(
      `  run${i + 1} vs run${j + 1}: ` +
        `common=${d.commonCount}/${total}  ` +
        `only-in-${i + 1}=${d.inANotB.length}  ` +
        `only-in-${j + 1}=${d.inBNotA.length}  ` +
        (exactMatch ? "IDENTICAL ✓" : "DIFFER ✗")
    );
    if (!exactMatch) {
      // Show first few claims unique to each run
      const show = 4;
      if (d.inANotB.length > 0) {
        console.log(`    Only in run${i + 1} (first ${Math.min(show, d.inANotB.length)}):`);
        d.inANotB.slice(0, show).forEach((c) => console.log(`      "${snippet(c)}"`));
      }
      if (d.inBNotA.length > 0) {
        console.log(`    Only in run${j + 1} (first ${Math.min(show, d.inBNotA.length)}):`);
        d.inBNotA.slice(0, show).forEach((c) => console.log(`      "${snippet(c)}"`));
      }
    }
    console.log();
  }

  // Verdict for this memo
  const anyDiffer = pairs.some(([i, j]) => {
    const d = diffClaimSets(allRuns[i].texts, allRuns[j].texts);
    return d.inANotB.length > 0 || d.inBNotA.length > 0;
  });
  const maxCountDelta = Math.max(...allRuns.map((r) => r.texts.length)) -
    Math.min(...allRuns.map((r) => r.texts.length));

  if (anyDiffer) {
    console.log(
      `  VERDICT: Extraction is NON-DETERMINISTIC for memo #${memoId} at temperature 0.`
    );
    console.log(`    Max claim-count swing across 3 runs: ${maxCountDelta}`);
    console.log(
      `    → This is Branch C evidence. The wobble in SRI for re-scored memos is`
    );
    console.log(
      `      primarily driven by extraction variance, not by input changes.`
    );
    console.log(
      `    → Fix: cache the extracted claim set (store it per scoring run so re-scores`
    );
    console.log(`      use the same claims) or pin the model to a non-drifting ID.`);
  } else {
    console.log(
      `  VERDICT: All 3 runs returned identical claim sets for memo #${memoId}.`
    );
    console.log(
      `    → This does NOT prove extraction is always stable (a single test is not a`
    );
    console.log(
      `      full calibration), but it makes Branch C less likely as the primary driver.`
    );
    console.log(
      `    → The SRI wobble for re-scored memos is more likely Branch A (input changed).`
    );
  }
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(
    "\n╔══════════════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║    test-extraction-variance.ts  —  READ-ONLY  (spends LLM tokens)       ║"
  );
  console.log(
    "║    Calls extractAllClaims 3× per memo. Writes nothing.                  ║"
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════════════╝\n"
  );

  // Determine which memo IDs to test.
  // Args after the script name are treated as memo IDs; defaults to 4 and 11.
  const argIds = process.argv
    .slice(2)
    .map((a) => parseInt(a, 10))
    .filter((n) => !isNaN(n));
  const memoIds = argIds.length > 0 ? argIds : [4, 11];

  console.log(`Testing memo ID(s): ${memoIds.join(", ")}\n`);

  for (const id of memoIds) {
    await testMemo(id);
  }

  sep("═");
  console.log("\nTest complete. No writes were made to the database.\n");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
