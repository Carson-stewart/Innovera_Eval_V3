/**
 * D3 — k-run verification aggregation: mean, spread, worst-of-group consensus.
 */
import { describe, it, expect } from "vitest";
import { aggregateVerification, type VerificationRunSummary } from "../verification";

const r = (runId: number, memoConfidence: number, statusBadge: string): VerificationRunSummary => ({
  runId, memoConfidence, statusBadge, scoredAt: "2026-06-11T00:00:00.000Z",
});

describe("aggregateVerification", () => {
  it("computes mean and spread over three runs", () => {
    const agg = aggregateVerification([
      r(1, 80, "READY_TO_SHIP"),
      r(2, 78, "READY_TO_SHIP"),
      r(3, 83, "READY_TO_SHIP"),
    ]);
    expect(agg.count).toBe(3);
    expect(agg.meanReadiness).toBeCloseTo((80 + 78 + 83) / 3, 6);
    expect(agg.spread).toBeCloseTo(5, 6);
    expect(agg.consensusBadge).toBe("READY_TO_SHIP");
  });

  it("consensus is worst-of-three: one NEEDS_WORK drags two READY_TO_SHIP down", () => {
    const agg = aggregateVerification([
      r(1, 80, "READY_TO_SHIP"),
      r(2, 76, "NEEDS_WORK"),
      r(3, 81, "READY_TO_SHIP"),
    ]);
    expect(agg.consensusBadge).toBe("NEEDS_WORK");
  });

  it("MAJOR_REWORK dominates everything", () => {
    const agg = aggregateVerification([
      r(1, 80, "READY_TO_SHIP"),
      r(2, 79, "MAJOR_REWORK"),
      r(3, 81, "NEEDS_WORK"),
    ]);
    expect(agg.consensusBadge).toBe("MAJOR_REWORK");
  });

  it("identical runs → zero spread", () => {
    const agg = aggregateVerification([r(1, 75, "READY_TO_SHIP"), r(2, 75, "READY_TO_SHIP")]);
    expect(agg.spread).toBe(0);
    expect(agg.meanReadiness).toBe(75);
  });

  it("single-run group is valid (anchor before re-scores complete)", () => {
    const agg = aggregateVerification([r(1, 60, "NEEDS_WORK")]);
    expect(agg.count).toBe(1);
    expect(agg.spread).toBe(0);
    expect(agg.consensusBadge).toBe("NEEDS_WORK");
  });

  it("throws on an empty group", () => {
    expect(() => aggregateVerification([])).toThrow();
  });
});
