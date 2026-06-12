import { clamp, baseMinusPenalties } from "../helpers";
import type { DimensionResult, DimensionFindings } from "../../prompts/types";
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
 * Penalty schedule (V3 v1.1):
 * - 1 flat contradiction: −2.0; 2+ flat contradictions: −3.0 (replaces, not additive)
 * - Major reconciliation failures — GRADUATED (v1.1, C2):
 *     0 → 0;  1 → −1.0;  f ≥ 2 → −min(3.5, 2 + 0.25 × (f − 2))
 *   The two-failure ship cliff is preserved (2 failures still → −2.0 and, with
 *   the saturated minor cap and tension bonus, CI = 2.0), while severity now
 *   registers below it: 6 failures → CI ≈ 1.0; 10+ → penalty cap 3.5.
 *   (v1.0 used a flat −2.0 for all f ≥ 2, hiding 3 vs 15 failures.)
 * - Minor categories (minor gaps + definitional drifts + reasoning gaps): −0.25 each,
 *   BUT capped at MINOR_COMBINED_CAP (−1.5) in total. These categories can lower the
 *   score but cannot floor it alone — only flat contradictions and major reconciliation
 *   failures are uncapped coherence killers. (Unchanged in v1.1 — recalibration is Phase D.)
 * - Tension bonus: +0.5 (max one). (Unchanged in v1.1.)
 */

/** V3 v1.1 graduated major-reconciliation penalty (C2). */
export function gradedMajorPenalty(failures: number): number {
  if (failures === 0) return 0;
  if (failures === 1) return 1.0;
  return Math.min(3.5, 2 + 0.25 * (failures - 2));
}

/** Maximum total penalty from the three minor-deduction categories combined. */
const MINOR_COMBINED_CAP = 1.5;

/** Storage cap for persisted raw findings (bounds row size on pathological memos). */
const FINDINGS_STORAGE_CAP = 50;

/**
 * Collect raw finding detail for persistence (Phase B2).
 *
 * PURELY ADDITIVE: reads the same arrays the count computation reads, but never
 * feeds back into any count, penalty, or score. Entries are collected
 * most-severe-first (flat contradictions → major reconciliations → minor
 * reconciliations) so the storage cap drops the least important detail first.
 * Reasoning gaps and definitional drifts are not quote-pair findings and remain
 * count-only, as before.
 */
function collectFindings(
  tier1Chapters: Tier1ChapterOutput[],
  tier2: Tier2SynthesisOutput
): DimensionFindings {
  const all: DimensionFindings["entries"] = [];

  // Flat contradictions (most severe)
  for (const e of tier2.p1_cross_chapter_contradictions) {
    all.push({ kind: "flat_contradiction", scope: "cross_chapter", quoteA: e.quoteA, quoteB: e.quoteB, locations: [e.location] });
  }
  for (const ch of tier1Chapters) {
    for (const e of ch.within_chapter_contradictions) {
      all.push({ kind: "flat_contradiction", scope: "within_chapter", chapter: ch.chapter_prefix, quoteA: e.quoteA, quoteB: e.quoteB, locations: [e.location] });
    }
  }

  // Major reconciliation failures
  for (const e of tier2.p1_cross_chapter_reconciliation_failures) {
    all.push({ kind: "major_reconciliation", scope: "cross_chapter", quoteA: e.quoteA, quoteB: e.quoteB, description: e.description, locations: e.locations });
  }
  for (const ch of tier1Chapters) {
    for (const e of ch.within_chapter_reconciliation.major) {
      all.push({ kind: "major_reconciliation", scope: "within_chapter", chapter: ch.chapter_prefix, quoteA: e.quoteA, quoteB: e.quoteB, description: e.description, locations: e.locations });
    }
  }

  // Minor reconciliation entries (least severe quote-pair findings)
  for (const ch of tier1Chapters) {
    for (const e of ch.within_chapter_reconciliation.minor) {
      all.push({ kind: "minor_reconciliation", scope: "within_chapter", chapter: ch.chapter_prefix, quoteA: e.quoteA, quoteB: e.quoteB, description: e.description, locations: e.locations });
    }
  }
  // (cross-chapter minor gaps are plain strings, not quote pairs — count-only as before)

  return {
    version: 1,
    totalFound: all.length,
    truncated: all.length > FINDINGS_STORAGE_CAP,
    entries: all.slice(0, FINDINGS_STORAGE_CAP),
  };
}

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
  const majorPenalty = gradedMajorPenalty(majorReconciliations);

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
      formula:
        "CI = 5 − penalties + tension_bonus, clamp [1,5]; major penalty graduated (v1.1): 0→0, 1→1.0, f≥2→min(3.5, 2 + 0.25×(f−2))",
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
    // Raw finding detail for persistence — additive output, never a score input
    findings: collectFindings(tier1Chapters, tier2),
  };
}
