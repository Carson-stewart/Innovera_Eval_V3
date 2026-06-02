import { arithmeticMean } from "../helpers";
import {
  voiceScore,
  stakeholderFramingScore,
  executiveTerminologyScore,
  hedgingDisciplineScore,
  salienceHierarchyScore,
} from "../thresholds";
import type { DimensionResult, Tier2SynthesisOutput } from "../../prompts/types";

export interface D3Input {
  tier2: Tier2SynthesisOutput;
  agentSelfReported: number | null;
}

/**
 * D3 — Audience Calibration
 * ACI = arithmetic_mean(Voice, Stakeholder Framing, Executive Terminology,
 *                        Hedging Discipline, Salience Hierarchy)
 */
export function computeD3(input: D3Input): DimensionResult {
  const { d3 } = input.tier2;

  const vScore = voiceScore(d3.voice_type);
  const sfScore = stakeholderFramingScore(d3.has_decision_h2, d3.has_core_decision_label);
  const etScore = executiveTerminologyScore(d3.executive_terms_matched_count);
  const hdScore = hedgingDisciplineScore(d3.hedge_ratio);
  const shScore = salienceHierarchyScore(d3.salience_placement);

  const aci = arithmeticMean([vScore, sfScore, etScore, hdScore, shScore]);

  const subScores: Record<string, number> = {
    voiceScore: vScore,
    stakeholderFramingScore: sfScore,
    executiveTerminologyScore: etScore,
    hedgingDisciplineScore: hdScore,
    salienceHierarchyScore: shScore,
    aci,
    hedgeRatio: d3.hedge_ratio,
    hedgeMarkerCount: d3.hedge_marker_count,
    strongMarkerCount: d3.strong_marker_count,
    executiveTermsMatched: d3.executive_terms_matched_count,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(aci - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "D3",
    score: aci,
    subScores,
    traceabilityLog: {
      formula: "ACI = arithmetic_mean(Voice, Stakeholder Framing, Executive Terminology, Hedging Discipline, Salience Hierarchy)",
      voice_type: d3.voice_type,
      voice_score: vScore,
      has_decision_h2: d3.has_decision_h2,
      has_core_decision_label: d3.has_core_decision_label,
      stakeholder_framing_score: sfScore,
      executive_terms_matched_count: d3.executive_terms_matched_count,
      executive_terminology_score: etScore,
      hedge_marker_count: d3.hedge_marker_count,
      strong_marker_count: d3.strong_marker_count,
      hedge_ratio: d3.hedge_ratio,
      hedging_discipline_score: hdScore,
      salience_placement: d3.salience_placement,
      salience_hierarchy_score: shScore,
      aci,
    },
    serverComputed: aci,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
