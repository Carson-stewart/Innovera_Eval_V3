import { arithmeticMean } from "../helpers";
import {
  timedActionsScore,
  basisTagsScore,
  riskAnnotationsScore,
  quantificationScore,
  selfContainmentScore,
} from "../thresholds";
import type { DimensionResult, Tier2SynthesisOutput } from "../../prompts/types";

export interface D4Input {
  tier2: Tier2SynthesisOutput;
  agentSelfReported: number | null;
}

/**
 * D4 — Communicative Completeness
 * CCI = arithmetic_mean(Timed Actions, Basis Tags, Risk Annotations,
 *                        Quantification Completeness, Self-Containment)
 *
 * NOTE: Self-Containment = Exec Summary standalone (NOT whole-memo consistency — that is P1).
 */
export function computeD4(input: D4Input): DimensionResult {
  const { d4 } = input.tier2;

  const taScore = timedActionsScore(d4.timed_actions_total);
  const btScore = basisTagsScore(d4.basis_tags_total);
  const raScore = riskAnnotationsScore(d4.risk_annotations_total, d4.risk_annotations_structured);
  const qScore = quantificationScore(d4.quantification_ratio);
  const scScore = selfContainmentScore(d4.exec_summary_cross_ref_dependencies);

  const cci = arithmeticMean([taScore, btScore, raScore, qScore, scScore]);

  const subScores: Record<string, number> = {
    timedActionsScore: taScore,
    basisTagsScore: btScore,
    riskAnnotationsScore: raScore,
    quantificationScore: qScore,
    selfContainmentScore: scScore,
    cci,
    timedActionsTotal: d4.timed_actions_total,
    basisTagsTotal: d4.basis_tags_total,
    riskAnnotationsTotal: d4.risk_annotations_total,
    quantificationRatio: d4.quantification_ratio,
    execSummaryCrossRefDependencies: d4.exec_summary_cross_ref_dependencies,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(cci - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "D4",
    score: cci,
    subScores,
    traceabilityLog: {
      formula: "CCI = arithmetic_mean(Timed Actions, Basis Tags, Risk Annotations, Quantification, Self-Containment)",
      note: "Self-Containment = Exec Summary standalone only; whole-memo consistency = P1 (D4/P1 independence fix applied).",
      timed_actions_total: d4.timed_actions_total,
      timed_actions_score: taScore,
      basis_tags_total: d4.basis_tags_total,
      basis_tags_score: btScore,
      risk_annotations_total: d4.risk_annotations_total,
      risk_annotations_structured: d4.risk_annotations_structured,
      risk_annotations_score: raScore,
      numbers_paired: d4.numbers_paired_total,
      numbers_total: d4.numbers_total,
      quantification_ratio: d4.quantification_ratio,
      quantification_score: qScore,
      exec_summary_cross_ref_dependencies: d4.exec_summary_cross_ref_dependencies,
      self_containment_score: scScore,
      cci,
    },
    serverComputed: cci,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
