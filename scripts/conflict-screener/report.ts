/**
 * Conflict Screener — human report rendering (screen-report.md).
 * Pure formatting; all numbers come from measure.ts.
 */
import type {
  MemoProfile,
  DeltaReport,
  CrossChapterCandidate,
  FigureEntry,
} from "./measure";

const TOP_FIGURES = 15;
/** md cap per unit class for M2 listing; JSON always carries the full set. */
const MD_CANDIDATES_PER_CLASS = 25;

const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100) / 100}`);

function figureLine(f: FigureEntry): string {
  const dist = Object.entries(f.perChapter)
    .sort((a, b) => b[1] - a[1])
    .map(([ch, n]) => `${ch} ×${n}`)
    .join("; ");
  return `| \`${f.display}\` | ${f.unitClass} | ${f.occurrences} | ${f.distinctStatements} | ${f.chapterCount} | ${dist} |`;
}

function candidateBlock(c: CrossChapterCandidate, i: number): string {
  return [
    `**${i}. ${c.unitClass}: \`${c.a.raw}\` vs \`${c.b.raw}\`**` +
      (c.instanceCount > 1 ? ` _(collapses ${c.instanceCount} instance pairs)_` : ""),
    `- A — ${c.a.chapter}, line ${c.a.line}: "${c.a.quote}"`,
    `- B — ${c.b.chapter}, line ${c.b.line}: "${c.b.quote}"`,
    `- shared signals: ${c.sharedSignals.join(", ")}`,
  ].join("\n");
}

export function renderProfile(p: MemoProfile, heading = "Memo profile"): string {
  const out: string[] = [];
  out.push(`## ${heading}: \`${p.file}\` (${p.parsedAs})`);
  out.push("");

  // M4
  out.push(`### M4 — Chapter inventory`);
  out.push("");
  out.push(`Scorable chapters (platform rule, non-empty): **${p.scorableChapterCount}**`);
  out.push("");
  out.push(`| # | Chapter | Words | Scored | Tags | Note |`);
  out.push(`|---|---|---|---|---|---|`);
  for (const c of p.chapters) {
    out.push(
      `| ${c.index} | ${c.title} | ${c.words} | ${c.scored ? "yes" : "no"} | ${c.tagCount} | ${c.empty ? "empty heading" : ""} |`
    );
  }
  out.push("");
  const missing = p.canonicalScorable.filter((c) => !c.present);
  out.push(
    missing.length === 0
      ? `All ${p.canonicalScorable.length} canonical scorable chapters present.`
      : `Missing canonical chapters: ${missing.map((m) => m.name).join(", ")}`
  );
  out.push("");

  // M1
  out.push(`### M1 — Figure repetition (top ${TOP_FIGURES} of ${p.figures.length} distinct figures)`);
  out.push("");
  out.push(`"Occurrences" are token-level mentions from the shared extractor; "statements" are distinct lines (the checker's counting semantics).`);
  out.push("");
  out.push(`| Figure | Unit class | Occurrences | Statements | Chapters | Distribution |`);
  out.push(`|---|---|---|---|---|---|`);
  for (const f of p.figures.slice(0, TOP_FIGURES)) out.push(figureLine(f));
  out.push("");

  // M2
  out.push(`### M2 — Cross-chapter conflict CANDIDATES (${p.candidates.length})`);
  out.push("");
  out.push(
    `> These are stage-1 **candidates for human/LLM adjudication — NOT confirmed conflicts.** ` +
      `Pairing rules and non-candidate exclusions (single ranges, scenario-labeled, time-distinguished, cross-currency) ` +
      `are the checker v1.2 rules, applied across chapters.`
  );
  out.push("");
  const byClass = new Map<string, CrossChapterCandidate[]>();
  for (const c of p.candidates) {
    (byClass.get(c.unitClass) ?? byClass.set(c.unitClass, []).get(c.unitClass)!).push(c);
  }
  let n = 0;
  for (const [cls, list] of Array.from(byClass.entries()).sort(
    (a, b) => b[1].length - a[1].length
  )) {
    out.push(`#### ${cls} (${list.length})`);
    out.push("");
    for (const c of list.slice(0, MD_CANDIDATES_PER_CLASS)) {
      out.push(candidateBlock(c, ++n));
      out.push("");
    }
    if (list.length > MD_CANDIDATES_PER_CLASS) {
      out.push(
        `_…${list.length - MD_CANDIDATES_PER_CLASS} more ${cls} pairs omitted from this view — the JSON report carries the full set._`
      );
      out.push("");
    }
  }

  // M3
  out.push(`### M3 — Tag-substitution ratio`);
  out.push("");
  out.push(
    `Tags: **${p.tags.total}** — WITH-FIGURE ${p.tags.withFigure} (${pct(p.tags.withFigureShare)}), ` +
      `WITHOUT-FIGURE ${p.tags.withoutFigure}. (WITHOUT-FIGURE = the tag substitutes for restating the figure.)`
  );
  out.push("");
  if (p.tags.perChapter.length > 0) {
    out.push(`| Chapter | Tags | WITH-FIGURE |`);
    out.push(`|---|---|---|`);
    for (const t of p.tags.perChapter) {
      out.push(`| ${t.title} | ${t.total} | ${t.withFigure} |`);
    }
    out.push("");
  }

  // Buckets
  if (p.buckets) {
    out.push(`### Per-bucket rates`);
    out.push("");
    out.push(`| Bucket | Chapters | Anchor-family mentions | Per chapter | All-figure mentions | Per chapter |`);
    out.push(`|---|---|---|---|---|---|`);
    for (const b of p.buckets) {
      out.push(
        `| ${b.name} | ${b.chapterCount} | ${b.familyMentions ?? "n/a"} | **${num(b.familyPerChapter)}** | ${b.figureMentions} | ${num(b.figurePerChapter)} |`
      );
    }
    out.push("");
    for (const b of p.buckets) {
      if (b.perChapterDetail) {
        const detail = Object.entries(b.perChapterDetail)
          .sort((x, y) => y[1] - x[1])
          .map(([ch, v]) => `${ch} ${v}`)
          .join("; ");
        out.push(`- ${b.name}: ${detail}`);
      }
    }
    out.push("");
  }

  return out.join("\n");
}

