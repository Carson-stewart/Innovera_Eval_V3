/**
 * Conflict Screener — measurement engine (M1–M4 + delta).
 *
 * TOKEN-FREE and DB-FREE by construction: this module imports ONLY the shared
 * stage-1 extractor (lib/framing/quantities), the canonical chapter splitter
 * (lib/ingest/splitChapters) and the file parser (lib/ingest/parseFile — mammoth
 * for .docx). No prisma, no openrouter, no network.
 *
 * One grammar, one rule set: every quantity and every candidate pair comes from
 * the checker v1.2 extractor (extractQuantities / pairCandidates). The screener
 * adds chapter attribution and cross-chapter filtering — it never re-implements
 * the quantity grammar or the non-candidate exclusions.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { parseFile } from "../../lib/ingest/parseFile";
import { splitChapters } from "../../lib/ingest/splitChapters";
import {
  extractQuantities,
  pairCandidates,
  type Quantity,
} from "../../lib/framing/quantities";

// ─── Public types (the JSON report schema is assembled from these) ───────────

export interface SectionInfo {
  index: number;
  title: string;
  startLine: number; // 1-based line of the heading in the source file
  words: number;
  scored: boolean; // platform rule (lib/ingest/splitChapters isNonScored)
  empty: boolean; // heading with no real content (< EMPTY_WORDS words)
  tagCount: number; // [CHAPTER: …] tags in this section
}

export interface CanonicalPresence {
  name: string;
  present: boolean;
  matchedTitle: string | null;
}

export interface FigureEntry {
  /** normalized identity: unitClass|lo|hi (hi may be "inf" for open floors) */
  key: string;
  unitClass: string;
  lo: number;
  /** null = open-ended ("2,500+") */
  hi: number | null;
  openEnded: boolean;
  /** most frequent verbatim form */
  display: string;
  /** raw extractor occurrences (token-level mentions) */
  occurrences: number;
  /** distinct statements (lines) — the checker's counting semantics */
  distinctStatements: number;
  chapterCount: number;
  /** chapter title → occurrences */
  perChapter: Record<string, number>;
}

export interface CandidateSide {
  raw: string;
  lo: number;
  hi: number | null;
  openEnded: boolean;
  chapter: string;
  line: number; // 1-based line in the source file
  quote: string; // statement, truncated to QUOTE_MAX chars
}

export interface CrossChapterCandidate {
  /** stable identity for delta matching */
  key: string;
  unitClass: string;
  a: CandidateSide;
  b: CandidateSide;
  sharedSignals: string[];
  /** number of instance-level pairs collapsed into this value-level pair */
  instanceCount: number;
}

export interface TagStats {
  total: number;
  withFigure: number;
  withoutFigure: number;
  /** withFigure / total; null when no tags */
  withFigureShare: number | null;
  perChapter: Array<{ title: string; total: number; withFigure: number }>;
}

export interface BucketStat {
  name: string;
  /** matched, non-empty section titles */
  chapters: string[];
  chapterCount: number;
  /** anchor-family occurrences (when the config defines anchorFamily) */
  familyMentions: number | null;
  familyPerChapter: number | null;
  perChapterDetail: Record<string, number> | null;
  /** all-figure occurrences (always computed) */
  figureMentions: number;
  figurePerChapter: number;
}

export interface MemoProfile {
  file: string;
  parsedAs: "md" | "docx";
  chapters: SectionInfo[];
  scorableChapterCount: number;
  canonicalScorable: CanonicalPresence[];
  figures: FigureEntry[]; // all, sorted by occurrences desc
  candidates: CrossChapterCandidate[];
  tags: TagStats;
  buckets: BucketStat[] | null;
}

export interface FigureDelta {
  key: string;
  display: string;
  before: number; // occurrences
  after: number;
  delta: number;
}

export interface DeltaReport {
  figureDeltas: FigureDelta[]; // changed figures only, by |delta| desc
  candidatesResolved: CrossChapterCandidate[]; // in A, not in B
  candidatesIntroduced: CrossChapterCandidate[]; // in B, not in A
  tagMovement: {
    before: { total: number; withFigureShare: number | null };
    after: { total: number; withFigureShare: number | null };
  };
  bucketMovement: Array<{
    name: string;
    beforeFamilyPerChapter: number | null;
    afterFamilyPerChapter: number | null;
    beforeFigurePerChapter: number;
    afterFigurePerChapter: number;
  }> | null;
}

