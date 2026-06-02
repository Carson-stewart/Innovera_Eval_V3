import { clamp } from "../helpers";
import type { DimensionResult, Tier2SynthesisOutput } from "../../prompts/types";

export interface P3Input {
  tier2: Tier2SynthesisOutput;
  agentSelfReported: number | null;
}

/**
 * P3 — Fidelity / Structural Accuracy
 * FI = 5 + bonuses − penalties, clamp [1,5]
 *
 * Penalties: missing required chapter −0.5 each; missing sub-section −0.25 each;
 *            duplicate header −0.25 each; wrong-template −0.5.
 * Bonuses: typology refinement +0.5; 1-2 additional chapters +0.25 to +0.5.
 */
export function computeP3(input: P3Input): DimensionResult {
  const {
    p3_missing_chapters,
    p3_missing_subsections,
    p3_duplicate_headers,
    p3_wrong_template,
    p3_typology_refinement,
    p3_additional_chapters_count,
    p3_typology,
    p3_expected_chapters,
    p3_present_chapters,
  } = input.tier2;

  const missingChapterPenalty = p3_missing_chapters.length * 0.5;
  const missingSubsectionPenalty = p3_missing_subsections.length * 0.25;
  const duplicateHeaderPenalty = p3_duplicate_headers.length * 0.25;
  const wrongTemplatePenalty = p3_wrong_template ? 0.5 : 0;

  const totalPenalties =
    missingChapterPenalty +
    missingSubsectionPenalty +
    duplicateHeaderPenalty +
    wrongTemplatePenalty;

  const typologyRefinementBonus = p3_typology_refinement ? 0.5 : 0;
  // 1 additional chapter = +0.25, 2+ = +0.5
  const additionalChaptersBonus =
    p3_additional_chapters_count >= 2 ? 0.5 : p3_additional_chapters_count === 1 ? 0.25 : 0;

  const totalBonuses = typologyRefinementBonus + additionalChaptersBonus;

  const fi = clamp(5 + totalBonuses - totalPenalties, 1, 5);

  const subScores: Record<string, number> = {
    missingChapterPenalty: parseFloat(missingChapterPenalty.toFixed(4)),
    missingSubsectionPenalty: parseFloat(missingSubsectionPenalty.toFixed(4)),
    duplicateHeaderPenalty: parseFloat(duplicateHeaderPenalty.toFixed(4)),
    wrongTemplatePenalty,
    totalPenalties: parseFloat(totalPenalties.toFixed(4)),
    typologyRefinementBonus,
    additionalChaptersBonus,
    totalBonuses,
    fi,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(fi - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "P3",
    score: fi,
    subScores,
    traceabilityLog: {
      formula: "FI = 5 + bonuses − penalties, clamp [1,5]",
      typology: p3_typology,
      expected_chapters: p3_expected_chapters,
      present_chapters: p3_present_chapters,
      missing_chapters: p3_missing_chapters,
      missing_subsections: p3_missing_subsections,
      duplicate_headers: p3_duplicate_headers,
      wrong_template: p3_wrong_template,
      total_penalties: totalPenalties,
      typology_refinement: p3_typology_refinement,
      additional_chapters_count: p3_additional_chapters_count,
      total_bonuses: totalBonuses,
      fi,
    },
    serverComputed: fi,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
