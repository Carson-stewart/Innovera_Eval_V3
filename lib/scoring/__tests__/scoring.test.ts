import { describe, it, expect } from "vitest";
import { geometricMean, arithmeticMean } from "../helpers";
import { computeP1 } from "../stage1/p1";
import { computeP4 } from "../stage1/p4";
import { computeP7 } from "../stage1/p7";
import { computeP8 } from "../stage1/p8";
import { computeD1 } from "../stage2/d1";
import { move8Score } from "../thresholds";
import type {
  Tier1ChapterOutput,
  Tier2SynthesisOutput,
  Tier3P7Output,
} from "../../prompts/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

describe("geometricMean", () => {
  it("returns exact 4.0 for [4, 4, 4]", () => {
    expect(geometricMean([4, 4, 4])).toBeCloseTo(4.0, 5);
  });

  it("returns ~2.924 for [5, 1, 5]", () => {
    expect(geometricMean([5, 1, 5])).toBeCloseTo(2.924, 2);
  });

  it("handles zeros by flooring to 0.01", () => {
    const result = geometricMean([0, 4, 4]);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(4);
  });
});

// ─── P1 ─────────────────────────────────────────────────────────────────────

const emptyChapter: Tier1ChapterOutput = {
  chapter_prefix: "Test Chapter",
  total_lines: 100,
  citations_count: 10,
  sources: [],
  provenance_tags: { count: 0, types: [] },
  numbers_with_units: { paired: 0, total: 0 },
  within_chapter_contradictions: [],
  within_chapter_reconciliation: { major: [], minor: [] },
  definitional_drifts: [],
  reasoning_gaps: [],
  tension_acknowledged: null,
  assumptions: { tagged_client: 0, tagged_platform: 0, untagged: 0 },
  acronyms: { count: 0, defined: 0 },
  exec_summary_word_count: null,
  exec_summary_numbers_per_100_words: null,
  exec_summary_avg_sentence_words: null,
  h4_headers: 0,
  tables: 0,
  key_takeaways_present: false,
  bold_total: 0,
  dangling_refs: 0,
  timed_actions_count: 0,
  basis_tags_count: 0,
  risk_annotations_count: 0,
  risk_annotations_structured: false,
  agent_self_reported_scores: {},
};

const emptyTier2: Tier2SynthesisOutput = {
  p1_cross_chapter_contradictions: [],
  p1_cross_chapter_reconciliation_failures: [],
  p1_cross_chapter_minor_gaps: [],
  p1_cross_chapter_definitional_drifts: [],
  p1_cross_chapter_reasoning_gaps: [],
  p1_tension_acknowledged: null,
  p2: {
    framing_decision_question: "",
    framing_blocking_questions: [],
    fidelity_score: 3,
    gap_filling_score: 3,
    executability_score: 3,
  },
  p3_typology: "ONE_A",
  p3_expected_chapters: [],
  p3_present_chapters: [],
  p3_missing_chapters: [],
  p3_missing_subsections: [],
  p3_duplicate_headers: [],
  p3_wrong_template: false,
  p3_typology_refinement: false,
  p3_additional_chapters_count: 0,
  p4: {
    options_count: 2,
    options_has_comparison: false,
    options_score: 2,
    scenario_count: 1,
    scenario_params_varied: 1,
    scenarios_score: 2,
    sensitivities_type: "single",
    sensitivities_score: 3,
    ia_has_standalone_section: false,
    ia_count: 0,
    ia_score: 1,
  },
  p6: {
    has_top_level_section: false,
    sectional_count: 0,
    identification_score: 1,
    client_tagged: 0,
    platform_tagged: 0,
    has_provenance_table: false,
    source_type_count: 0,
    attribution_score: 1,
    validation_methods_linked_to_actions: 0,
    sensitivity_awareness_score: 1,
  },
  p8: {
    recommendation_quote: "",
    recommendation_quantified: false,
    recommendation_has_named_entities: false,
    specificity_score: 1,
    actions_with_all_four: 0,
    actions_with_two: 2,
    actions_with_none: 0,
    total_actions: 2,
    decision_architecture_score: 3,
    qa_basis_chains_count: 0,
    integration_quantified: false,
    integration_score: 1,
  },
  d3: {
    voice_type: "mixed",
    has_decision_h2: false,
    has_core_decision_label: false,
    executive_terms_matched_count: 5,
    hedge_marker_count: 3,
    strong_marker_count: 10,
    hedge_ratio: 0.23,
    salience_placement: "verdict-first",
  },
  d4: {
    timed_actions_total: 5,
    basis_tags_total: 1,
    risk_annotations_total: 5,
    risk_annotations_structured: false,
    numbers_paired_total: 80,
    numbers_total: 100,
    quantification_ratio: 0.8,
    exec_summary_cross_ref_dependencies: 1,
  },
  d5: {
    verdict_clarity_type: "clear",
    first_action_has_timeframe: true,
    first_action_has_success_kill: false,
    first_action_has_priority: false,
    capital_ask_type: "quantified",
    priority_sequencing_type: "partial",
    has_threshold: true,
    has_default_action: false,
    has_cost_of_delay: false,
  },
  agent_self_reported_scores: {},
};

