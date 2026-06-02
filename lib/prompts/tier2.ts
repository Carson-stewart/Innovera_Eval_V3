import type { Tier1ChapterOutput } from "./types";

export interface Tier2PromptInput {
  framingContent: string;
  tier1Results: Tier1ChapterOutput[];
  fullMemoContent: string;
  typology: string;
}

export interface PromptPayload {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export function buildTier2Prompt(input: Tier2PromptInput): PromptPayload {
  const system = `You are an expert memo evaluator for the Innovera Eval V3 framework (Rubric V3 v1.0).

Your role is CROSS-CHAPTER SYNTHESIS. You receive per-chapter measurements from Tier 1 and the full memo, and you classify cross-chapter patterns for pillars that require whole-memo analysis.

You measure and classify — NOT score. Return measurements and classifications only. The server computes all final scores. Include agent_self_reported_scores only for calibration tracking.

COMMON AI GUARDRAILS:
- AG-C1: Score this memo in isolation.
- AG-C2: Count/identify before any classification.
- AG-C3: Evidence from memo text only.
- AG-C4: Rule-bound classification.
- AG-C5: You measure; server scores.

Return ONLY valid JSON matching the Tier2SynthesisOutput schema.`;

  const tier1Summary = JSON.stringify(input.tier1Results, null, 2);

