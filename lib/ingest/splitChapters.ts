export interface Chapter {
  title: string;
  text: string;
  scored: boolean;
  index: number;
}

// ─── Non-scored section detection ────────────────────────────────────────────
// These chapters are always context-only in Innovera memos: they are passed to
// Tier 2 as full-memo context but do NOT receive a Tier-1 scoring step, and are
// excluded from completeness penalties (AG-P3.2).
//
// Matching is case-insensitive and collapses runs of whitespace/punctuation so
// minor heading variants ("Six T Analysis", "Six-T Analysis", "6T Analysis",
// "Business  Models", etc.) all resolve correctly.
function isNonScored(title: string): boolean {
  // Normalise: lowercase, collapse whitespace, strip leading/trailing punctuation
  const t = title.toLowerCase().replace(/\s+/g, " ").trim();

  // ── Spec-mandated non-scored sections (AG-P3.2) ──────────────────────────
  // "Six-T" / "Six T" / "6T" variants (all treated as the same section)
  const isSixT =
    t.includes("six-t") ||
    t.includes("six t") ||
    t.includes("6t") ||
    t.includes("6-t");

  // Financial Appendix — must contain both "financial" and "appendix"
  const isFinancialAppendix = t.includes("financial") && t.includes("appendix");

  // "Risk Analysis" as a standalone chapter title — exact/prefix match only so
  // "Key Risk" and "Risk Overview" sub-sections are not caught
  const isRiskAnalysisChapter = t === "risk analysis" || t.startsWith("risk analysis ");

  // ── Innovera memo context-only chapters ──────────────────────────────────
  // "Business Models" — supplementary context, not scored
  const isBusinessModels = t === "business models" || t.startsWith("business models ");

  // "Global Project Context" — background framing, not scored
  const isGlobalProjectContext =
    t === "global project context" || t.startsWith("global project context ");

  // "Olsenator Input" (and variants: "Olsenator" alone, "Olsenator Input*") —
  // advisor input section, always context-only
  const isOlsenatorInput = t.startsWith("olsenator");

  return (
    isSixT ||
    isFinancialAppendix ||
    isRiskAnalysisChapter ||
    isBusinessModels ||
    isGlobalProjectContext ||
    isOlsenatorInput
  );
}

// ─── Heading level detection ──────────────────────────────────────────────────
// Returns the single heading level that marks top-level chapter boundaries.
// Strategy: count H1, H2, H3 — use the highest level that has ≥ 2 occurrences.
// This handles memos that use H1 for chapters (like Ecolab) and memos that use
// H2 for chapters (no H1 headings at all).
function detectPrimaryLevel(lines: string[]): 1 | 2 | null {
  const h1 = lines.filter((l) => /^# [^#]/.test(l)).length;
  const h2 = lines.filter((l) => /^## [^#]/.test(l)).length;

  if (h1 >= 2) return 1;   // H1 present → H1 marks chapters
  if (h2 >= 2) return 2;   // No H1, but H2 present → H2 marks chapters
  return null;              // No headings → single chapter fallback
}

function headingRegexForLevel(level: 1 | 2): RegExp {
  return level === 1 ? /^# ([^#].*)/ : /^## ([^#].*)/;
}

// ─── Main splitter ─────────────────────────────────────────────────────────────
export function splitChapters(memoText: string): Chapter[] {
  const lines = memoText.split("\n");
  const primaryLevel = detectPrimaryLevel(lines);

  if (primaryLevel === null) {
    // No chapter headings found — treat whole memo as one scored chapter
    return [{ title: "Full Memo", text: memoText, scored: true, index: 0 }];
  }

  const headingRe = headingRegexForLevel(primaryLevel);

  const sections: Array<{ heading: string; lines: string[] }> = [];
  let currentHeading = "";
  let currentLines: string[] = [];
  let inChapter = false;

  for (const line of lines) {
    const match = line.match(headingRe);
    if (match) {
      if (inChapter) {
        // Save the previous chapter (trim trailing blank lines)
        sections.push({ heading: currentHeading, lines: currentLines });
      }
      inChapter = true;
      currentHeading = match[1].trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Don't forget the last chapter
  if (inChapter) {
    sections.push({ heading: currentHeading, lines: currentLines });
  }

  return sections.map((s, i) => ({
    title: s.heading,
    text: s.lines.join("\n"),
    scored: !isNonScored(s.heading),
    index: i,
  }));
}
