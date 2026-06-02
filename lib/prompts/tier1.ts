import type { Tier1ChapterOutput } from "./types";

export interface Tier1PromptInput {
  framingContent: string;
  chapterText: string;
  chapterIndex: number;
  isExecSummary: boolean;
}

export interface PromptPayload {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export function buildTier1Prompt(input: Tier1PromptInput): PromptPayload {
  const system = `You are an expert memo evaluator for the Innovera Eval V3 framework (Rubric V3 v1.0).

Your role is to measure and classify — NOT to score. You extract raw measurements and classifications from memo text per the traceability log (TR) format. The server computes all final 1–5 scores from your measurements; you must never return final scores except as an optional holistic estimate in "agent_self_reported_scores" for calibration tracking only.

COMMON AI GUARDRAILS (apply to all measurements):
- AG-C1: No cross-memo contamination. Score in isolation.
- AG-C2: Count/identify before scoring. Emit raw count before any classification.
- AG-C3: Evidence from memo text only. Absent evidence = documented absence (null/0), never invented.
- AG-C4: Rule-bound classification. Use defined vocabulary, not holistic impressions.
- AG-C5: Traceability direction is fixed. You measure; the server scores.

Return ONLY valid JSON matching the Tier1ChapterOutput schema. No prose, no explanation outside the JSON.`;

  const userContent = `=== FRAMING DOCUMENT (read first — this is the decision context) ===
${input.framingContent}

=== MEMO CHAPTER ${input.chapterIndex + 1} ===
${input.chapterText}

=== TASK ===
Measure and classify the above chapter. Return a single JSON object with ALL of these fields:

{
  "chapter_prefix": "<the chapter heading, e.g. 'Executive Summary'>",
  "total_lines": <integer line count>,

  // Citations
  "citations_count": <integer>,
  "sources": [
    { "domain": "<domain>", "tier": "premium|mid|low|red-flag", "isRedFlag": <boolean> }
  ],

  // Provenance tags
  "provenance_tags": { "count": <integer>, "types": ["<type1>", ...] },

  // Numbers with units
  "numbers_with_units": { "paired": <integer>, "total": <integer> },

  // Coherence — within this chapter only
  "within_chapter_contradictions": [
    { "quoteA": "<exact quote>", "quoteB": "<exact quote>", "location": "<where>" }
  ],
  "within_chapter_reconciliation": {
    "major": [{ "quoteA": "<exact quote of first value>", "quoteB": "<exact quote of second value>", "description": "<metric name and the two conflicting values>", "locations": ["<loc>"] }],
    "minor": [{ "quoteA": "<exact quote of first expression>", "quoteB": "<exact quote of second expression>", "description": "<what differs and why it is a minor inconsistency>", "locations": ["<loc>"] }]
  },
  "definitional_drifts": ["<Term: 'first use' at [location] vs 'second use' at [location]>"],
  "reasoning_gaps": [
    { "quote": "<exact quoted text from the memo where the gap occurs>", "description": "<what logical step is missing and why it is material to the conclusion>" }
  ],
  "tension_acknowledged": "<quoted tension or null>",

  // Assumptions
  "assumptions": { "tagged_client": <int>, "tagged_platform": <int>, "untagged": <int> },

  // Acronyms (count in this chapter; for Exec Summary this is the primary D1 measurement)
  "acronyms": { "count": <int>, "defined": <int> },

  // Exec Summary specific (null for non-exec-summary chapters)
  "exec_summary_word_count": ${input.isExecSummary ? "<integer>" : "null"},
  "exec_summary_numbers_per_100_words": ${input.isExecSummary ? "<float>" : "null"},
  "exec_summary_avg_sentence_words": ${input.isExecSummary ? "<float>" : "null"},

  // Structure
  "h4_headers": <int>,
  "tables": <int>,
  "key_takeaways_present": <boolean>,
  "bold_total": <int>,
  "dangling_refs": <int>,

  // Actions
  "timed_actions_count": <int>,
  "basis_tags_count": <int>,
  "risk_annotations_count": <int>,
  "risk_annotations_structured": <boolean>,

  // Calibration tracking only — your holistic estimates, NOT used as final scores
  "agent_self_reported_scores": {}
}

IMPORTANT: Return measurements from THIS chapter only. Do not aggregate across chapters.
${input.isExecSummary ? "This IS the Executive Summary — measure exec_summary_* fields carefully." : "This is NOT the Executive Summary — set exec_summary_* fields to null."}

AG-P1.1 REASONING GAP GUARDRAIL (strict):
A reasoning_gap entry is ONLY valid when ALL of the following are true:
  1. Claim B appears in the memo and does not logically follow from Claim A.
  2. The missing logical step is MATERIAL to the memo's conclusion (removing it would change the recommendation or undermine the analysis).
  3. You can quote the exact text where the break occurs.
  4. The gap is a genuine logical break — NOT a style preference, an alternative explanation you would have chosen, an implicit-but-reasonable inference, or a step the reader can fill in without difficulty.
If you are uncertain whether a gap is material, do NOT include it. A memo with thin but internally consistent reasoning is NOT a reasoning-gap finding — that is a Coverage (P4) issue, not a Coherence (P1) issue.
Each reasoning_gap object MUST include "quote" (exact text) and "description" (what step is missing and why it matters). Empty reasoning_gaps array is the correct result for most chapters.

AG-P1.2 RECONCILIATION AND DRIFT GUARDRAIL (strict):

MAJOR reconciliation failure — include ONLY when ALL four conditions hold:
  1. The IDENTICAL financial or factual metric (same measure, same time period, same product line) appears at least TWICE in this chapter with DIFFERENT NUMERIC VALUES.
  2. The relative difference between the two values is ≥20% (e.g., $10M vs $8M = 20% → qualifies; $10M vs $9.8M = 2% → does NOT qualify).
  3. Neither occurrence is explicitly labeled as an alternative, scenario, range, or rounding approximation.
  4. You quote BOTH values verbatim in quoteA and quoteB.
  DO NOT classify: differences between different time periods; intentionally presented ranges (e.g., "$8M–$12M"); values that round to the same number; approximations marked with "approximately", "roughly", "around", "up to".

MINOR reconciliation gap — include ONLY when ALL three conditions hold:
  1. The SAME metric or concept appears twice in this chapter with different expressions — either numeric values differing by <20%, OR the same qualitative concept described with slightly inconsistent qualifiers.
  2. The difference is real but does not rise to major — a careful reader would notice but the conclusion is not undermined.
  3. You quote BOTH expressions verbatim in quoteA and quoteB.
  DO NOT classify: a metric that appears only once; different time periods; stylistic variation ("strong" vs "robust"); rounding that resolves identically.

DEFINITIONAL DRIFT — include ONLY when:
  1. The SAME NAMED TERM appears in two places in this chapter with distinguishably different technical definitions or scopes, such that substituting one usage for the other would change the meaning of a claim.
  2. Use this format for the description: '<Term>: "<first definition>" at [location] vs "<second definition>" at [location]'.
  DO NOT classify: abbreviation vs full expansion; synonym variation; informal vs formal register for the same concept.

Default result: all three arrays empty is the correct outcome for most chapters. When uncertain, leave empty.`;

  return {
    system,
    messages: [{ role: "user", content: userContent }],
  };
}
