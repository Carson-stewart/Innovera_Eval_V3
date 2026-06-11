/**
 * lib/confidence/verification.ts — D3 k-run verification aggregation.
 *
 * Pure display-level aggregation over a verification group (the anchor run +
 * its re-scores). Nothing here writes anywhere; no stored score is averaged
 * into any single run's record. The consensus badge is worst-of-group —
 * conservative by design: a memo ships only if every verification run says so.
 */

export interface VerificationRunSummary {
  runId: number;
  memoConfidence: number;
  statusBadge: string;
  scoredAt: string;
}

export interface VerificationAggregate {
  count: number;
  meanReadiness: number;
  /** max − min readiness across the group — the honest noise figure
   *  (P1 is cache-pinned across runs, so this measures the other pillars). */
  spread: number;
  /** Worst badge in the group: MAJOR_REWORK > NEEDS_WORK > READY_TO_SHIP. */
  consensusBadge: string;
}

const BADGE_SEVERITY: Record<string, number> = {
  READY_TO_SHIP: 0,
  NEEDS_WORK: 1,
  MAJOR_REWORK: 2,
};

export function aggregateVerification(runs: VerificationRunSummary[]): VerificationAggregate {
  if (runs.length === 0) {
    throw new Error("aggregateVerification: empty group");
  }
  const readiness = runs.map((r) => r.memoConfidence);
  const meanReadiness = readiness.reduce((a, b) => a + b, 0) / readiness.length;
  const spread = Math.max(...readiness) - Math.min(...readiness);
  const consensusBadge = runs.reduce(
    (worst, r) =>
      (BADGE_SEVERITY[r.statusBadge] ?? 0) > (BADGE_SEVERITY[worst] ?? 0) ? r.statusBadge : worst,
    runs[0].statusBadge
  );
  return { count: runs.length, meanReadiness, spread, consensusBadge };
}