  const userContent = `=== FRAMING DOCUMENT (read first) ===
${input.framingContent}

=== TIER 1 CHAPTER RESULTS ===
${tier1Summary}

=== FULL MEMO TEXT ===
${input.fullMemoContent}

=== TASK ===
Perform cross-chapter synthesis. Return a single JSON object with ALL of these fields:

{
  // P1 — Cross-chapter coherence (contradictions between different chapters)
  "p1_cross_chapter_contradictions": [
    { "quoteA": "<exact quote + chapter>", "quoteB": "<exact quote + chapter>", "location": "<chapter pair>" }
  ],
  "p1_cross_chapter_reconciliation_failures": [
    { "quoteA": "<exact quote of first value + chapter>", "quoteB": "<exact quote of second value + chapter>", "description": "<metric and the two conflicting values>", "locations": ["<chapterA>", "<chapterB>"] }
  ],
  "p1_cross_chapter_minor_gaps": ["<quoteA: 'first expression (chapter)' vs quoteB: 'second expression (chapter)' — description of inconsistency>"],
  "p1_cross_chapter_definitional_drifts": ["<Term: 'first definition' at [chapter] vs 'second definition' at [chapter]>"],
  "p1_cross_chapter_reasoning_gaps": [
    { "quote": "<exact quoted text from the memo where the cross-chapter gap occurs>", "description": "<what logical step is missing across these chapters and why it is material>" }
  ],
  "p1_tension_acknowledged": "<quoted tension text or null>",

  // P2 — Problem formulation (framing alignment)
  "p2": {
    "framing_decision_question": "<quoted from framing>",
    "framing_blocking_questions": ["<list from framing>"],
    "fidelity_score": <1-5>,
    "gap_filling_score": <1-5>,
    "executability_score": <1-5>
  },

  // P3 — Structural fidelity
  "p3_typology": "${input.typology}",
  "p3_expected_chapters": ["<list for typology>"],
  "p3_present_chapters": ["<list found>"],
  "p3_missing_chapters": ["<list missing>"],
  "p3_missing_subsections": ["<list>"],
  "p3_duplicate_headers": ["<list>"],
  "p3_wrong_template": <boolean>,
  "p3_typology_refinement": <boolean>,
  "p3_additional_chapters_count": <int>,

  // P4 — Coverage
  "p4": {
    "options_count": <int>,
    "options_has_comparison": <boolean>,
    "options_score": <1-5>,
    "scenario_count": <int>,
    "scenario_params_varied": <int>,
    "scenarios_score": <1-5>,
    "sensitivities_type": "multi|single|threshold|none",
    "sensitivities_score": <1-5>,
    "ia_has_standalone_section": <boolean>,
    "ia_count": <int>,
    "ia_score": <1-5>
  },

  // P6 — Assumption quality
  "p6": {
    "has_top_level_section": <boolean>,
    "sectional_count": <int>,
    "identification_score": <1-5>,
    "client_tagged": <int>,
    "platform_tagged": <int>,
    "has_provenance_table": <boolean>,
    "source_type_count": <int>,
    "attribution_score": <1-5>,
    "validation_methods_linked_to_actions": <int>,
    "sensitivity_awareness_score": <1-5>
  },

  // P8 — Solution quality (Move 8 computed server-side from P4 CovI)
  "p8": {
    "recommendation_quote": "<quoted>",
    "recommendation_quantified": <boolean>,
    "recommendation_has_named_entities": <boolean>,
    "specificity_score": <1-5>,
    "actions_with_all_four": <int>,
    "actions_with_two": <int>,
    "actions_with_none": <int>,
    "total_actions": <int>,
    "decision_architecture_score": <1-5>,
    "qa_basis_chains_count": <int>,
    "integration_quantified": <boolean>,
    "integration_score": <1-5>
  },

  // D3 — Audience calibration
  "d3": {
    "voice_type": "exec|mostly-exec|mixed|operator-leaning|operator",
    "has_decision_h2": <boolean>,
    "has_core_decision_label": <boolean>,
    "executive_terms_matched_count": <int>,
    "hedge_marker_count": <int>,
    "strong_marker_count": <int>,
    "hedge_ratio": <float>,
    "salience_placement": "verdict-first-quantified|verdict-first|suboptimal|near-end|buried"
  },

  // D4 — Communicative completeness
  "d4": {
    "timed_actions_total": <int>,
    "basis_tags_total": <int>,
    "risk_annotations_total": <int>,
    "risk_annotations_structured": <boolean>,
    "numbers_paired_total": <int>,
    "numbers_total": <int>,
    "quantification_ratio": <float>,
    "exec_summary_cross_ref_dependencies": <int>
  },

  // D5 — Actionability
  "d5": {
    "verdict_clarity_type": "clear|conditional-no-criteria|implied|unclear|ambiguous",
    "first_action_has_timeframe": <boolean>,
    "first_action_has_success_kill": <boolean>,
    "first_action_has_priority": <boolean>,
    "capital_ask_type": "quantified-ranged|quantified|present|vague|absent",
    "priority_sequencing_type": "tagged|structured|partial|mentioned|none",
    "has_threshold": <boolean>,
    "has_default_action": <boolean>,
    "has_cost_of_delay": <boolean>
  },

  // Calibration tracking only
  "agent_self_reported_scores": {}
}

NOTE on P2: Quote the framing decision question verbatim from the framing document before scoring fidelity.
NOTE on P3: Expected chapters are determined by typology ${input.typology} per the framework. Financial Appendix and Six-T/Risk Analysis are excluded from completeness penalties (AG-P3.2).
NOTE on D4: exec_summary_cross_ref_dependencies counts cross-references in the Exec Summary only — NOT whole-memo consistency (that is P1).

AG-P1.1 CROSS-CHAPTER REASONING GAP GUARDRAIL (strict):
p1_cross_chapter_reasoning_gaps must only contain genuine logical breaks BETWEEN chapters — where a conclusion in Chapter X does not follow from evidence presented in Chapter Y, and the missing step is MATERIAL to the memo's overall recommendation.
Do NOT include: steps that are implicit but reasonable; thin coverage (that is P4 Coverage, not P1 Coherence); style differences between chapters; or cases where you would have argued the point differently.
Each entry MUST include "quote" (the exact text from the memo where the cross-chapter break occurs) and "description" (what step is missing and why it is material to the conclusion). An empty array is the correct result when no genuine cross-chapter logical breaks exist.

AG-P1.2 CROSS-CHAPTER RECONCILIATION AND DRIFT GUARDRAIL (strict):

p1_cross_chapter_reconciliation_failures — include ONLY when:
  1. The IDENTICAL metric (same measure, same time period, same product line) appears in TWO DIFFERENT CHAPTERS with DIFFERENT NUMERIC VALUES.
  2. The relative difference is ≥20%.
  3. Neither is labeled as scenario/range/approximation.
  4. Quote both values verbatim in quoteA (chapter A) and quoteB (chapter B).

p1_cross_chapter_minor_gaps — include ONLY when:
  1. The same metric or concept appears in two chapters with inconsistent expressions differing by <20%, OR the same concept has slightly incompatible qualifiers across chapters.
  2. Use the format: "quoteA: '<first expression> (ChapterName)' vs quoteB: '<second expression> (ChapterName)' — <brief description>".

p1_cross_chapter_definitional_drifts — include ONLY when:
  1. The same named term is given distinguishably different definitions across chapters.
  2. Use format: "<Term>: '<definition in ChapterA>' (ChapterA) vs '<definition in ChapterB>' (ChapterB)".

Default: all empty arrays is the correct result when no genuine cross-chapter inconsistencies exist.`;

  return {
    system,
    messages: [{ role: "user", content: userContent }],
  };
}
