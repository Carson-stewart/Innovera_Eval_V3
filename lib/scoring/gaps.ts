/**
 * lib/scoring/gaps.ts — Gap derivation from dimension results.
 *
 * Extracted from inngest/functions/scoreMemo.ts in Phase D2a so the explicit
 * ship-rule trigger is unit-testable. Gaps are grounded in traceabilityLog
 * findings, not score numbers alone (severity HIGH at serverComputed ≤ 2.0) —
 * with ONE explicit exception:
 *
 * SHIP RULE (D2a): a P1 result with majorReconciliations ≥ 2 produces a HIGH
 * gap REGARDLESS of its CI. "Memos ship at ≤ 1 major reconciliation failure"
 * was previously emergent — it held only because the minor-penalty cap almost
 * always binds, pushing any 2+-failure memo's CI to ≤ 2.0 (run 27 demonstrated
 * the leak under v1.0). The graduated penalty closed that instance; this
 * trigger makes the rule independent of the minor channel's behavior. Verified
 * zero-impact on the 43-run corpus under v1.1 values before shipping.
 */

import type { DimensionResult } from "../prompts/types";
import { deriveSpecificGap } from "./editGeneration";

export type GapRow = {
  dimensionKey: string;
  issue: string;
  impact: string;
  fix: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
};

const STAGE1_KEYS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];

/** Ship rule: P1 major reconciliation failures at or above this force a HIGH gap. */
export const SHIP_RULE_MAJOR_FAILURES = 2;

function p1MajorCount(dr: DimensionResult): number {
  const v = (dr.subScores as Record<string, unknown>)?.majorReconciliations;
  return typeof v === "number" ? v : 0;
}

/**
 * Derive Gaps from traceabilityLog findings — NOT from score numbers alone.
 * Each gap issue/fix is grounded in what the engine actually found, matching
 * what the Breakdown tab surfaces.
 */
export function deriveGaps(dimensionResults: DimensionResult[]): GapRow[] {
  const gaps: GapRow[] = [];

  for (const dr of dimensionResults) {
    if (!STAGE1_KEYS.includes(dr.dimensionKey)) continue;
    if (dr.serverComputed === null) continue;
    const score = dr.serverComputed;

    // ── D2a explicit ship-rule trigger (before the score >= 4.0 skip) ────────
    if (dr.dimensionKey === "P1") {
      const majors = p1MajorCount(dr);
      if (majors >= SHIP_RULE_MAJOR_FAILURES) {
        const specific = deriveSpecificGap(dr);
        gaps.push({
          dimensionKey: "P1",
          issue:
            `Coherence — ship rule: ${majors} major reconciliation failures ` +
            `(memos ship at ≤ 1). ` +
            (specific?.issue ?? "The same metric appears with conflicting values across sections."),
          impact: specific?.impact ?? `Readiness erosion: ${((5 - score) * 2.5).toFixed(1)} points.`,
          fix:
            specific?.fix ??
            "Reconcile the conflicting figures across sections. For each conflict, either unify the value or explicitly label one as a scenario variant.",
          severity: "HIGH",
        });
        continue; // ship-rule gap supersedes the generic P1 gap
      }
    }

    if (score >= 4.0) continue; // no gap for well-scoring pillars

    const specific = deriveSpecificGap(dr);
    if (!specific) continue;

    gaps.push({
      dimensionKey: dr.dimensionKey,
      issue: specific.issue,
      impact: specific.impact,
      fix: specific.fix,
      severity: specific.severity,
    });
  }

  // Sort by severity (HIGH first) then by erosion (largest first)
  return gaps.sort((a, b) => {
    const sevOrd: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const sd = (sevOrd[a.severity] ?? 9) - (sevOrd[b.severity] ?? 9);
    if (sd !== 0) return sd;
    const scoreA = dimensionResults.find((d) => d.dimensionKey === a.dimensionKey)?.serverComputed ?? 3;
    const scoreB = dimensionResults.find((d) => d.dimensionKey === b.dimensionKey)?.serverComputed ?? 3;
    return scoreA - scoreB; // lower score → more erosion → first
  });
}
