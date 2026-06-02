import { arithmeticMean } from "../helpers";
import {
  verdictClarityScore,
  firstActionScore,
  capitalAskScore,
  prioritySequencingScore,
  thresholdLegibilityScore,
} from "../thresholds";
import type { DimensionResult, Tier2SynthesisOutput } from "../../prompts/types";

export interface D5Input {
  tier2: Tier2SynthesisOutput;
  agentSelfReported: number | null;
}

/**
 * D5 — Actionability (internal code: ACTI)
 * ACTI = arithmetic_mean(Verdict Clarity, First Action Specificity, Capital Ask,
 *                         Priority Sequencing, Decision-Threshold Legibility)
 *
 * NOTE: Threshold Legibility scores PRESENTATION only — existence/soundness = P8 (D5/P8 re-scope applied).
 */
export function computeD5(input: D5Input): DimensionResult {
  const { d5 } = input.tier2;

  const vcScore = verdictClarityScore(d5.verdict_clarity_type);
  const faScore = firstActionScore(
    d5.first_action_has_timeframe,
    d5.first_action_has_success_kill,
    d5.first_action_has_priority
  );
  const caScore = capitalAskScore(d5.capital_ask_type);
  const psScore = prioritySequencingScore(d5.priority_sequencing_type);
  const tlScore = thresholdLegibilityScore(
    d5.has_threshold,
    d5.has_default_action,
    d5.has_cost_of_delay
  );

  const acti = arithmeticMean([vcScore, faScore, caScore, psScore, tlScore]);

  const subScores: Record<string, number> = {
    verdictClarityScore: vcScore,
    firstActionScore: faScore,
    capitalAskScore: caScore,
    prioritySequencingScore: psScore,
    thresholdLegibilityScore: tlScore,
    acti,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(acti - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "D5",
    score: acti,
    subScores,
    traceabilityLog: {
      formula: "ACTI = arithmetic_mean(Verdict Clarity, First Action, Capital Ask, Priority Sequencing, Threshold Legibility)",
      note: "Threshold Legibility scores presentation/legibility only — existence/soundness of architecture = P8 (D5/P8 re-scope fix applied).",
      verdict_clarity_type: d5.verdict_clarity_type,
      verdict_clarity_score: vcScore,
      first_action_has_timeframe: d5.first_action_has_timeframe,
      first_action_has_success_kill: d5.first_action_has_success_kill,
      first_action_has_priority: d5.first_action_has_priority,
      first_action_score: faScore,
      capital_ask_type: d5.capital_ask_type,
      capital_ask_score: caScore,
      priority_sequencing_type: d5.priority_sequencing_type,
      priority_sequencing_score: psScore,
      has_threshold: d5.has_threshold,
      has_default_action: d5.has_default_action,
      has_cost_of_delay: d5.has_cost_of_delay,
      threshold_legibility_score: tlScore,
      acti,
    },
    serverComputed: acti,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
