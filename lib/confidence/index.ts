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
 * Memo Confidence (Readiness) — V3 v1.1 exclusion rule.
 *
 * Not-scored pillars (null, e.g. P7 under the sparse-data protocol) are
 * EXCLUDED from readiness via rescaling over the scored pillars:
 *
 *   readiness = 100 − (8 / scoredCount) × Σ erosion(scored pillars), clamp [0, 100]
 *   (equivalently 20 × mean(scored pillars) where no per-pillar erosion cap binds)
 *
 * Rationale: simple exclusion (no rescale) would let an unscored pillar
 * contribute zero erosion — an implicit perfect 5 and a sparse-data gaming
 * vector. Rescaling keeps each scored pillar's weight identical to the
 * all-8-scored case. With all 8 pillars scored this reduces exactly to the
 * v1.0 formula (100 − Σ erosion).
 *
 * Stage-2 scores are NOT included (they form a separate profile).
 * @param stage1Scores Array of 8 Stage-1 pillar scores (P1–P8); null = not scored.
 * @throws if no pillar is scored (cannot legitimately occur).
 */
export function memoConfidence(stage1Scores: (number | null)[]): number {
  const scored = stage1Scores.filter((s): s is number => s !== null);
  if (scored.length === 0) {
    throw new Error("memoConfidence: no scored Stage-1 pillars — cannot compute readiness.");
  }
  const totalErosion = scored.reduce((sum, score) => sum + erosionFromScore(score), 0);
  const rescaled = (8 / scored.length) * totalErosion;
  return Math.min(Math.max(100 - rescaled, 0), 100);
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

/** Stage-2 floor (V3 v1.1): any D dimension at or below this caps the badge at NEEDS_WORK. */
export const STAGE2_FLOOR = 2.0;

/**
 * Status badge (V3 v1.1):
 * - MAJOR_REWORK: conf < 50 OR any HIGH severity gap (Stage 1/readiness driven — unchanged)
 * - READY_TO_SHIP: conf >= 75 AND no HIGH severity gaps AND no Stage-2 dimension <= 2.0
 * - NEEDS_WORK: everything else, including a would-be READY_TO_SHIP held back by a
 *   Stage-2 floor (any D dimension <= 2.0)
 *
 * The Stage-2 floor is a GATE, not a combination: the gate consults both score
 * profiles, but Stage 1 and Stage 2 numbers are never merged into one number.
 * @param stage2Scores The 5 Stage-2 dimension scores (D1–D5); null = not scored
 *   (a not-scored dimension cannot trip the floor). Optional for callers that
 *   predate v1.1 (omitting it preserves v1.0 behavior).
 */
export type StatusBadge = "READY_TO_SHIP" | "NEEDS_WORK" | "MAJOR_REWORK";

export function statusBadge(
  memoConf: number,
  gaps: GapEntry[],
  stage2Scores?: (number | null)[]
): StatusBadge {
  const hasHighGap = gaps.some((g) => g.severity === "HIGH");

  if (memoConf < MAJOR_REWORK_THRESHOLD || hasHighGap) {
    return "MAJOR_REWORK";
  }

  if (memoConf >= READY_TO_SHIP_THRESHOLD && !hasHighGap) {
    const stage2Floored = (stage2Scores ?? []).some(
      (s) => s !== null && s <= STAGE2_FLOOR
    );
    if (stage2Floored) return "NEEDS_WORK";
    return "READY_TO_SHIP";
  }

  return "NEEDS_WORK";
}
