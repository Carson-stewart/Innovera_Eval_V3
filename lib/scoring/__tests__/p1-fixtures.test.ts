/**
 * computeP1 fixtures — V3 v1.1 graduated major-reconciliation penalty (C2).
 *
 * Phase B pinned these fixtures to the v1.0 flat penalty; under v1.1 the
 * expectations for runs 23 and 38 INTENTIONALLY change (approved at the C0
 * checkpoint). The old-formula outputs remain pinned where they belong: in the
 * C0 replay report's "stored" columns
 * (scripts/engine-replay/output/approved-replay-report.csv).
 */
import { describe, it, expect } from "vitest";
import { computeP1, gradedMajorPenalty } from "../stage1/p1";
import type { Tier2SynthesisOutput, ReconciliationEntry } from "../../prompts/types";

function recon(n: number): ReconciliationEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    quoteA: `quote A ${i}`,
    quoteB: `quote B ${i}`,
    description: `conflict ${i}`,
    locations: [`Chapter ${i % 5}`],
  }));
}

/** Minimal Tier-2 fixture — computeP1 reads only the p1_* fields. */
function tier2Fixture(counts: {
  flats: number; majors: number; minors: number; drifts: number; reasoning: number; tension: boolean;
}): Tier2SynthesisOutput {
  return {
    p1_cross_chapter_contradictions: Array.from({ length: counts.flats }, (_, i) => ({
      quoteA: `flat A ${i}`, quoteB: `flat B ${i}`, location: `Chapter ${i}`,
    })),
    p1_cross_chapter_reconciliation_failures: recon(counts.majors),
    p1_cross_chapter_minor_gaps: Array.from({ length: counts.minors }, (_, i) => `minor gap ${i}`),
    p1_cross_chapter_definitional_drifts: Array.from({ length: counts.drifts }, (_, i) => `drift ${i}`),
    p1_cross_chapter_reasoning_gaps: Array.from({ length: counts.reasoning }, (_, i) => ({
      quote: `reasoning quote ${i}`, description: `gap ${i}`,
    })),
    p1_tension_acknowledged: counts.tension ? "tension acknowledged" : null,
  } as unknown as Tier2SynthesisOutput;
}

describe("gradedMajorPenalty — V3 v1.1 schedule", () => {
  it("f=0 → 0", () => expect(gradedMajorPenalty(0)).toBe(0));
  it("f=1 → 1.0", () => expect(gradedMajorPenalty(1)).toBe(1.0));
  it("f=2 → 2.0 (cliff preserved)", () => expect(gradedMajorPenalty(2)).toBe(2.0));
  it("f=3 → 2.25", () => expect(gradedMajorPenalty(3)).toBe(2.25));
  it("f=6 → 3.0", () => expect(gradedMajorPenalty(6)).toBe(3.0));
  it("f=15 → capped at 3.5", () => expect(gradedMajorPenalty(15)).toBe(3.5));
});

