/**
 * Conflict Screener — token-free, DB-free memo measurement CLI.
 *
 *   npm run screen -- <memoA> [<memoB>] [--buckets <config.json>] [--out <dir>]
 *
 * One file  → profile report (M1 figure repetition, M2 cross-chapter conflict
 *             candidates, M3 tag-substitution ratio, M4 chapter inventory).
 * Two files → both profiles plus a before/after delta report.
 *
 * Accepts .md (chapters by H1) and .docx (chapters by Heading 1 via mammoth,
 * the same transform family as the platform parser). ZERO LLM calls, ZERO
 * database access — files in, reports out.
 *
 * Outputs (to --out, default scripts/conflict-screener/output/):
 *   screen-report.md    human report
 *   screen-report.json  machine report — STABLE SCHEMA, documented below
 *
 * ── JSON schema (screen-report.json), v1.0 ──────────────────────────────────
 * {
 *   tool: "conflict-screener",
 *   version: "1.0",
 *   mode: "profile" | "delta",
 *   generatedAt: string (ISO 8601),
 *   bucketsConfig: string | null,        // path of the --buckets file, if any
 *   memoA: MemoProfile,
 *   memoB: MemoProfile | null,           // delta mode only
 *   delta: DeltaReport | null            // delta mode only
 * }
 *
 * MemoProfile {
 *   file: string, parsedAs: "md" | "docx",
 *   chapters: [{ index, title, startLine, words, scored, empty, tagCount }],
 *   scorableChapterCount: number,        // scored && !empty
 *   canonicalScorable: [{ name, present, matchedTitle }],
 *   figures: [{                          // M1 — sorted by occurrences desc
 *     key: "unitClass|lo|hi" ("inf" hi = open floor like "2,500+"),
 *     unitClass, lo: number, hi: number|null, openEnded: boolean,
 *     display: string,                   // most frequent verbatim form
 *     occurrences: number,               // token-level mentions
 *     distinctStatements: number,        // distinct lines (checker semantics)
 *     chapterCount: number,
 *     perChapter: { [chapterTitle]: occurrences }
 *   }],
 *   candidates: [{                       // M2 — cross-chapter, value-level
 *     key: string,                       // stable identity for delta matching
 *     unitClass: string,
 *     a, b: { raw, lo, hi, openEnded, chapter, line, quote },
 *     sharedSignals: string[],
 *     instanceCount: number              // instance pairs collapsed into this
 *   }],                                  // CANDIDATES for adjudication, NOT
 *                                        // confirmed conflicts
 *   tags: {                              // M3
 *     total, withFigure, withoutFigure,
 *     withFigureShare: number|null,      // null when no tags
 *     perChapter: [{ title, total, withFigure }]
 *   },
 *   buckets: [{                          // only with --buckets
 *     name, chapters: string[], chapterCount,
 *     familyMentions: number|null, familyPerChapter: number|null,
 *     perChapterDetail: { [chapterTitle]: mentions } | null,
 *     figureMentions: number, figurePerChapter: number
 *   }] | null
 * }
 *
 * DeltaReport {
 *   figureDeltas: [{ key, display, before, after, delta }],  // changed only
 *   candidatesResolved: Candidate[],     // in A, not in B
 *   candidatesIntroduced: Candidate[],   // in B, not in A
 *   tagMovement: { before: { total, withFigureShare }, after: { … } },
 *   bucketMovement: [{ name, beforeFamilyPerChapter, afterFamilyPerChapter,
 *                      beforeFigurePerChapter, afterFigurePerChapter }] | null
 * }
 *
 * Buckets config (--buckets file):
 * {
 *   description?: string,
 *   buckets: { [bucketName]: chapterTitle[] },   // matched case/space-insensitively
 *   anchorFamily?: [{ label, unitClass, value }] // per-bucket anchor rate family
 * }
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  profileMemo,
  computeDelta,
  type BucketsConfig,
  type MemoProfile,
  type DeltaReport,
} from "./measure";
import { renderProfile, renderDelta } from "./report";

async function main() {
  const args = process.argv.slice(2);
  const files: string[] = [];
  let bucketsPath: string | null = null;
  let outDir = path.join(__dirname, "output");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--buckets") bucketsPath = args[++i];
    else if (args[i] === "--out") outDir = args[++i];
    else files.push(args[i]);
  }

  if (files.length < 1 || files.length > 2) {
    console.error(
      "Usage: npm run screen -- <memoA> [<memoB>] [--buckets <config.json>] [--out <dir>]"
    );
    process.exit(2);
  }
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`File not found: ${f}`);
      process.exit(2);
    }
  }

  let config: BucketsConfig | undefined;
  if (bucketsPath) {
    config = JSON.parse(fs.readFileSync(bucketsPath, "utf8")) as BucketsConfig;
  }

  const memoA = await profileMemo(files[0], config);
  let memoB: MemoProfile | null = null;
  let delta: DeltaReport | null = null;
  if (files.length === 2) {
    memoB = await profileMemo(files[1], config);
    delta = computeDelta(memoA, memoB);
  }

  const json = {
    tool: "conflict-screener",
    version: "1.0",
    mode: memoB ? "delta" : "profile",
    generatedAt: new Date().toISOString(),
    bucketsConfig: bucketsPath,
    memoA,
    memoB,
    delta,
  };

  const md: string[] = [
    `# Conflict Screener report`,
    "",
    `Generated ${json.generatedAt} — mode: ${json.mode}. Token-free, DB-free measurement; ` +
      `quantities and candidate pairing come from the shared checker v1.2 extractor.`,
    "",
    renderProfile(memoA, memoB ? "Memo A (before)" : "Memo profile"),
  ];
  if (memoB && delta) {
    md.push(renderProfile(memoB, "Memo B (after)"));
    md.push(renderDelta(memoA, memoB, delta));
  }

  fs.mkdirSync(outDir, { recursive: true });
  const mdPath = path.join(outDir, "screen-report.md");
  const jsonPath = path.join(outDir, "screen-report.json");
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), "utf8");

  console.log(`Profiled: ${files.join(" vs ")}`);
  console.log(
    `M1 figures: ${memoA.figures.length} distinct — M2 candidates: ${memoA.candidates.length} — ` +
      `M3 tags: ${memoA.tags.total} (WITH-FIGURE ${memoA.tags.withFigure}) — ` +
      `M4 chapters: ${memoA.chapters.length} (${memoA.scorableChapterCount} scorable)`
  );
  if (memoB && delta) {
    console.log(
      `Delta: ${delta.candidatesResolved.length} candidate pairs resolved, ` +
        `${delta.candidatesIntroduced.length} introduced, ${delta.figureDeltas.length} figure deltas`
    );
  }
  console.log(`Reports: ${mdPath} | ${jsonPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
