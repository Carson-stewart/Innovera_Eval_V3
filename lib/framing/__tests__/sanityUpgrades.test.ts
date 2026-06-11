/**
 * Checker v1.2 upgrades — ground-truth validation on the Phase 1 framing corpus.
 * TOKEN-FREE: stage 2 is mocked everywhere; lib/framing/singleSource.ts cannot
 * reach an LLM (it never imports the OpenRouter client — asserted below).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  extractQuantities,
  extractCandidatePairs,
  buildAnchorInventory,
} from "../quantities";
import { runSingleSourceCheck, type Adjudicator } from "../singleSource";
import { computeGateVerdict, gateAllowsScoring } from "../gate";
import { ALL_CHECKS, CHECKS_BY_CATEGORY, SINGLE_SOURCE_CHECK } from "../checks";
import { PATTERNS } from "../patterns";

const FIXTURE_DIR = path.join(
  __dirname, "..", "..", "..", "scripts", "experiment-extraction", "output", "framings"
);
const fixture = (runId: number) =>
  fs.readFileSync(path.join(FIXTURE_DIR, `${runId}.txt`), "utf8");

const neverSame: Adjudicator = async () => ({ sameConcept: false, reasoning: "mock: not same" });

describe("registry — additive only", () => {
  it("the original 48 checks and 30 patterns are untouched; D18/P31 added", () => {
    expect(CHECKS_BY_CATEGORY.A).toHaveLength(8);
    expect(CHECKS_BY_CATEGORY.B).toHaveLength(13);
    expect(CHECKS_BY_CATEGORY.C).toHaveLength(10);
    expect(CHECKS_BY_CATEGORY.D).toHaveLength(17); // D18 deliberately NOT in the category prompt grouping
    expect(ALL_CHECKS).toHaveLength(49);
    expect(SINGLE_SOURCE_CHECK.id).toBe("D18");
    expect(SINGLE_SOURCE_CHECK.severity).toBe("Critical");
    expect(PATTERNS).toHaveLength(31);
    expect(PATTERNS[30].id).toBe("P31");
    expect(PATTERNS[30].caughtBy).toEqual(["D18"]);
  });

  it("stage-2 boundary is clean: singleSource/quantities never IMPORT the LLM client", () => {
    // (doc comments may mention the call pattern; what matters is the import graph)
    const importsLLM = /import[^;]*from\s+["'][^"']*openrouter/;
    const src = fs.readFileSync(path.join(__dirname, "..", "singleSource.ts"), "utf8");
    expect(src).not.toMatch(importsLLM);
    const quantitiesSrc = fs.readFileSync(path.join(__dirname, "..", "quantities.ts"), "utf8");
    expect(quantitiesSrc).not.toMatch(importsLLM);
    const gateSrc = fs.readFileSync(path.join(__dirname, "..", "gate.ts"), "utf8");
    expect(gateSrc).not.toMatch(importsLLM);
  });
});

describe("ground truth 1 — run 64 (Reckitt US): the non-negotiable test", () => {
  it("stage 1 emits the $150-200M vs $240–300M candidate pair", () => {
    const pairs = extractCandidatePairs(fixture(64));
    const target = pairs.find(
      (p) =>
        (p.a.raw.includes("150") && p.b.raw.includes("240")) ||
        (p.a.raw.includes("240") && p.b.raw.includes("150"))
    );
    expect(target).toBeDefined();
    expect(target!.a.unitClass).toBe("money:USD");
    // both are ranges — each is ONE value; the conflict is BETWEEN them
    expect(target!.sharedSignals.some((s) => s.includes("revenue"))).toBe(true);
  });

  it("with stage 2 affirming the human-agreed pair, D18 fires Critical and the gate is BLOCKED", async () => {
    const humanAgrees: Adjudicator = async (pair) => {
      const raws = pair.a.raw + " " + pair.b.raw;
      const isTheRevenuePair = raws.includes("150") && raws.includes("240");
      return { sameConcept: isTheRevenuePair, reasoning: "mock: Year-3 revenue expectation" };
    };
    const result = await runSingleSourceCheck(fixture(64), humanAgrees);
    expect(result.status).toBe("FAIL");
    expect(result.confirmed).toHaveLength(1);
    expect(result.issue).toContain("150");
    expect(result.issue).toContain("240");
    expect(result.location).toBeTruthy();

    const gate = computeGateVerdict([result.checkId], 0);
    expect(gate).toBe("BLOCKED");
  });
});

describe("ground truth 2 — run 58 (Zebra): anchor inventory", () => {
  it("lists $500M with count = 8 (distinct statements) and triggers the repetition warning", () => {
    const inventory = buildAnchorInventory(fixture(58));
    const anchor = inventory.find((a) => a.unit === "money:USD" && a.value.includes("500"));
    expect(anchor).toBeDefined();
    expect(anchor!.count).toBe(8);
    expect(anchor!.locations).toHaveLength(8);
    expect(anchor!.count).toBeGreaterThan(1); // → repetition warning line
    // repetition warnings feed PASS_WITH_WARNINGS when nothing Critical fails
    expect(computeGateVerdict([], inventory.filter((a) => a.count > 1).length)).toBe("PASS_WITH_WARNINGS");
  });
});

describe("ground truth 3 — run 60 (NEE): false-positive control", () => {
  it("no Critical from this check (stage-2 mock: a human pairs none of its candidates)", async () => {
    const result = await runSingleSourceCheck(fixture(60), neverSame);
    expect(result.status).toBe("PASS");
    // candidates it DID emit are listed in the validation report for human review
  });

  it("its repeated 5 MW value never self-pairs (equal values are one value)", () => {
    const pairs = extractCandidatePairs(fixture(60));
    expect(pairs.some((p) => p.a.unitClass === "unit:MW" && p.a.lo === p.b.lo)).toBe(false);
  });
});

describe("ground truth 4 — synthetic non-candidates", () => {
  it("a single stated range is ONE value, not a conflict", () => {
    const text = "The revenue expectation is $150-200M for Year 3.\nGrowth must support the plan.";
    expect(extractCandidatePairs(text)).toHaveLength(0);
    const qs = extractQuantities(text).filter((q) => q.unitClass === "money:USD");
    expect(qs).toHaveLength(1);
    expect(qs[0].lo).toBe(150e6);
    expect(qs[0].hi).toBe(200e6);
  });

  it("scenario-labeled variants are non-candidates", () => {
    const text = [
      "Base case: revenue target of $100M by Year 3.",
      "",
      "Upside scenario: revenue target of $150M by Year 3.",
    ].join("\n");
    expect(extractCandidatePairs(text)).toHaveLength(0);
  });

  it("time-distinguished values are non-candidates", () => {
    const text = [
      "The market is valued at $5 billion in 2025 market sizing.",
      "",
      "The market reaches $10 billion by 2035 market sizing.",
    ].join("\n");
    expect(extractCandidatePairs(text)).toHaveLength(0);
  });

  it("positive control: two unlabeled same-concept targets ARE a candidate", () => {
    const text = [
      "The venture's revenue target is $100M by Year 3.",
      "",
      "Success requires hitting the $200M revenue target within three years.",
    ].join("\n");
    const pairs = extractCandidatePairs(text);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs[0].sharedSignals.length).toBeGreaterThan(0);
  });

  it("different currencies never pair", () => {
    const text = [
      "The revenue target is ¥1 billion by 2030 for the venture.",
      "",
      "The revenue target equates to $6.7 million annually for the venture.",
    ].join("\n");
    const cross = extractCandidatePairs(text).filter((p) => p.a.unitClass !== p.b.unitClass);
    expect(cross).toHaveLength(0);
    expect(extractCandidatePairs(text)).toHaveLength(0);
  });
});

describe("gate verdict + scoring gate (T3)", () => {
  it("any Critical FAIL → BLOCKED", () => {
    expect(computeGateVerdict(["D18"], 0)).toBe("BLOCKED");
    expect(computeGateVerdict(["C10", "B2"], 0)).toBe("BLOCKED"); // C10 is Critical in the registry
  });

  it("Structural FAILs or anchor warnings → PASS_WITH_WARNINGS; clean → PASS", () => {
    expect(computeGateVerdict([], 2)).toBe("PASS_WITH_WARNINGS");
    expect(computeGateVerdict([], 0)).toBe("PASS");
  });

  it("advisory mode never blocks; enforced blocks BLOCKED and not-run", () => {
    expect(gateAllowsScoring("advisory", "BLOCKED").allowed).toBe(true);
    expect(gateAllowsScoring("advisory", null).allowed).toBe(true);
    expect(gateAllowsScoring("enforced", "BLOCKED").allowed).toBe(false);
    expect(gateAllowsScoring("enforced", null).allowed).toBe(false);
    expect(gateAllowsScoring("enforced", "PASS").allowed).toBe(true);
    expect(gateAllowsScoring("enforced", "PASS_WITH_WARNINGS").allowed).toBe(true);
  });
});