describe("P1 — Coherence", () => {
  it("computes CI = 2.5 for 1 flat contradiction + 2 minor gaps", () => {
    // 1 flat contradiction = -2.0; 2 minor gaps = -0.5; total penalties = 2.5
    // CI = 5 - 2.5 = 2.5
    const chapterWithIssues: Tier1ChapterOutput = {
      ...emptyChapter,
      within_chapter_contradictions: [
        { quoteA: "Revenue is $10M", quoteB: "Revenue is $8M", location: "chapter 1" },
      ],
      within_chapter_reconciliation: {
        major: [],
        minor: [
          { quoteA: "revenue is $10M", quoteB: "revenue is $9.8M", description: "minor gap 1", locations: ["ch1"] },
          { quoteA: "margin ~60%", quoteB: "margin 58%", description: "minor gap 2", locations: ["ch1"] },
        ],
      },
    };

    const result = computeP1({
      tier1Chapters: [chapterWithIssues],
      tier2: emptyTier2,
      agentSelfReported: null,
    });

    expect(result.score).toBeCloseTo(2.5, 5);
    expect(result.dimensionKey).toBe("P1");
  });

  it("clamps to 1 on severe issues (2+ flat + 2+ major)", () => {
    // Severe: 2+ flat contradictions (-3.0) + 2+ major (-2.0) = -5.0 uncapped → clamp to 1
    // Minor gaps are capped at 1.5 and do not affect the floor here.
    const severeChapter: Tier1ChapterOutput = {
      ...emptyChapter,
      within_chapter_contradictions: [
        { quoteA: "A", quoteB: "B", location: "x" },
        { quoteA: "C", quoteB: "D", location: "y" },
        { quoteA: "E", quoteB: "F", location: "z" },
      ],
      within_chapter_reconciliation: {
        major: [
          { quoteA: "EBITDA $50M", quoteB: "EBITDA $30M", description: "major 1", locations: ["x"] },
          { quoteA: "headcount 200", quoteB: "headcount 120", description: "major 2", locations: ["y"] },
          { quoteA: "IRR 25%", quoteB: "IRR 15%", description: "major 3", locations: ["z"] },
        ],
        minor: new Array(10).fill({ quoteA: "a", quoteB: "b", description: "minor", locations: [] }),
      },
    };

    const result = computeP1({
      tier1Chapters: [severeChapter],
      tier2: emptyTier2,
      agentSelfReported: null,
    });

    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.score).toBe(1); // clamped by flat + major alone
  });

  it("minor-category cap: 32 reasoning gaps + 11 minor gaps cannot floor a zero-contradiction memo", () => {
    // This is the real-world failure case. 32 reasoning gaps × 0.25 = 8.0 raw,
    // 11 minor gaps × 0.25 = 2.75 raw → combined 10.75 raw.
    // With MINOR_COMBINED_CAP = 1.5: effective minor penalty = 1.5.
    // flatPenalty = 0, majorPenalty = 0 → CI = 5 - 1.5 = 3.5
    const manyGapsChapters: Tier1ChapterOutput[] = [
      {
        ...emptyChapter,
        reasoning_gaps: Array.from({ length: 32 }, (_, i) => ({
          quote: `quote ${i}`,
          description: `reasoning gap ${i}`,
        })),
        within_chapter_reconciliation: {
          major: [],
          minor: new Array(11).fill({ quoteA: "a", quoteB: "b", description: "minor", locations: [] }),
        },
      },
    ];

    const result = computeP1({
      tier1Chapters: manyGapsChapters,
      tier2: emptyTier2,
      agentSelfReported: null,
    });

    // Must NOT be 1.0 — zero flat contradictions cannot floor coherence
    expect(result.score).toBeGreaterThan(1);
    // With cap at 1.5: CI = 5 - 0 - 0 - 1.5 = 3.5
    expect(result.score).toBeCloseTo(3.5, 5);
    // Cap flag should be set in the trace
    const log = result.traceabilityLog as Record<string, unknown>;
    expect(log.minor_cap_applied).toBe(true);
    expect(log.minor_combined_cap).toBe(1.5);
  });
});

