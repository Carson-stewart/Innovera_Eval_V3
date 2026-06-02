import { arithmeticMean } from "../helpers";
import {
  verdictFirstScore,
  acronymDisciplineScore,
  numericalDensityScore,
  sentenceComplexityScore,
  execSummaryLengthScore,
} from "../thresholds";
import type { DimensionResult, Tier1ChapterOutput } from "../../prompts/types";

export interface D1Input {
  /** All tier-1 chapter outputs — D1 reads from the Exec Summary chapter */
  tier1Chapters: Tier1ChapterOutput[];
  /**
   * Verdict-first placement classification from the agent.
   * Derived from Tier 2 or from Tier 1 exec summary chapter context.
   */
  verdictPlacement: "front-loaded" | "present-not-front" | "buried" | "absent";
  agentSelfReported: number | null;
}

/**
 * D1 — Interpretability
 * II = arithmetic_mean(Verdict-First, Acronym Discipline, Numerical Density,
 *                       Sentence Complexity, Exec Summary Length)
 * All measurements from the Exec Summary chapter (AG-D1.2).
 */
export function computeD1(input: D1Input): DimensionResult {
  // Find the exec summary chapter
  const execChapter = input.tier1Chapters.find(
    (c) =>
      c.chapter_prefix.toLowerCase().includes("executive summary") ||
      c.exec_summary_word_count !== null
  );

  const wordCount = execChapter?.exec_summary_word_count ?? 0;
  const per100Words = execChapter?.exec_summary_numbers_per_100_words ?? 0;
  const avgSentenceWords = execChapter?.exec_summary_avg_sentence_words ?? 0;
  const acronymsTotal = execChapter?.acronyms.count ?? 0;
  const acronymsDefined = execChapter?.acronyms.defined ?? 0;

  const vfScore = verdictFirstScore(input.verdictPlacement);
  const acScore = acronymDisciplineScore(acronymsTotal, acronymsDefined);
  const ndScore = numericalDensityScore(per100Words);
  const scScore = sentenceComplexityScore(avgSentenceWords);
  const elScore = execSummaryLengthScore(wordCount);

  const ii = arithmeticMean([vfScore, acScore, ndScore, scScore, elScore]);

  const subScores: Record<string, number> = {
    verdictFirstScore: vfScore,
    acronymDisciplineScore: acScore,
    numericalDensityScore: ndScore,
    sentenceComplexityScore: scScore,
    execSummaryLengthScore: elScore,
    ii,
    wordCount,
    per100Words,
    avgSentenceWords,
    acronymsTotal,
    acronymsDefined,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(ii - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "D1",
    score: ii,
    subScores,
    traceabilityLog: {
      formula: "II = arithmetic_mean(Verdict-First, Acronym Discipline, Numerical Density, Sentence Complexity, Exec Summary Length)",
      source: "Exec Summary chapter measurements",
      verdict_placement: input.verdictPlacement,
      verdict_first_score: vfScore,
      acronyms_total: acronymsTotal,
      acronyms_defined: acronymsDefined,
      acronym_discipline_score: acScore,
      numbers_per_100_words: per100Words,
      numerical_density_score: ndScore,
      avg_sentence_words: avgSentenceWords,
      sentence_complexity_score: scScore,
      exec_summary_word_count: wordCount,
      exec_summary_length_score: elScore,
      ii,
    },
    serverComputed: ii,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
