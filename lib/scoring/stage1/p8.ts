import { arithmeticMean } from "../helpers";
import {
  specificityScore,
  decisionArchitectureScore,
  integrationScore,
  move8Score,
} from "../thresholds";
import type { DimensionResult, Tier2SynthesisOutput } from "../../prompts/types";

export interface P8Input {
  tier2: Tier2SynthesisOutput;
  /** CovI from P4 result — passed in directly, never recomputed here (AG-P8.1) */
  covi: number;
  agentSelfReported: number | null;
}

/**
 * P8 — Solution Quality (+ Move 8)
 * SQI = arithmetic_mean(Specificity, Decision Architecture, Integration, Move 8)
 *
 * Move 8 reads CovI from P4 — one-directional, never recomputed (AG-P8.1).
 */
export function computeP8(input: P8Input): DimensionResult {
  const { p8 } = input.tier2;
  const { covi } = input;

  const spScore = specificityScore(
    p8.recommendation_quantified,
    p8.recommendation_has_named_entities
  );

  const daScore = decisionArchitectureScore(
    p8.actions_with_all_four,
    p8.actions_with_two,
    p8.actions_with_none,
    p8.total_actions
  );

  const intScore = integrationScore(
    p8.qa_basis_chains_count,
    p8.integration_quantified
  );

  const m8Score = move8Score(covi);

  const sqi = arithmeticMean([spScore, daScore, intScore, m8Score]);

  const subScores: Record<string, number> = {
    specificityScore: spScore,
    decisionArchitectureScore: daScore,
    integrationScore: intScore,
    move8Score: m8Score,
    covi_used: covi,
    sqi,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(sqi - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "P8",
    score: sqi,
    subScores,
    traceabilityLog: {
      formula: "SQI = arithmetic_mean(Specificity, Decision Architecture, Integration, Move 8)",
      recommendation_quote: p8.recommendation_quote,
      recommendation_quantified: p8.recommendation_quantified,
      recommendation_has_named_entities: p8.recommendation_has_named_entities,
      specificity_score: spScore,
      actions_with_all_four: p8.actions_with_all_four,
      actions_with_two: p8.actions_with_two,
      actions_with_none: p8.actions_with_none,
      total_actions: p8.total_actions,
      decision_architecture_score: daScore,
      qa_basis_chains_count: p8.qa_basis_chains_count,
      integration_quantified: p8.integration_quantified,
      integration_score: intScore,
      covi_from_p4: covi,
      move8_score: m8Score,
      note: "Move 8 reads CovI from P4 result — not re-derived (AG-P8.1).",
      sqi,
    },
    serverComputed: sqi,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
