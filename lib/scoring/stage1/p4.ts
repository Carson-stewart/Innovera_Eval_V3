import { geometricMean } from "../helpers";
import {
  optionsScore,
  scenariosScore,
  sensitivitiesScore,
  interpretiveAlternativesScore,
} from "../thresholds";
import type { DimensionResult, Tier2SynthesisOutput } from "../../prompts/types";

export interface P4Input {
  tier2: Tier2SynthesisOutput;
  agentSelfReported: number | null;
}

export interface P4Result extends DimensionResult {
  covi: number;
}

/**
 * P4 — Coverage
 * CovI = geometric_mean(Options, Scenarios, Sensitivities, IA), each 1–5
 * Returns CovI as a named field — used by P8 Move 8.
 */
export function computeP4(input: P4Input): P4Result {
  const { p4 } = input.tier2;

  const oScore = optionsScore(p4.options_count, p4.options_has_comparison);
  const sScore = scenariosScore(p4.scenario_count, p4.scenario_params_varied);
  const seScore = sensitivitiesScore(p4.sensitivities_type);
  const iaScore = interpretiveAlternativesScore(
    p4.ia_has_standalone_section,
    p4.ia_count
  );

  const covi = geometricMean([oScore, sScore, seScore, iaScore]);

  const subScores: Record<string, number> = {
    optionsScore: oScore,
    scenariosScore: sScore,
    sensitivitiesScore: seScore,
    iaScore,
    covi,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(covi - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "P4",
    score: covi,
    subScores,
    traceabilityLog: {
      formula: "CovI = geometric_mean(Options, Scenarios, Sensitivities, IA)",
      options_count: p4.options_count,
      options_has_comparison: p4.options_has_comparison,
      options_score: oScore,
      scenario_count: p4.scenario_count,
      scenario_params_varied: p4.scenario_params_varied,
      scenarios_score: sScore,
      sensitivities_type: p4.sensitivities_type,
      sensitivities_score: seScore,
      ia_has_standalone_section: p4.ia_has_standalone_section,
      ia_count: p4.ia_count,
      ia_score: iaScore,
      covi,
      note: "IA near-constant floor (1.5-2.0) is a known system pattern; score from explicit content per AG-P4.1.",
    },
    serverComputed: covi,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
    covi,
  };
}
