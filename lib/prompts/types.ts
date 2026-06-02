// TypeScript types for all agent input/output JSON shapes
// These map exactly to the TR-log fields specified in the framework and hardening docs.

// ─────────────────────────────────────────────
// Tier 1 — Per-chapter measurements
// ─────────────────────────────────────────────

export interface SourceEntry {
  domain: string;
  tier: "premium" | "mid" | "low" | "red-flag";
  isRedFlag: boolean;
}

export interface WithinChapterContradiction {
  quoteA: string;
  quoteB: string;
  location: string;
}

export interface ReconciliationEntry {
  /** Exact verbatim quote of the first statement (must come from the memo text). */
  quoteA: string;
  /** Exact verbatim quote of the second statement that conflicts or drifts from quoteA. */
  quoteB: string;
  description: string;
  locations: string[];
}

export interface Tier1ChapterOutput {
  /** The chapter heading prefix (e.g. "Executive Summary", "Risk Analysis") */
  chapter_prefix: string;

  /** Total line count for this chapter */
  total_lines: number;

  // Citations
  citations_count: number;
  sources: SourceEntry[];

  // Provenance tags
  provenance_tags: {
    count: number;
    types: string[];
  };

  // Numbers with units
  numbers_with_units: {
    paired: number;
    total: number;
  };

  // Coherence (P1) — within chapter
  within_chapter_contradictions: WithinChapterContradiction[];
  within_chapter_reconciliation: {
    major: ReconciliationEntry[];
    minor: ReconciliationEntry[];
  };

  // Definitional drifts (P1)
  definitional_drifts: string[];

  // Reasoning gaps (P1) — each must include the quoted text where the gap occurs.
  // A reasoning gap is a genuine logical break: Claim B does not follow from Claim A
  // and the missing step is material to the conclusion. Style preferences, alternative
  // phrasings, and implicit-but-reasonable inferences do NOT qualify.
  reasoning_gaps: Array<{ quote: string; description: string }>;

  // Tension acknowledgment (P1 bonus — only meaningful if exec summary or final chapters)
  tension_acknowledged: string | null;

  // Assumptions (P6)
  assumptions: {
    tagged_client: number;
    tagged_platform: number;
    untagged: number;
  };

  // Acronyms (D1)
  acronyms: {
    count: number;
    defined: number;
  };

  // Exec Summary specific (D1) — null for non-exec-summary chapters
  exec_summary_word_count: number | null;
  exec_summary_numbers_per_100_words: number | null;
  exec_summary_avg_sentence_words: number | null;

  // Structure (D2)
  h4_headers: number;
  tables: number;
  key_takeaways_present: boolean;

  bold_total: number;
  dangling_refs: number;

  // Action items (D4, D5)
  timed_actions_count: number;
  basis_tags_count: number;
  risk_annotations_count: number;
  risk_annotations_structured: boolean;

  /** Agent's holistic self-reported scores per dimension key (for calibration tracking only) */
  agent_self_reported_scores: Record<string, number>;
}

// ─────────────────────────────────────────────
// Tier 2 — Cross-chapter synthesis
// ─────────────────────────────────────────────

export interface P2Classification {
  framing_decision_question: string;
  framing_blocking_questions: string[];
  fidelity_score: number;
  gap_filling_score: number;
  executability_score: number;
}

export interface P4Classification {
  options_count: number;
  options_has_comparison: boolean;
  options_score: number;
  scenario_count: number;
  scenario_params_varied: number;
  scenarios_score: number;
  sensitivities_type: "multi" | "single" | "threshold" | "none";
  sensitivities_score: number;
  ia_has_standalone_section: boolean;
  ia_count: number;
  ia_score: number;
}

export interface P6Classification {
  has_top_level_section: boolean;
  sectional_count: number;
  identification_score: number;
  client_tagged: number;
  platform_tagged: number;
  has_provenance_table: boolean;
  source_type_count: number;
  attribution_score: number;
  validation_methods_linked_to_actions: number;
  sensitivity_awareness_score: number;
}

export interface P8Classification {
  recommendation_quote: string;
  recommendation_quantified: boolean;
  recommendation_has_named_entities: boolean;
  specificity_score: number;
  actions_with_all_four: number;
  actions_with_two: number;
  actions_with_none: number;
  total_actions: number;
  decision_architecture_score: number;
  qa_basis_chains_count: number;
  integration_quantified: boolean;
  integration_score: number;
  // Move 8 score is computed server-side from P4 CovI — not set by agent
}

export interface D3Classification {
  voice_type: "exec" | "mostly-exec" | "mixed" | "operator-leaning" | "operator";
  has_decision_h2: boolean;
  has_core_decision_label: boolean;
  executive_terms_matched_count: number;
  hedge_marker_count: number;
  strong_marker_count: number;
  hedge_ratio: number;
  salience_placement: "verdict-first-quantified" | "verdict-first" | "suboptimal" | "near-end" | "buried";
}

