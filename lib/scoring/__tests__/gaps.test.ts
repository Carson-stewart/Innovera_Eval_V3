/**
 * D2a — explicit ship-rule trigger in deriveGaps:
 * P1 with majorReconciliations >= 2 produces a HIGH gap regardless of CI.
 */
import { describe, it, expect } from "vitest";
import { deriveGaps } from "../gaps";
import type { DimensionResult } from "../../prompts/types";

function p1Result(serverComputed: number | null, majors: number, extras: Record<string, number> = {}): DimensionResult {
  return {
    dimensionKey: "P1",
    score: serverComputed,
    serverComputed,
    agentSelfReported: null,
    calibrationDrift: false,
    subScores: { majorReconciliations: majors, flatContradictions: 0, minorGaps: 0, definitionalDrifts: 0, reasoningGaps: 0, ...extras },
    traceabilityLog: {
      flat_contradictions: 0,
      major_reconciliation_failures: majors,
      minor_gaps: extras.minorGaps ?? 0,
      reasoning_gaps: extras.reasoningGaps ?? 0,
      minor_cap_applied: false,
    },
  };
}

describe("deriveGaps — D2a explicit ship-rule trigger", () => {
  it("f = 1 with low CI: severity comes from the CI rule, NOT the trigger", () => {
    // CI 2.0 via other channels → deriveSpecificGap yields HIGH by the <= 2 rule,
    // but the ship-rule wording must not appear (trigger requires f >= 2).
    const gaps = deriveGaps([p1Result(2.0, 1)]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].issue).not.toContain("ship rule");
    // and at CI 3 with f = 1 the gap is MEDIUM, as before
    const medium = deriveGaps([p1Result(3.0, 1)]);
    expect(medium[0].severity).toBe("MEDIUM");
  });

  it("f = 2 with artificially high CI: HIGH gap fires regardless of the score", () => {
    // CI 4.5 would normally be skipped entirely (score >= 4.0 → no gap).
    const gaps = deriveGaps([p1Result(4.5, 2)]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].severity).toBe("HIGH");
    expect(gaps[0].dimensionKey).toBe("P1");
    expect(gaps[0].issue).toContain("ship rule: 2 major reconciliation failures");
    expect(gaps[0].issue).toContain("memos ship at ≤ 1");
  });

  it("f = 4 at v1.1 CI 1.75: exactly one P1 gap, HIGH, naming the count", () => {
    const gaps = deriveGaps([p1Result(1.75, 4, { minorGaps: 1, reasoningGaps: 4 })]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].severity).toBe("HIGH");
    expect(gaps[0].issue).toContain("4 major reconciliation failures");
  });

  it("f = 0 high CI: no gap at all", () => {
    expect(deriveGaps([p1Result(4.5, 0)])).toHaveLength(0);
  });

  it("not-scored P1 (null) produces no gap — trigger does not bypass the null guard", () => {
    expect(deriveGaps([p1Result(null, 5)])).toHaveLength(0);
  });

  it("non-P1 dimensions are unaffected by the trigger", () => {
    const d1: DimensionResult = {
      dimensionKey: "D1", score: 1.8, serverComputed: 1.8, agentSelfReported: null,
      calibrationDrift: false, subScores: { majorReconciliations: 5 }, traceabilityLog: {},
    };
    // D1 is Stage 2 → deriveGaps skips it entirely
    expect(deriveGaps([d1])).toHaveLength(0);
  });
});
