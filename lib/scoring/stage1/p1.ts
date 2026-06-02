import { clamp, baseMinusPenalties } from "../helpers";
import type { DimensionResult } from "../../prompts/types";
import type { Tier1ChapterOutput, Tier2SynthesisOutput } from "../../prompts/types";

export interface P1Input {
  tier1Chapters: Tier1ChapterOutput[];
  tier2: Tier2SynthesisOutput;
  agentSelfReported: number | null;
}

/**
 * P1 — Coherence
 * CI = 5 − penalties + tension_bonus, clamp [1,5]
 *
 * Penalty schedule:
 * - 1 flat contradiction: −2.0; 2+ flat contradictions: −3.0 (replaces, not additive)
 * - 1 major reconciliation failure: −1.0; 2+ major: −2.0 (replaces)
 * - Minor categories (minor gaps + definitional drifts + reasoning gaps): −0.25 each,
 *   BUT capped at MINOR_COMBINED_CAP (−1.5) in total. These categories can lower the
 *   score but cannot floor it alone — only flat contradictions and major reconciliation
 *   failures are uncapped coherence killers.
 * - Tension bonus: +0.5 (max one)
 */

/** Maximum total penalty from the three minor-deduction categories combined. */
const MINOR_COMBINED_CAP = 1.5;

export function computeP1(input: P1Input): DimensionResult {
  const { tier1Chapters, tier2 } = input;

  // Aggregate all coherence defects from within-chapter (tier1) and cross-chapter (tier2)
  let flatContradictions = tier2.p1_cross_chapter_contradictions.length;
  let majorReconciliations = tier2.p1_cross_chapter_reconciliation_failures.length;
  let minorGaps = tier2.p1_cross_chapter_minor_gaps.length;
  let definitionalDrifts = tier2.p1_cross_chapter_definitional_drifts.length;
  let reasoningGaps = tier2.p1_cross_chapter_reasoning_gaps.length;

  for (const chapter of tier1Chapters) {
    flatContradictions += chapter.within_chapter_contradictions.length;
    majorReconciliations += chapter.within_chapter_reconciliation.major.length;
    minorGaps += chapter.within_chapter_reconciliation.minor.length;
    definitionalDrifts += chapter.definitional_drifts.length;
    reasoningGaps += chapter.reasoning_gaps.length;
  }

  // Tension acknowledged — either from tier2 aggregate or any chapter
  const tensionAcknowledged =
    tier2.p1_tension_acknowledged != null ||
    tier1Chapters.some((c) => c.tension_acknowledged != null);

  // ── Uncapped penalties (real coherence killers) ─────────────────────────────
  const flatPenalty = flatContradictions === 0 ? 0 : flatContradictions === 1 ? 2.0 : 3.0;
  const majorPenalty = majorReconciliations === 0 ? 0 : majorReconciliations === 1 ? 1.0 : 2.0;

  // ── Capped minor-category penalties ────────────────────────────────────────
  // Compute each raw sub-penalty, then cap their SUM at MINOR_COMBINED_CAP.
  // This prevents over-counting from a loose agent classification from flooring P1
  // on a memo that has zero flat contradictions.
  const minorPenaltyRaw = parseFloat((minorGaps * 0.25).toFixed(4));
  const driftPenaltyRaw = parseFloat((definitionalDrifts * 0.25).toFixed(4));
  const reasoningPenaltyRaw = parseFloat((reasoningGaps * 0.25).toFixed(4));
  const minorCombinedRaw = parseFloat((minorPenaltyRaw + driftPenaltyRaw + reasoningPenaltyRaw).toFixed(4));
  const minorCombinedPenalty = parseFloat(Math.min(minorCombinedRaw, MINOR_COMBINED_CAP).toFixed(4));
  const minorCapApplied = minorCombinedRaw > MINOR_COMBINED_CAP;

  // ── Total ───────────────────────────────────────────────────────────────────
  const totalPenalties = parseFloat((flatPenalty + majorPenalty + minorCombinedPenalty).toFixed(4));
  const bonus = tensionAcknowledged ? 0.5 : 0;

  const ci = clamp(5 - totalPenalties + bonus, 1, 5);

  const subScores: Record<string, number> = {
    flatContradictions,
    majorReconciliations,
    minorGaps,
    definitionalDrifts,
    reasoningGaps,
    flatPenalty,
    majorPenalty,
    minorPenaltyRaw,
    driftPenaltyRaw,
    reasoningPenaltyRaw,
    minorCombinedRaw,
    minorCombinedPenalty,
    totalPenalties,
    bonus,
    ci,
  };

  const calibrationDrift =
    input.agentSelfReported != null && Math.abs(ci - input.agentSelfReported) >= 1.0;

  return {
    dimensionKey: "P1",
    score: ci,
    subScores,
    traceabilityLog: {
      formula: "CI = 5 − penalties + tension_bonus, clamp [1,5]",
      flat_contradictions: flatContradictions,
      flat_penalty: flatPenalty,
      major_reconciliation_failures: majorReconciliations,
      major_penalty: majorPenalty,
      minor_gaps: minorGaps,
      minor_penalty_raw: minorPenaltyRaw,
      definitional_drifts: definitionalDrifts,
      drift_penalty_raw: driftPenaltyRaw,
      reasoning_gaps: reasoningGaps,
      reasoning_penalty_raw: reasoningPenaltyRaw,
      minor_combined_raw: minorCombinedRaw,
      minor_combined_penalty: minorCombinedPenalty,
      minor_cap_applied: minorCapApplied,
      minor_combined_cap: MINOR_COMBINED_CAP,
      total_penalties: totalPenalties,
      tension_bonus: bonus,
      ci,
    },
    serverComputed: ci,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