// ─── P4 ─────────────────────────────────────────────────────────────────────

describe("P4 — Coverage", () => {
  it("computes geomean of [3, 2, 4, 1] within 0.01", () => {
    // Expected: geomean([3, 2, 4, 1]) = (3×2×4×1)^(1/4) = 24^0.25 ≈ 2.213
    const tier2WithP4: Tier2SynthesisOutput = {
      ...emptyTier2,
      p4: {
        ...emptyTier2.p4,
        // Force sub-scores to produce exactly [3, 2, 4, 1] after threshold functions
        // options_count=2, no comparison → optionsScore=2
        // scenario_count=2, paramsVaried=1 → scenariosScore=3
        // sensitivities_type="none" → sensitivitiesScore=1
        // ia_has_standalone_section=false, ia_count=2 → iaScore=3
        // That gives [2, 3, 1, 3] → let's use direct values that map to [3,2,4,1]
        // options_count=3, has_comparison=false → 4; actually let's engineer it:
        // options=3, comparison=false → score=4
        // scenario_count=2, params=1 → score=3
        // sensitivities="multi" → score=5 (not matching)
        // Let's just verify geomean arithmetic directly
        options_count: 3,
        options_has_comparison: false,
        options_score: 4,
        scenario_count: 2,
        scenario_params_varied: 1,
        scenarios_score: 3,
        sensitivities_type: "none",
        sensitivities_score: 1,
        ia_has_standalone_section: false,
        ia_count: 1,
        ia_score: 2,
      },
    };

    // With options=3,no_comparison→4, scenarios=2,1param→3, sensitivities=none→1, ia=false,1→2
    // geomean([4, 3, 1, 2]) = (24)^0.25 ≈ 2.213
    const result = computeP4({
      tier2: tier2WithP4,
      agentSelfReported: null,
    });

    const expected = geometricMean([4, 3, 1, 2]);
    expect(result.score).toBeCloseTo(expected, 2);
    expect(result.covi).toBeCloseTo(expected, 2);
  });
});

// ─── P7 Sparse Data Protocol ────────────────────────────────────────────────

const emptyFicTests: Tier3P7Output["fic_tests"] = {
  revenue_to_headcount: "PASS",
  revenue_to_margin: "PASS",
  capital_to_plan: "PASS",
  growth_to_tam: "PASS",
  timeline_to_milestone: "NA",
};

const emptyFicReasons: Tier3P7Output["fic_test_reasons"] = {
  revenue_to_headcount: "test fixture",
  revenue_to_margin: "test fixture",
  capital_to_plan: "test fixture",
  growth_to_tam: "test fixture",
  timeline_to_milestone: "test fixture",
};

