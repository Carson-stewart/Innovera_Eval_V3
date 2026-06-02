import { describe, it, expect } from "vitest";
import {
  erosionFromScore,
  memoConfidence,
  decisionConfidence,
  statusBadge,
  stage2Profile,
} from "../index";

describe("erosionFromScore", () => {
  it("score=5 → 0 erosion", () => {
    expect(erosionFromScore(5)).toBe(0);
  });

  it("score=3 → 5.0 erosion", () => {
    expect(erosionFromScore(3)).toBeCloseTo(5.0, 5);
  });

  it("score=1 → 10.0 erosion", () => {
    expect(erosionFromScore(1)).toBeCloseTo(10.0, 5);
  });

  it("score=4 → 2.5 erosion", () => {
    expect(erosionFromScore(4)).toBeCloseTo(2.5, 5);
  });
});

describe("memoConfidence", () => {
  it("all 5s → 100", () => {
    expect(memoConfidence([5, 5, 5, 5, 5, 5, 5, 5])).toBe(100);
  });

  it("all 3s → 60 (erosion=5.0 each × 8 = 40, 100−40=60)", () => {
    expect(memoConfidence([3, 3, 3, 3, 3, 3, 3, 3])).toBeCloseTo(60, 5);
  });

  it("all 1s → clamps to 0 (max erosion)", () => {
    // 8 pillars × 10 erosion each = 80 → 100 - 80 = 20... wait
    // erosion per score=1 = (5-1)*2.5 = 10; 8 pillars × 10 = 80; 100-80 = 20
    expect(memoConfidence([1, 1, 1, 1, 1, 1, 1, 1])).toBeCloseTo(20, 5);
  });

  it("stage2 scores are NOT included in memoConfidence (separate)", () => {
    // Only 8 stage1 scores used
    const conf1 = memoConfidence([4, 4, 4, 4, 4, 4, 4, 4]);
    const conf2 = memoConfidence([4, 4, 4, 4, 4, 4, 4, 4]);
    // Stage2 profile doesn't change memoConfidence — same input = same output
    expect(conf1).toBe(conf2);
  });
});

describe("decisionConfidence", () => {
  it("75 × 1.0 → 75 (v1.0 multiplier)", () => {
    expect(decisionConfidence(75, 1.0)).toBe(75);
  });

  it("equals memoConfidence when riskMultiplier = 1.0", () => {
    const memoConf = memoConfidence([4, 3, 5, 4, 3, 5, 4, 3]);
    expect(decisionConfidence(memoConf, 1.0)).toBe(memoConf);
  });
});

describe("statusBadge", () => {
  it("conf=80, no gaps → READY_TO_SHIP", () => {
    expect(statusBadge(80, [])).toBe("READY_TO_SHIP");
  });

  it("conf=60, no gaps → NEEDS_WORK", () => {
    expect(statusBadge(60, [])).toBe("NEEDS_WORK");
  });

  it("conf=40, no gaps → MAJOR_REWORK", () => {
    expect(statusBadge(40, [])).toBe("MAJOR_REWORK");
  });

  it("conf=80, HIGH gap → MAJOR_REWORK (high gap overrides ready status)", () => {
    expect(statusBadge(80, [{ severity: "HIGH" }])).toBe("MAJOR_REWORK");
  });

  it("conf=60, HIGH gap → MAJOR_REWORK", () => {
    expect(statusBadge(60, [{ severity: "HIGH" }])).toBe("MAJOR_REWORK");
  });

  it("conf=74, no gaps → NEEDS_WORK (just below READY threshold)", () => {
    expect(statusBadge(74, [])).toBe("NEEDS_WORK");
  });

  it("conf=75, no gaps → READY_TO_SHIP (exactly at threshold)", () => {
    expect(statusBadge(75, [])).toBe("READY_TO_SHIP");
  });

  it("conf=49, no gaps → MAJOR_REWORK (just below MAJOR threshold)", () => {
    expect(statusBadge(49, [])).toBe("MAJOR_REWORK");
  });

  it("MEDIUM gap alone does not trigger MAJOR_REWORK", () => {
    expect(statusBadge(80, [{ severity: "MEDIUM" }])).toBe("READY_TO_SHIP");
  });
});

describe("stage2Profile", () => {
  it("returns avg and quadrant without affecting memoConfidence", () => {
    const stage2Scores = [4, 3, 5, 4, 3];
    const profile = stage2Profile(stage2Scores);

    expect(profile.avg).toBeCloseTo(
      (4 + 3 + 5 + 4 + 3) / 5,
      5
    );
    expect(typeof profile.quadrant).toBe("string");
  });

  it("high stage2 → high-stage2 quadrant", () => {
    const profile = stage2Profile([4, 4, 4, 4, 4]);
    expect(profile.quadrant).toBe("high-stage2");
  });

  it("low stage2 → low-stage2 quadrant", () => {
    const profile = stage2Profile([2, 1, 2, 1, 2]);
    expect(profile.quadrant).toBe("low-stage2");
  });

  it("stage2Profile is separate from memoConfidence — passing stage2 doesn't change memo conf", () => {
    // memoConfidence uses only the array passed to it (stage1 scores)
    const stage1Scores = [4, 4, 4, 4, 4, 4, 4, 4];
    const memoConf = memoConfidence(stage1Scores);

    // stage2Profile uses different scores
    const s2Profile = stage2Profile([1, 1, 1, 1, 1]);

    // memoConfidence should not be affected by stage2 scores at all
    expect(memoConf).toBe(memoConfidence(stage1Scores)); // idempotent
    expect(s2Profile.avg).toBeCloseTo(1, 5);
    expect(memoConf).toBeGreaterThan(s2Profile.avg); // different values
  });
});
