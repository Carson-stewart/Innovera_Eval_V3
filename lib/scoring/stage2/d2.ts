import { arithmeticMean } from "../helpers";
import {
  headerHierarchyScore,
  visualScaffoldingScore,
  chapterPrefixScore,
  boldDisciplineScore,
  crossRefsScore,
} from "../thresholds";
import type { DimensionResult, Tier1ChapterOutput } from "../../prompts/types";

export interface D2Input {
  tier1Chapters: Tier1ChapterOutput[];
  chapterPrefixType: "exec-summary" | "mixed" | "overview" | "none";
  agentSelfReported: number | null;
}

/**
 * D2 — Structural Clarity
 * SCI = arithmetic_mean(Header Hierarchy, Visual Scaffolding, Chapter Prefix,
 *                        Bold Discipline, Cross-References)
 * Aggregated from all Tier-1 chapters.
 */
export function computeD2(input: D2Input): DimensionResult {
  const { tier1Chapters } = input;

  // Aggregate across all chapters
  let totalH4 = 0;
  let totalTables = 0;
  let chaptersWithKeyTakeaways = 0;
  let totalBold = 0;
  let totalLines = 0;
  let totalDanglingRefs = 0;

  for (const chapter of tier1Chapters) {
    totalH4 += chapter.h4_headers;
    totalTables += chapter.tables;
    if (chapter.key_takeaways_present) chaptersWithKeyTakeaways++;
    totalBold += chapter.bold_total;
    totalLines += chapter.total_lines;
    totalDanglingRefs += chapter.dangling_refs;
  }

  // Has framing prose = at least one chapter has key_takeaways (used as proxy)
  const hasFramingProse = chaptersWithKeyTakeaways > 0;

  const boldPer1000Lines =
    totalLines > 0 ? (totalBold / totalLines) * 1000 : 0;

  // Total refs = totalH4 as a rough proxy for navigable refs; dangling measured directly
  // Use dangling/h4 ratio but default to clean (5) if no refs exist
  const totalRefs = totalH4;

  const hhScore = headerHierarchyScore(totalH4);
  const vsScore = visualScaffoldingScore(totalTables, chaptersWithKeyTakeaways > 0, hasFramingProse);
  const cpScore = chapterPrefixScore(input.chapterPrefixType);
  const bdScore = boldDisciplineScore(boldPer1000Lines);
  const crScore = crossRefsScore(totalDanglingRefs, totalRefs);

  const sci = arithmeticMean([hhScore, vsScore, cpScore, bdScore, crScore]);

  const subScores: Record<string, number> = {
    headerHierarchyScore: hhScore,
    visualScaffoldingScore: vsScore,
    chapterPrefixScore: cpScore,
    boldDisciplineScore: bdScore,
    crossRefsScore: crScore,
    sci,
    totalH4,
    totalTables,
    chaptersWithKeyTakeaways,
    totalBold,
    totalLines,
    boldPer1000Lines: parseFloat(boldPer1000Lines.toFixed(2)),
    totalDanglingRefs,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(sci - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "D2",
    score: sci,
    subScores,
    traceabilityLog: {
      formula: "SCI = arithmetic_mean(Header Hierarchy, Visual Scaffolding, Chapter Prefix, Bold Discipline, Cross-References)",
      total_h4_headers: totalH4,
      header_hierarchy_score: hhScore,
      total_tables: totalTables,
      chapters_with_key_takeaways: chaptersWithKeyTakeaways,
      has_framing_prose: hasFramingProse,
      visual_scaffolding_score: vsScore,
      chapter_prefix_type: input.chapterPrefixType,
      chapter_prefix_score: cpScore,
      total_bold: totalBold,
      total_lines: totalLines,
      bold_per_1000_lines: boldPer1000Lines,
      bold_discipline_score: bdScore,
      total_dangling_refs: totalDanglingRefs,
      total_refs: totalRefs,
      cross_refs_score: crScore,
      sci,
    },
    serverComputed: sci,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