export interface BucketsConfig {
  description?: string;
  /** bucket name → list of chapter titles (matched case/space-insensitively) */
  buckets: Record<string, string[]>;
  /** optional anchor family for the per-bucket anchor rate */
  anchorFamily?: Array<{ label: string; unitClass: string; value: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** A heading whose section has fewer words than this is an empty wrapper
 *  (e.g. v11's bare "# Full Summary" / duplicate "# Unit Economics" headings)
 *  and is excluded from bucket chapter counts. */
const EMPTY_WORDS = 20;

const QUOTE_MAX = 240;

/** Sentence window for M3: a "sentence" longer than this (HTML table rows are
 *  single multi-thousand-char lines) falls back to ±FALLBACK_RADIUS chars. */
const SENTENCE_MAX = 400;
const FALLBACK_RADIUS = 150;

/** Tolerates the markdown-escaped form "\[CHAPTER: X\]" as well as plain. */
const TAG_RE = /\[CHAPTER:\s*([^\]]+?)\\?\]/g;

/** The standard Innovera scorable chapter set (file-side completeness view). */
const CANONICAL_SCORABLE: Array<{ name: string; aliases: string[] }> = [
  { name: "Executive Summary", aliases: [] },
  { name: "Opportunity Validation", aliases: [] },
  { name: "Customer and Demand Validation", aliases: ["customer demand"] },
  { name: "Product and Technology", aliases: [] },
  { name: "Market Research", aliases: [] },
  { name: "Competitor Analysis", aliases: ["competitive analysis"] },
  { name: "GTM and Partners", aliases: ["go to market"] },
  { name: "Revenue Model", aliases: [] },
  { name: "Unit Economics", aliases: [] },
  { name: "Finance and Operations", aliases: ["finance operations"] },
  { name: "Team and Execution", aliases: [] },
  { name: "Legal and IP", aliases: ["legal ip"] },
];

// ─── Internals ────────────────────────────────────────────────────────────────

interface AttributedQuantity extends Quantity {
  chapterIndex: number;
  chapterTitle: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Strip float artifacts from normalized magnitudes (8.31 × 1e9 →
 *  8310000000.000001) so figure keys are clean and delta-stable. */
const normNum = (x: number) => (Number.isFinite(x) ? Number(x.toPrecision(12)) : x);

const figureKey = (q: { unitClass: string; lo: number; hi: number }) =>
  `${q.unitClass}|${normNum(q.lo)}|${Number.isFinite(q.hi) ? normNum(q.hi) : "inf"}`;

const wordsIn = (s: string) => s.split(/\s+/).filter(Boolean).length;

function side(q: AttributedQuantity): CandidateSide {
  return {
    raw: q.raw,
    lo: normNum(q.lo),
    hi: Number.isFinite(q.hi) ? normNum(q.hi) : null,
    openEnded: !Number.isFinite(q.hi),
    chapter: q.chapterTitle,
    line: q.line,
    quote:
      q.statement.length > QUOTE_MAX
        ? q.statement.slice(0, QUOTE_MAX) + " […]"
        : q.statement,
  };
}

// ─── Loading ──────────────────────────────────────────────────────────────────

export async function loadMemo(filePath: string): Promise<{
  text: string;
  parsedAs: "md" | "docx";
}> {
  const lower = filePath.toLowerCase();
  const buffer = fs.readFileSync(filePath);
  if (lower.endsWith(".docx")) {
    return { text: await parseFile(buffer, path.basename(filePath)), parsedAs: "docx" };
  }
  return { text: buffer.toString("utf8"), parsedAs: "md" };
}

// ─── Profiling (M1–M4) ────────────────────────────────────────────────────────

export async function profileMemo(
  filePath: string,
  config?: BucketsConfig
): Promise<MemoProfile> {
  const { text, parsedAs } = await loadMemo(filePath);
  const sections = splitChapters(text);
  const allLines = text.split("\n");

  // Global line offsets: splitChapters drops any preamble before the first
  // heading; sections then cover the rest of the file contiguously.
  const sectionLineCounts = sections.map((s) => s.text.split("\n").length);
  const preamble =
    allLines.length - sectionLineCounts.reduce((a, b) => a + b, 0);
  const startLines: number[] = [];
  let cursor = preamble;
  for (const count of sectionLineCounts) {
    startLines.push(cursor); // 0-based index of the heading line
    cursor += count;
  }

  // ── Extraction with chapter attribution (shared grammar, per section) ──────
  const flat: AttributedQuantity[] = [];
  for (let i = 0; i < sections.length; i++) {
    const qs = extractQuantities(sections[i].text);
    for (const q of qs) {
      flat.push({
        ...q,
        line: startLines[i] + q.line, // global 1-based line number
        chapterIndex: i,
        chapterTitle: sections[i].title,
      });
    }
  }

  // ── M4: chapter inventory ───────────────────────────────────────────────────
  const chapters: SectionInfo[] = sections.map((s, i) => {
    const words = wordsIn(s.text.replace(/^#+ .*$/m, ""));
    return {
      index: i,
      title: s.title,
      startLine: startLines[i] + 1,
      words,
      scored: s.scored,
      empty: words < EMPTY_WORDS,
      tagCount: (s.text.match(TAG_RE) ?? []).length,
    };
  });
  const scorableChapterCount = chapters.filter((c) => c.scored && !c.empty).length;

  const canonicalScorable: CanonicalPresence[] = CANONICAL_SCORABLE.map((c) => {
    const names = [c.name, ...c.aliases].map(slug);
    const match = chapters.find(
      (ch) =>
        !ch.empty &&
        names.some((n) => slug(ch.title).includes(n) || n.includes(slug(ch.title)))
    );
    return { name: c.name, present: !!match, matchedTitle: match?.title ?? null };
  });

  // ── M1: figure repetition ───────────────────────────────────────────────────
  const groups = new Map<string, AttributedQuantity[]>();
  for (const q of flat) {
    const key = figureKey(q);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(q);
  }
  const figures: FigureEntry[] = Array.from(groups.entries()).map(([key, g]) => {
    const rawCounts = new Map<string, number>();
    for (const q of g) rawCounts.set(q.raw, (rawCounts.get(q.raw) ?? 0) + 1);
    const display = Array.from(rawCounts.entries()).sort((x, y) => y[1] - x[1])[0][0];
    const perChapter: Record<string, number> = {};
    for (const q of g) perChapter[q.chapterTitle] = (perChapter[q.chapterTitle] ?? 0) + 1;
    return {
      key,
      unitClass: g[0].unitClass,
      lo: normNum(g[0].lo),
      hi: Number.isFinite(g[0].hi) ? normNum(g[0].hi) : null,
      openEnded: !Number.isFinite(g[0].hi),
      display,
      occurrences: g.length,
      distinctStatements: new Set(g.map((q) => q.line)).size,
      chapterCount: new Set(g.map((q) => q.chapterTitle)).size,
      perChapter,
    };
  });
  figures.sort((x, y) => y.occurrences - x.occurrences);

  // ── M2: cross-chapter conflict candidates (shared pairing + exclusions) ────
  const rawPairs = pairCandidates(flat).filter(
    (p) =>
      (p.a as AttributedQuantity).chapterIndex !==
      (p.b as AttributedQuantity).chapterIndex
  );
  // Collapse instance-level pairs to value-level pairs per chapter pair.
  const byIdentity = new Map<string, CrossChapterCandidate>();
  for (const p of rawPairs) {
    let a = p.a as AttributedQuantity;
    let b = p.b as AttributedQuantity;
    // canonical order: lower value first, then chapter title
    if (a.lo > b.lo || (a.lo === b.lo && a.chapterTitle > b.chapterTitle)) {
      [a, b] = [b, a];
    }
    const key = [
      a.unitClass,
      normNum(a.lo), Number.isFinite(a.hi) ? normNum(a.hi) : "inf",
      normNum(b.lo), Number.isFinite(b.hi) ? normNum(b.hi) : "inf",
      a.chapterTitle, b.chapterTitle,
    ].join("|");
    const existing = byIdentity.get(key);
    if (existing) {
      existing.instanceCount += 1;
      for (const s of p.sharedSignals) {
        if (!existing.sharedSignals.includes(s)) existing.sharedSignals.push(s);
      }
    } else {
      byIdentity.set(key, {
        key,
        unitClass: a.unitClass,
        a: side(a),
        b: side(b),
        sharedSignals: [...p.sharedSignals],
        instanceCount: 1,
      });
    }
  }
  const candidates = Array.from(byIdentity.values()).sort(
    (x, y) => y.instanceCount - x.instanceCount || x.key.localeCompare(y.key)
  );

  // ── M3: tag-substitution ratio ─────────────────────────────────────────────
  const perChapterTags: TagStats["perChapter"] = [];
  let total = 0;
  let withFigure = 0;
  for (const s of sections) {
    let chTotal = 0;
    let chWith = 0;
    TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TAG_RE.exec(s.text)) !== null) {
      chTotal++;
      const idx = m.index;
      // sentence bounds around the tag; fallback to ±150 chars where
      // splitting is unreliable (single-line HTML tables)
      const before = s.text.slice(0, idx);
      const after = s.text.slice(idx + m[0].length);
      const startRel = Math.max(
        before.lastIndexOf(". "), before.lastIndexOf("! "),
        before.lastIndexOf("? "), before.lastIndexOf("\n")
      );
      const endCandidates = [
        after.search(/[.!?](\s|$)/), after.indexOf("\n"),
      ].filter((x) => x >= 0);
      const endRel = endCandidates.length ? Math.min(...endCandidates) : after.length;
      let sentence =
        s.text.slice(startRel + 1, idx + m[0].length + endRel + 1);
      if (sentence.length > SENTENCE_MAX) {
        sentence = s.text.slice(
          Math.max(0, idx - FALLBACK_RADIUS),
          idx + m[0].length + FALLBACK_RADIUS
        );
      }
      if (extractQuantities(sentence).length > 0) chWith++;
    }
    total += chTotal;
    withFigure += chWith;
    if (chTotal > 0) {
      perChapterTags.push({ title: s.title, total: chTotal, withFigure: chWith });
    }
  }
  const tags: TagStats = {
    total,
    withFigure,
    withoutFigure: total - withFigure,
    withFigureShare: total > 0 ? withFigure / total : null,
    perChapter: perChapterTags,
  };

  // ── Buckets (optional config) ───────────────────────────────────────────────
  let buckets: BucketStat[] | null = null;
  if (config) {
    buckets = Object.entries(config.buckets).map(([name, titles]) => {
      const wanted = titles.map(slug);
      const matched = chapters.filter(
        (c) => !c.empty && wanted.includes(slug(c.title))
      );
      const matchedTitles = matched.map((c) => c.title);
      const inBucket = (q: AttributedQuantity) =>
        matched.some((c) => c.index === q.chapterIndex);

      const bucketQs = flat.filter(inBucket);
      const figureMentions = bucketQs.length;

      let familyMentions: number | null = null;
      let perChapterDetail: Record<string, number> | null = null;
      if (config.anchorFamily && config.anchorFamily.length > 0) {
        const fam = config.anchorFamily;
        const isFamily = (q: AttributedQuantity) =>
          fam.some(
            (f) => f.unitClass === q.unitClass && q.lo === f.value && q.hi === f.value
          );
        const famQs = bucketQs.filter(isFamily);
        familyMentions = famQs.length;
        perChapterDetail = {};
        for (const c of matched) perChapterDetail[c.title] = 0;
        for (const q of famQs) perChapterDetail[q.chapterTitle] += 1;
      }

      const n = matched.length;
      return {
        name,
        chapters: matchedTitles,
        chapterCount: n,
        familyMentions,
        familyPerChapter:
          familyMentions !== null && n > 0 ? familyMentions / n : null,
        perChapterDetail,
        figureMentions,
        figurePerChapter: n > 0 ? figureMentions / n : 0,
      };
    });
  }

  return {
    file: filePath,
    parsedAs,
    chapters,
    scorableChapterCount,
    canonicalScorable,
    figures,
    candidates,
    tags,
    buckets,
  };
}

// ─── Delta (before/after) ─────────────────────────────────────────────────────

export function computeDelta(a: MemoProfile, b: MemoProfile): DeltaReport {
  const occ = (p: MemoProfile) =>
    new Map(p.figures.map((f) => [f.key, f] as const));
  const occA = occ(a);
  const occB = occ(b);
  const keys = new Set([...Array.from(occA.keys()), ...Array.from(occB.keys())]);
  const figureDeltas: FigureDelta[] = [];
  for (const key of Array.from(keys)) {
    const fa = occA.get(key);
    const fb = occB.get(key);
    const before = fa?.occurrences ?? 0;
    const after = fb?.occurrences ?? 0;
    if (before !== after) {
      figureDeltas.push({
        key,
        display: (fb ?? fa)!.display,
        before,
        after,
        delta: after - before,
      });
    }
  }
  figureDeltas.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  const idsA = new Set(a.candidates.map((c) => c.key));
  const idsB = new Set(b.candidates.map((c) => c.key));
  const candidatesResolved = a.candidates.filter((c) => !idsB.has(c.key));
  const candidatesIntroduced = b.candidates.filter((c) => !idsA.has(c.key));

  let bucketMovement: DeltaReport["bucketMovement"] = null;
  if (a.buckets && b.buckets) {
    bucketMovement = a.buckets.map((ba) => {
      const bb = b.buckets!.find((x) => x.name === ba.name);
      return {
        name: ba.name,
        beforeFamilyPerChapter: ba.familyPerChapter,
        afterFamilyPerChapter: bb?.familyPerChapter ?? null,
        beforeFigurePerChapter: ba.figurePerChapter,
        afterFigurePerChapter: bb?.figurePerChapter ?? 0,
      };
    });
  }

  return {
    figureDeltas,
    candidatesResolved,
    candidatesIntroduced,
    tagMovement: {
      before: { total: a.tags.total, withFigureShare: a.tags.withFigureShare },
      after: { total: b.tags.total, withFigureShare: b.tags.withFigureShare },
    },
    bucketMovement,
  };
}
