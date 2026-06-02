import { arithmeticMean } from "../helpers";
import {
  citationDensityScore,
  sourceQualityScore,
  provenanceTaggingScore,
} from "../thresholds";
import type { DimensionResult, Tier1ChapterOutput } from "../../prompts/types";

export interface P5Input {
  tier1Chapters: Tier1ChapterOutput[];
  agentSelfReported: number | null;
}

/**
 * P5 — Evidence Quality
 * EQI = arithmetic_mean(Citation Density, Source Quality, Provenance Tagging)
 * Aggregated across all Tier-1 chapters.
 */
export function computeP5(input: P5Input): DimensionResult {
  const { tier1Chapters } = input;

  // Aggregate totals across all chapters
  let totalCitations = 0;
  let totalLines = 0;
  let totalSources = 0;
  let redFlagCount = 0;
  let premiumCount = 0;
  let provenanceTagCount = 0;
  const provenanceTypeSet = new Set<string>();

  for (const chapter of tier1Chapters) {
    totalCitations += chapter.citations_count;
    totalLines += chapter.total_lines;
    totalSources += chapter.sources.length;
    for (const src of chapter.sources) {
      if (src.isRedFlag) redFlagCount++;
      if (src.tier === "premium") premiumCount++;
    }
    provenanceTagCount += chapter.provenance_tags.count;
    for (const t of chapter.provenance_tags.types) {
      provenanceTypeSet.add(t);
    }
  }

  const per100Lines = totalLines > 0 ? (totalCitations / totalLines) * 100 : 0;
  const provenanceTypeCount = provenanceTypeSet.size;

  const cdScore = citationDensityScore(per100Lines);
  const sqScore = sourceQualityScore(redFlagCount, totalSources, premiumCount);
  const ptScore = provenanceTaggingScore(provenanceTagCount, provenanceTypeCount);

  const eqi = arithmeticMean([cdScore, sqScore, ptScore]);

  const subScores: Record<string, number> = {
    citationDensityScore: cdScore,
    sourceQualityScore: sqScore,
    provenanceTaggingScore: ptScore,
    eqi,
    totalCitations,
    totalLines,
    per100Lines: parseFloat(per100Lines.toFixed(2)),
    totalSources,
    redFlagCount,
    premiumCount,
    provenanceTagCount,
    provenanceTypeCount,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(eqi - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "P5",
    score: eqi,
    subScores,
    traceabilityLog: {
      formula: "EQI = arithmetic_mean(Citation Density, Source Quality, Provenance Tagging)",
      total_citations: totalCitations,
      total_lines: totalLines,
      per_100_lines: per100Lines,
      citation_density_score: cdScore,
      total_sources: totalSources,
      red_flag_count: redFlagCount,
      premium_count: premiumCount,
      source_quality_score: sqScore,
      provenance_tag_count: provenanceTagCount,
      provenance_type_count: provenanceTypeCount,
      provenance_types: Array.from(provenanceTypeSet),
      provenance_tagging_score: ptScore,
      eqi,
    },
    serverComputed: eqi,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
