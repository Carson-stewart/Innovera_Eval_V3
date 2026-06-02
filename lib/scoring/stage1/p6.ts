import { arithmeticMean } from "../helpers";
import {
  identificationScore,
  attributionScore,
  sensitivityAwarenessScore,
} from "../thresholds";
import type { DimensionResult, Tier2SynthesisOutput } from "../../prompts/types";

export interface P6Input {
  tier2: Tier2SynthesisOutput;
  agentSelfReported: number | null;
}

/**
 * P6 — Assumption Quality
 * AQI = arithmetic_mean(Identification, Attribution, Sensitivity Awareness)
 */
export function computeP6(input: P6Input): DimensionResult {
  const { p6 } = input.tier2;

  const idScore = identificationScore(
    p6.has_top_level_section,
    p6.sectional_count
  );

  const attrScore = attributionScore(
    p6.client_tagged,
    p6.platform_tagged,
    p6.has_provenance_table,
    p6.source_type_count
  );

  const sensScore = sensitivityAwarenessScore(
    p6.validation_methods_linked_to_actions
  );

  const aqi = arithmeticMean([idScore, attrScore, sensScore]);

  const subScores: Record<string, number> = {
    identificationScore: idScore,
    attributionScore: attrScore,
    sensitivityAwarenessScore: sensScore,
    aqi,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(aqi - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "P6",
    score: aqi,
    subScores,
    traceabilityLog: {
      formula: "AQI = arithmetic_mean(Identification, Attribution, Sensitivity Awareness)",
      has_top_level_section: p6.has_top_level_section,
      sectional_count: p6.sectional_count,
      identification_score: idScore,
      client_tagged: p6.client_tagged,
      platform_tagged: p6.platform_tagged,
      has_provenance_table: p6.has_provenance_table,
      source_type_count: p6.source_type_count,
      attribution_score: attrScore,
      validation_methods_linked_to_actions: p6.validation_methods_linked_to_actions,
      sensitivity_awareness_score: sensScore,
      aqi,
    },
    serverComputed: aqi,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
