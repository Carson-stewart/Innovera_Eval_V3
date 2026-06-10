/**
 * scripts/inspect-redundancy.ts
 *
 * READ-ONLY diagnostic: prints RedundancyAnalysis rows from the database.
 * No writes, no updates, no deletes. Safe to run repeatedly.
 *
 * Usage:
 *   npx tsx scripts/inspect-redundancy.ts
 *
 * Requires DATABASE_URL in .env (same as the app).
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

// ── Types matching lib/redundancy/types.ts ─────────────────────────────────
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

// ── Client setup (read-only queries only) ──────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

function sep(char = "─", n = 72) {
  console.log(char.repeat(n));
}

function printFavoriteFriend(ff: FavoriteFriend, showInstances: number) {
  console.log(
    `  [#${ff.rank}] "${ff.label.slice(0, 80)}${ff.label.length > 80 ? "…" : ""}"`
  );
  console.log(
    `       assertionCount=${ff.assertionCount}  chapterSpread=${ff.chapterSpread}  chapters=[${ff.chapters.join(", ")}]`
  );
  const instancesToShow = ff.instances.slice(0, showInstances);
  instancesToShow.forEach((inst, i) => {
    console.log(`       instance[${i + 1}] chapter="${inst.chapter}"`);
    console.log(`         text: "${inst.text.slice(0, 200)}${inst.text.length > 200 ? "…" : ""}"`);
  });
  if (ff.instances.length > showInstances) {
    console.log(`       … (${ff.instances.length - showInstances} more instances not shown)`);
  }
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║           inspect-redundancy.ts  —  READ-ONLY diagnostic            ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

  // ── Fetch most recent RedundancyAnalysis rows ──────────────────────────
  const rows = await prisma.redundancyAnalysis.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      scoringRun: {
        select: {
          id: true,
          memoId: true,
          rubricVersion: true,
          scoredAt: true,
          statusBadge: true,
        },
      },
    },
  });

  if (rows.length === 0) {
    console.log("No RedundancyAnalysis rows found in the database.");
    console.log("(Phase R1 runs after scoring — score a memo first to populate this table.)");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${rows.length} RedundancyAnalysis row(s). Showing most recent first.\n`);

  for (const row of rows) {
    sep("═");
    console.log(`RedundancyAnalysis id=${row.id}  |  scoringRunId=${row.scoringRunId}`);
    console.log(`  ScoringRun: memoId=${row.scoringRun.memoId}  rubric="${row.scoringRun.rubricVersion}"  badge=${row.scoringRun.statusBadge}`);
    console.log(`  scoredAt: ${row.scoringRun.scoredAt.toISOString()}  |  analysisCreatedAt: ${row.createdAt.toISOString()}`);
    sep();

    console.log(`  analysisStatus : ${row.analysisStatus}`);
    if (row.errorMessage) {
      console.log(`  errorMessage   : ${row.errorMessage}`);
    }
    console.log(`  threshold      : ${row.threshold}   ← cosine similarity threshold used`);
    console.log(`  claimCount     : ${row.claimCount}  (total atomic claims extracted)`);
    console.log(`  uniqueCluster  : ${row.uniqueClusterCount}  (distinct semantic clusters)`);
    console.log(`  SRI            : ${row.sri}   (Self-Repetition Index; 0=no restatement, 1=entirely restatements)`);

    const redundantAssertions = row.claimCount - row.uniqueClusterCount;
    const sriCheck = row.claimCount > 0 ? (redundantAssertions / row.claimCount) : 0;
    console.log(`  SRI cross-check: ${Math.round(sriCheck * 1000) / 1000}  (redundantAssertions=${redundantAssertions} / claimCount=${row.claimCount})`);

    // ── favoriteFriends ──────────────────────────────────────────────────
    const ff = row.favoriteFriends as unknown as FavoriteFriend[];
    console.log(`\n  favoriteFriends: ${Array.isArray(ff) ? ff.length : "N/A (not an array)"} repeated cluster(s) stored`);

    if (Array.isArray(ff) && ff.length > 0) {
      console.log("  (Showing top 3 clusters; up to 2 instances each)\n");
      for (const friend of ff.slice(0, 3)) {
        printFavoriteFriend(friend, 2);
        console.log();
      }
      if (ff.length > 3) {
        console.log(`  … (${ff.length - 3} more clusters not shown)`);
      }

      // ── Cross-reference signal check ─────────────────────────────────
      // Look for back-reference phrasing across ALL stored instances
      const backRefPhrases = [
        "as established", "as noted", "as mentioned", "as described",
        "as outlined", "as discussed", "see chapter", "see section",
        "noted above", "noted earlier", "per the", "per our",
        "referenced above", "per section", "in chapter", "in section",
        "as previously", "as stated",
      ];

      let backRefHits = 0;
      let totalInstances = 0;
      const backRefExamples: string[] = [];

      for (const friend of ff) {
        for (const inst of friend.instances) {
          totalInstances++;
          const lower = inst.text.toLowerCase();
          const matched = backRefPhrases.find((p) => lower.includes(p));
          if (matched) {
            backRefHits++;
            if (backRefExamples.length < 3) {
              backRefExamples.push(`[${inst.chapter}] "${inst.text.slice(0, 160)}…" (matched: "${matched}")`);
            }
          }
        }
      }

      console.log(`\n  ── Cross-reference signal scan (across all ${totalInstances} stored instances) ──`);
      console.log(`  Instances containing back-reference phrasing: ${backRefHits} / ${totalInstances}`);
      if (backRefHits > 0) {
        console.log("  Examples:");
        backRefExamples.forEach((ex) => console.log(`    ${ex}`));
      } else {
        console.log("  No back-reference phrasing detected in stored instances.");
      }
    }

    // ── perChapterGain ───────────────────────────────────────────────────
    if (row.perChapterGain) {
      const gain = row.perChapterGain as Record<string, number>;
      const entries = Object.entries(gain);
      console.log(`\n  perChapterGain (${entries.length} chapters):`);
      entries.forEach(([ch, g]) => {
        const bar = "█".repeat(Math.round(g * 20)).padEnd(20, "░");
        const label = g >= 0.7 ? "HIGH" : g >= 0.4 ? "MED" : "LOW";
        console.log(`    ${ch.slice(0, 35).padEnd(35)} ${bar} ${(g * 100).toFixed(1)}%  [${label}]`);
      });
    } else {
      console.log("\n  perChapterGain: null (not computed for this run)");
    }

    console.log();
  }

  sep("═");
  console.log("\nDiagnostic complete. No writes were made to the database.");
  console.log("This script is safe to run repeatedly.\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
