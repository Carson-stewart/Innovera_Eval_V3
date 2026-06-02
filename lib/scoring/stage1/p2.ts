import { geometricMean } from "../helpers";
import type { DimensionResult, Tier2SynthesisOutput } from "../../prompts/types";

export interface P2Input {
  tier2: Tier2SynthesisOutput;
  agentSelfReported: number | null;
}

/**
 * P2 — Problem Formulation
 * PFI = geometric_mean(Fidelity, Gap-filling, Executability), each 1–5
 */
export function computeP2(input: P2Input): DimensionResult {
  const { p2 } = input.tier2;

  const fidelityScore = p2.fidelity_score;
  const gapFillingScore = p2.gap_filling_score;
  const executabilityScore = p2.executability_score;

  const pfi = geometricMean([fidelityScore, gapFillingScore, executabilityScore]);

  const subScores: Record<string, number> = {
    fidelityScore,
    gapFillingScore,
    executabilityScore,
    pfi,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(pfi - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "P2",
    score: pfi,
    subScores,
    traceabilityLog: {
      formula: "PFI = geometric_mean(Fidelity, Gap-filling, Executability)",
      framing_decision_question: p2.framing_decision_question,
      framing_blocking_questions: p2.framing_blocking_questions,
      fidelity_score: fidelityScore,
      gap_filling_score: gapFillingScore,
      executability_score: executabilityScore,
      pfi,
    },
    serverComputed: pfi,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