export interface D4Classification {
  timed_actions_total: number;
  basis_tags_total: number;
  risk_annotations_total: number;
  risk_annotations_structured: boolean;
  numbers_paired_total: number;
  numbers_total: number;
  quantification_ratio: number;
  exec_summary_cross_ref_dependencies: number;
}

export interface D5Classification {
  verdict_clarity_type: "clear" | "conditional-no-criteria" | "implied" | "unclear" | "ambiguous";
  first_action_has_timeframe: boolean;
  first_action_has_success_kill: boolean;
  first_action_has_priority: boolean;
  capital_ask_type: "quantified-ranged" | "quantified" | "present" | "vague" | "absent";
  priority_sequencing_type: "tagged" | "structured" | "partial" | "mentioned" | "none";
  has_threshold: boolean;
  has_default_action: boolean;
  has_cost_of_delay: boolean;
}

export interface Tier2SynthesisOutput {
  // Cross-chapter P1 coherence findings
  p1_cross_chapter_contradictions: WithinChapterContradiction[];
  p1_cross_chapter_reconciliation_failures: ReconciliationEntry[];
  p1_cross_chapter_minor_gaps: string[];
  p1_cross_chapter_definitional_drifts: string[];
  // Cross-chapter reasoning gaps — same shape as within-chapter: quote required.
  p1_cross_chapter_reasoning_gaps: Array<{ quote: string; description: string }>;
  p1_tension_acknowledged: string | null;

  // P2 problem formulation
  p2: P2Classification;

  // P3 structural fidelity
  p3_typology: string;
  p3_expected_chapters: string[];
  p3_present_chapters: string[];
  p3_missing_chapters: string[];
  p3_missing_subsections: string[];
  p3_duplicate_headers: string[];
  p3_wrong_template: boolean;
  p3_typology_refinement: boolean;
  p3_additional_chapters_count: number;

  // P4 coverage
  p4: P4Classification;

  // P6 assumption quality
  p6: P6Classification;

  // P8 solution quality
  p8: P8Classification;

  // D3 audience calibration
  d3: D3Classification;

  // D4 communicative completeness
  d4: D4Classification;

  // D5 actionability
  d5: D5Classification;

  /** Agent's holistic self-reported scores (for calibration tracking only) */
  agent_self_reported_scores: Record<string, number>;
}

// ─────────────────────────────────────────────
// Tier 3 — P7 Output Realism
// ─────────────────────────────────────────────

export type FicTestResult = "PASS" | "FAIL" | "NA";

export interface NpClaim {
  quote: string;
  metric: string;
  value: number;
  unit: string;
  classification: "in-range" | "boundary" | "out-of-range" | "oor-justified-j1" | "oor-justified-j2" | "oor-justified-j3" | "not-in-library";
}

export interface CcRecord {
  quote: string;
  certainty_vocab: "definitive" | "moderate" | "hedged";
  evidence_tier: 1 | 2 | 3;
  penalty: number;
}

export interface Tier3P7Output {
  claim_count: number;
  np_claims: NpClaim[];
  cc_records: CcRecord[];
  fic_tests: {
    revenue_to_headcount: FicTestResult;
    revenue_to_margin: FicTestResult;
    capital_to_plan: FicTestResult;
    growth_to_tam: FicTestResult;
    timeline_to_milestone: FicTestResult;
  };
  /** One-sentence reasoning for each FIC test — required for auditability.
   *  Must quote the exact figures used and show the arithmetic or explain NA. */
  fic_test_reasons: {
    revenue_to_headcount: string;
    revenue_to_margin: string;
    capital_to_plan: string;
    growth_to_tam: string;
    timeline_to_milestone: string;
  };
  agent_self_reported_ori: number;
}

// ─────────────────────────────────────────────
// Dimension Result (server-computed)
// ─────────────────────────────────────────────

export interface DimensionResult {
  dimensionKey: string;
  /** Final score 1–5 (null for P7 not-scored) */
  score: number | null;
  /** Per-sub-dimension scores */
  subScores: Record<string, number>;
  /** Full TR-log for storage */
  traceabilityLog: object;
  /** Server-computed score (same as score, null if not-scored) */
  serverComputed: number | null;
  /** Agent's holistic self-reported score (for calibration drift tracking) */
  agentSelfReported: number | null;
  /** True if |serverComputed - agentSelfReported| >= 1.0 */
  calibrationDrift: boolean;
}

// ─────────────────────────────────────────────
// Combined classifications
// ─────────────────────────────────────────────

export interface AllClassifications {
  tier1Chapters: Tier1ChapterOutput[];
  tier2: Tier2SynthesisOutput;
  tier3P7: Tier3P7Output;
}

// ─────────────────────────────────────────────
// Approved Risk (input to scoring run)
// ─────────────────────────────────────────────

export interface ApprovedRisk {
  statement: string;
  classification: "BULL" | "BEAR" | "BILATERAL";
  source: "TYPOLOGY" | "FRAMING" | "EMPIRICAL" | "LLM_INFERENCE";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  approved: boolean;
}