describe("computeP1 — stored-run fixtures under the v1.1 graduated penalty", () => {
  // Run 23 (Ecolab_Parallel_Gen.md): flats 0, majors 6, minorGaps 6, drifts 0,
  // reasoning 19, tension 0.5. v1.0 stored CI 2 → v1.1 CI 1 (majorPenalty 3.0).
  it("run 23's counts: CI 1, penalties 4.5 (intentional v1.1 change)", () => {
    const r = computeP1({
      tier1Chapters: [],
      tier2: tier2Fixture({ flats: 0, majors: 6, minors: 6, drifts: 0, reasoning: 19, tension: true }),
      agentSelfReported: null,
    });
    expect(r.serverComputed).toBe(1);
    expect(r.score).toBe(1);
    expect(r.subScores.flatContradictions).toBe(0);
    expect(r.subScores.majorReconciliations).toBe(6);
    expect(r.subScores.minorGaps).toBe(6);
    expect(r.subScores.definitionalDrifts).toBe(0);
    expect(r.subScores.reasoningGaps).toBe(19);
    expect(r.subScores.flatPenalty).toBe(0);
    expect(r.subScores.majorPenalty).toBe(3.0);
    expect(r.subScores.minorCombinedPenalty).toBe(1.5);
    expect(r.subScores.totalPenalties).toBe(4.5);
    expect(r.subScores.bonus).toBe(0.5);
  });

  // Run 38 (MN_4_1.docx): majors 14 → majorPenalty capped at 3.5; CI clamps to 1.
  it("run 38's counts: CI 1 with majorPenalty capped at 3.5 (intentional v1.1 change)", () => {
    const r = computeP1({
      tier1Chapters: [],
      tier2: tier2Fixture({ flats: 0, majors: 14, minors: 13, drifts: 3, reasoning: 27, tension: true }),
      agentSelfReported: null,
    });
    expect(r.serverComputed).toBe(1);
    expect(r.subScores.majorReconciliations).toBe(14);
    expect(r.subScores.majorPenalty).toBe(3.5);
    expect(r.subScores.minorCombinedPenalty).toBe(1.5);
    expect(r.subScores.totalPenalties).toBe(5);
    expect(r.subScores.bonus).toBe(0.5);
  });

  // Run 41 (ecolab3.docx): majors 1 → unchanged from v1.0 (CI 3).
  it("run 41's counts: CI 3 — unchanged by the graduated penalty", () => {
    const r = computeP1({
      tier1Chapters: [],
      tier2: tier2Fixture({ flats: 0, majors: 1, minors: 9, drifts: 0, reasoning: 10, tension: true }),
      agentSelfReported: null,
    });
    expect(r.serverComputed).toBe(3);
    expect(r.subScores.majorReconciliations).toBe(1);
    expect(r.subScores.majorPenalty).toBe(1);
    expect(r.subScores.minorCombinedPenalty).toBe(1.5);
    expect(r.subScores.totalPenalties).toBe(2.5);
    expect(r.subScores.bonus).toBe(0.5);
  });
});

describe("computeP1 — findings pass-through (B2 additive)", () => {
  it("collects major reconciliation entries verbatim without touching the score", () => {
    const r = computeP1({
      tier1Chapters: [],
      tier2: tier2Fixture({ flats: 0, majors: 6, minors: 6, drifts: 0, reasoning: 19, tension: true }),
      agentSelfReported: null,
    });
    expect(r.findings).toBeDefined();
    expect(r.findings!.totalFound).toBe(6); // cross-chapter minor gaps are strings → count-only
    expect(r.findings!.truncated).toBe(false);
    expect(r.findings!.entries).toHaveLength(6);
    expect(r.findings!.entries[0]).toMatchObject({
      kind: "major_reconciliation",
      scope: "cross_chapter",
      quoteA: "quote A 0",
      quoteB: "quote B 0",
      locations: ["Chapter 0"],
    });
  });

  it("caps stored entries at 50 with a truncation marker, score unchanged", () => {
    const r = computeP1({
      tier1Chapters: [],
      tier2: tier2Fixture({ flats: 0, majors: 60, minors: 0, drifts: 0, reasoning: 0, tension: false }),
      agentSelfReported: null,
    });
    expect(r.findings!.totalFound).toBe(60);
    expect(r.findings!.truncated).toBe(true);
    expect(r.findings!.entries).toHaveLength(50);
    // v1.1: 60 majors → graduated penalty capped at 3.5; the FINDINGS storage
    // cap (50) is independent of the penalty and changes nothing about it
    expect(r.subScores.majorPenalty).toBe(3.5);
    expect(r.serverComputed).toBe(1.5); // 5 − 3.5, no minors, no bonus
  });

  it("orders entries most-severe-first so the cap drops minors before majors", () => {
    const tier2 = tier2Fixture({ flats: 2, majors: 3, minors: 0, drifts: 0, reasoning: 0, tension: false });
    const r = computeP1({ tier1Chapters: [], tier2, agentSelfReported: null });
    expect(r.findings!.entries.map((e) => e.kind)).toEqual([
      "flat_contradiction", "flat_contradiction",
      "major_reconciliation", "major_reconciliation", "major_reconciliation",
    ]);
  });
});