export function renderDelta(a: MemoProfile, b: MemoProfile, d: DeltaReport): string {
  const out: string[] = [];
  out.push(`## Delta report — before: \`${a.file}\` → after: \`${b.file}\``);
  out.push("");

  out.push(`### Candidate pairs resolved (${d.candidatesResolved.length})`);
  out.push("");
  let n = 0;
  for (const c of d.candidatesResolved) {
    out.push(candidateBlock(c, ++n));
    out.push("");
  }
  if (d.candidatesResolved.length === 0) out.push("_none_", "");

  out.push(`### Candidate pairs introduced (${d.candidatesIntroduced.length})`);
  out.push("");
  n = 0;
  for (const c of d.candidatesIntroduced) {
    out.push(candidateBlock(c, ++n));
    out.push("");
  }
  if (d.candidatesIntroduced.length === 0) out.push("_none_", "");

  out.push(`### Figure mention deltas (${d.figureDeltas.length} changed)`);
  out.push("");
  out.push(`| Figure | Before | After | Δ |`);
  out.push(`|---|---|---|---|`);
  for (const f of d.figureDeltas) {
    out.push(`| \`${f.display}\` (${f.key}) | ${f.before} | ${f.after} | ${f.delta > 0 ? "+" : ""}${f.delta} |`);
  }
  out.push("");

  out.push(`### Tag-ratio movement`);
  out.push("");
  out.push(
    `Before: ${d.tagMovement.before.total} tags, WITH-FIGURE ${pct(d.tagMovement.before.withFigureShare)} → ` +
      `After: ${d.tagMovement.after.total} tags, WITH-FIGURE ${pct(d.tagMovement.after.withFigureShare)}`
  );
  out.push("");

  if (d.bucketMovement) {
    out.push(`### Per-bucket rate movement (anchor-family mentions per chapter)`);
    out.push("");
    out.push(`| Bucket | Before | After | (all-figure before → after) |`);
    out.push(`|---|---|---|---|`);
    for (const m of d.bucketMovement) {
      out.push(
        `| ${m.name} | ${num(m.beforeFamilyPerChapter)} | ${num(m.afterFamilyPerChapter)} | ${num(m.beforeFigurePerChapter)} → ${num(m.afterFigurePerChapter)} |`
      );
    }
    out.push("");
  }

  return out.join("\n");
}