describe("P7 — Output Realism (sparse-data protocol)", () => {
  it("0 claims → NOT_SCORED (score = null)", () => {
    const result = computeP7({
      tier3P7: {
        claim_count: 0,
        np_claims: [],
        cc_records: [],
        fic_tests: emptyFicTests,
        fic_test_reasons: emptyFicReasons,
        agent_self_reported_ori: 3,
      },
      agentSelfReported: null,
    });

    expect(result.score).toBeNull();
    expect(result.serverComputed).toBeNull();
    expect((result.traceabilityLog as Record<string, unknown>).sparse_data_protocol).toBe("not-scored");
  });

  it("1 claim → minimal branch: ORI = mean(NP, CC) only", () => {
    const result = computeP7({
      tier3P7: {
        claim_count: 1,
        np_claims: [
          {
            quote: "Revenue $10M",
            metric: "Revenue",
            value: 10,
            unit: "M",
            classification: "in-range",
          },
        ],
        cc_records: [
          {
            quote: "Revenue will be $10M",
            certainty_vocab: "moderate",
            evidence_tier: 1,
            penalty: 0,
          },
        ],
        fic_tests: emptyFicTests,
        fic_test_reasons: emptyFicReasons,
        agent_self_reported_ori: 3,
      },
      agentSelfReported: null,
    });

    expect(result.score).not.toBeNull();
    expect((result.traceabilityLog as Record<string, unknown>).sparse_data_protocol).toBe("minimal");
    // NP: 1 in-range → score=5 (no OOR); CC: 0 penalty → score=5
    // ORI = mean(5, 5) = 5
    expect(result.score).toBeCloseTo(5, 2);
  });

  it("5 claims → full branch: ORI = mean(NP, CC, FIC)", () => {
    const claims = Array.from({ length: 5 }, (_, i) => ({
      quote: `Claim ${i}`,
      metric: "Revenue",
      value: 10,
      unit: "M",
      classification: "in-range" as const,
    }));

    const result = computeP7({
      tier3P7: {
        claim_count: 5,
        np_claims: claims,
        cc_records: [],
        fic_tests: emptyFicTests,
        fic_test_reasons: emptyFicReasons,
        agent_self_reported_ori: 4,
      },
      agentSelfReported: null,
    });

    expect((result.traceabilityLog as Record<string, unknown>).sparse_data_protocol).toBe("full");
    // NP: all in-range → 5; CC: no records → ccScore(0)=5; FIC: all pass/NA → 5
    // ORI = mean(5, 5, 5) = 5
    expect(result.score).toBeCloseTo(5, 2);
  });
});

// ─── P8 Move 8 independence ──────────────────────────────────────────────────

describe("P8 Move 8 — independence from P4 re-derivation", () => {
  it("covi=4.0 → move8Score=5", () => {
    expect(move8Score(4.0)).toBe(5);
  });

  it("covi=2.0 → move8Score=1 (floor)", () => {
    expect(move8Score(2.0)).toBe(1);
  });

  it("P8 reads passed-in covi, stores it in subScores.covi_used", () => {
    const result = computeP8({
      tier2: emptyTier2,
      covi: 4.0,
      agentSelfReported: null,
    });

    expect(result.subScores.covi_used).toBe(4.0);
    expect(result.subScores.move8Score).toBe(5);
  });

  it("P8 with covi=2.0 stores covi_used=2.0 and move8Score=1", () => {
    const result = computeP8({
      tier2: emptyTier2,
      covi: 2.0,
      agentSelfReported: null,
    });

    expect(result.subScores.covi_used).toBe(2.0);
    expect(result.subScores.move8Score).toBe(1);
  });
});

// ─── D1 ─────────────────────────────────────────────────────────────────────

describe("D1 — Interpretability", () => {
  it("computes II from known exec-summary measurements", () => {
    const execChapter: Tier1ChapterOutput = {
      ...emptyChapter,
      chapter_prefix: "Executive Summary",
      exec_summary_word_count: 1000,       // → length score 5 (800-1500)
      exec_summary_numbers_per_100_words: 2.5, // → density score 5
      exec_summary_avg_sentence_words: 18,  // → complexity score 5 (12-22)
      acronyms: { count: 2, defined: 2 },   // → acronym score 5 (≤2 total)
    };

    const result = computeD1({
      tier1Chapters: [execChapter],
      verdictPlacement: "front-loaded", // → verdictFirst score 5
      agentSelfReported: null,
    });

    // All 5 sub-scores = 5 → II = 5
    expect(result.score).toBeCloseTo(5, 2);
    expect(result.dimensionKey).toBe("D1");
  });

  it("computes II with mixed measurements", () => {
    const execChapter: Tier1ChapterOutput = {
      ...emptyChapter,
      chapter_prefix: "Executive Summary",
      exec_summary_word_count: 500,        // → length score 3 (400-600)
      exec_summary_numbers_per_100_words: 1.0, // → density score 2
      exec_summary_avg_sentence_words: 28, // → complexity score 3 (26-30)
      acronyms: { count: 5, defined: 3 },  // 2 undefined → score 4
    };

    const result = computeD1({
      tier1Chapters: [execChapter],
      verdictPlacement: "buried", // → verdictFirst score 2
      agentSelfReported: null,
    });

    // [2, 4, 2, 3, 3] → mean = 14/5 = 2.8
    const expected = arithmeticMean([2, 4, 2, 3, 3]);
    expect(result.score).toBeCloseTo(expected, 4);
  });
});
