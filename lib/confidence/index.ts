// Confidence & Status Derivation Module

/** Erosion factor: (5 - score) * EROSION_FACTOR = per-pillar erosion contribution */
export const EROSION_FACTOR = 2.5;

/** Status badge thresholds */
export const READY_TO_SHIP_THRESHOLD = 75;
export const MAJOR_REWORK_THRESHOLD = 50;

/**
 * Compute confidence erosion from a single pillar score.
 * score=5 → 0 erosion; score=1 → 10 erosion (max).
 */
export function erosionFromScore(score: number): number {
  const raw = (5 - score) * EROSION_FACTOR;
  return Math.min(Math.max(raw, 0), 10);
}

/**
 * Memo Confidence = 100 − sum(erosion for each Stage-1 pillar score), clamp [0, 100].
 * Stage-2 scores are NOT included (they form a separate profile).
 * @param stage1Scores Array of 8 Stage-1 pillar scores (P1–P8).
 */
export function memoConfidence(stage1Scores: number[]): number {
  const totalErosion = stage1Scores.reduce(
    (sum, score) => sum + erosionFromScore(score),
    0
  );
  return Math.min(Math.max(100 - totalErosion, 0), 100);
}

/**
 * Decision Confidence = Memo Confidence × Risk Multiplier.
 * In v1.0 riskMultiplier is always 1.0.
 */
export function decisionConfidence(
  memoConf: number,
  riskMultiplier: number
): number {
  return memoConf * riskMultiplier;
}

/**
 * Stage-2 profile — separate from Memo Confidence.
 * Returns average Stage-2 score and a 2×2 quadrant label.
 * @param stage2Scores Array of 5 Stage-2 dimension scores (D1–D5).
 */
export function stage2Profile(stage2Scores: number[]): {
  avg: number;
  quadrant: string;
} {
  if (stage2Scores.length === 0) return { avg: 0, quadrant: "unknown" };
  const avg =
    stage2Scores.reduce((sum, s) => sum + s, 0) / stage2Scores.length;

  // 2×2 matrix interpretation (Stage1/Stage2):
  // This function only operates on stage2; the quadrant needs stage1 context.
  // Return avg and a descriptive quadrant label based on stage2 alone.
  let quadrant: string;
  if (avg >= 3.5) {
    quadrant = "high-stage2"; // High output quality — polished presentation
  } else if (avg >= 2.5) {
    quadrant = "medium-stage2"; // Adequate presentation
  } else {
    quadrant = "low-stage2"; // Weak presentation scaffolding
  }

  return { avg, quadrant };
}

export interface GapEntry {
  severity: string;
}

/**
 * Status badge:
 * - READY_TO_SHIP: conf >= 75 AND no HIGH severity gaps
 * - MAJOR_REWORK: conf < 50 OR any HIGH severity gap
 * - NEEDS_WORK: everything else
 */
export type StatusBadge = "READY_TO_SHIP" | "NEEDS_WORK" | "MAJOR_REWORK";

export function statusBadge(
  memoConf: number,
  gaps: GapEntry[]
): StatusBadge {
  const hasHighGap = gaps.some((g) => g.severity === "HIGH");

  if (memoConf < MAJOR_REWORK_THRESHOLD || hasHighGap) {
    return "MAJOR_REWORK";
  }

  if (memoConf >= READY_TO_SHIP_THRESHOLD && !hasHighGap) {
    return "READY_TO_SHIP";
  }

  return "NEEDS_WORK";
}
