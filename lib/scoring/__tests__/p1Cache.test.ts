/**
 * C3 — P1 findings cache: key determinism and detection roundtrip.
 * Pure-function tests; the DB lookup/store lives in scoreMemo and is exercised
 * by the live pipeline.
 */
import { describe, it, expect } from "vitest";
import {
  computeP1CacheKey,
  extractP1Detection,
  applyP1Detection,
  type P1DetectionPayload,
} from "../p1Cache";
import type { Tier1ChapterOutput, Tier2SynthesisOutput } from "../../prompts/types";

const chapter = (prefix: string, majors: number): Tier1ChapterOutput =>
  ({
    chapter_prefix: prefix,
    within_chapter_contradictions: [],
    within_chapter_reconciliation: {
      major: Array.from({ length: majors }, (_, i) => ({
        quoteA: `${prefix} A${i}`, quoteB: `${prefix} B${i}`, description: `d${i}`, locations: [prefix],
      })),
      minor: [],
    },
    definitional_drifts: [],
    reasoning_gaps: [],
    tension_acknowledged: null,
    // non-P1 fields irrelevant to the cache — minimal stand-ins
    total_lines: 100,
    citations_count: 0,
    sources: [],
    provenance_tags: { count: 0, types: [] },
    numbers_with_units: { paired: 0, total: 0 },
  } as unknown as Tier1ChapterOutput);

const tier2 = (cross: number): Tier2SynthesisOutput =>
  ({
    p1_cross_chapter_contradictions: [],
    p1_cross_chapter_reconciliation_failures: Array.from({ length: cross }, (_, i) => ({
      quoteA: `xA${i}`, quoteB: `xB${i}`, description: `x${i}`, locations: ["Ch1", "Ch2"],
    })),
    p1_cross_chapter_minor_gaps: [],
    p1_cross_chapter_definitional_drifts: [],
    p1_cross_chapter_reasoning_gaps: [],
    p1_tension_acknowledged: "acknowledged",
  } as unknown as Tier2SynthesisOutput);

describe("computeP1CacheKey", () => {
  it("is deterministic: hashing the same fixture twice yields the same key", () => {
    const a = computeP1CacheKey("V3 v1.1", "framing text", "memo text");
    const b = computeP1CacheKey("V3 v1.1", "framing text", "memo text");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when memo content changes", () => {
    expect(computeP1CacheKey("V3 v1.1", "f", "memo A")).not.toBe(computeP1CacheKey("V3 v1.1", "f", "memo B"));
  });

  it("changes when framing content changes", () => {
    expect(computeP1CacheKey("V3 v1.1", "framing A", "m")).not.toBe(computeP1CacheKey("V3 v1.1", "framing B", "m"));
  });

  it("changes when the rubric version changes", () => {
    expect(computeP1CacheKey("V3 v1.0", "f", "m")).not.toBe(computeP1CacheKey("V3 v1.1", "f", "m"));
  });
});

describe("extract/apply detection roundtrip", () => {
  it("applying an extracted payload reproduces the original P1 fields", () => {
    const t1 = [chapter("Exec Summary", 2), chapter("Market", 1)];
    const t2 = tier2(3);
    const payload = extractP1Detection(t1, t2);

    // fresh outputs with DIFFERENT detection (simulating variance)
    const freshT1 = [chapter("Exec Summary", 5), chapter("Market", 0)];
    const freshT2 = tier2(11);

    const applied = applyP1Detection(freshT1, freshT2, payload);
    expect(applied).not.toBeNull();
    expect(applied!.tier1[0].within_chapter_reconciliation.major).toHaveLength(2);
    expect(applied!.tier1[1].within_chapter_reconciliation.major).toHaveLength(1);
    expect(applied!.tier2.p1_cross_chapter_reconciliation_failures).toHaveLength(3);
    // non-P1 fields of the FRESH outputs are preserved
    expect(applied!.tier1[0].chapter_prefix).toBe("Exec Summary");
  });

  it("returns null (treated as miss) on chapter-count mismatch", () => {
    const payload = extractP1Detection([chapter("A", 1)], tier2(1));
    const applied = applyP1Detection([chapter("A", 1), chapter("B", 1)], tier2(1), payload);
    expect(applied).toBeNull();
  });

  it("returns null on a malformed payload", () => {
    expect(applyP1Detection([chapter("A", 1)], tier2(1), {} as P1DetectionPayload)).toBeNull();
  });
});
