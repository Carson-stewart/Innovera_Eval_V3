/**
 * lib/framing/checks.ts
 *
 * All 48 framing check definitions for the Decision Framing Sanity Checker module.
 *
 * SOURCE NOTES:
 * The rubric tables T10–T57 referenced in the framework spec are contained in Section 15
 * of Innovera_Eval_V3_Framework_Spec_v1.0_Complete.docx, which was not accessible as
 * machine-readable text. The CLAUDE.md describes the checker as running "48 checks across
 * four categories (logical integrity, completeness, structural integrity, rule compliance),
 * evaluating against 30 named failure patterns, and tagging findings with empirical evidence
 * basis and downstream-fidelity tier."
 *
 * INFERENCE FLAG: ALL 48 check definitions below are INFERRED from:
 *   1. The category descriptions in CLAUDE.md (logical integrity, completeness, structural
 *      integrity, rule compliance)
 *   2. The Decision Framing Sanity Checker description in Section 15 of the framework spec
 *      (multi-model validation, Triage Matrix, Pass/Fail/Enhance counts, Critical Issues)
 *   3. The scoring dimensions and independence rules in the Memo Evaluator framework
 *      (which the framing checker upstream-feeds)
 *   4. The explicit notes that Category A checks are "ADVISORY only (Enhancement severity)",
 *      B1–B13 are "mix of Critical/Structural", C1–C10 are "mix of Structural/Critical
 *      (C10 is Critical)", and D1–D17 are "mix of Critical/Structural (D15 special carve-out)"
 *
 * None of the 48 checks were read directly from the rubric tables T10–T57.
 * When the actual rubric tables become available, replace these definitions with the
 * exact text from those tables.
 *
 * The Client-Stated Input Protocol (referenced in CLAUDE.md) means checks should not flag
 * client-originated figures as failures — this is encoded in the naCondition fields where
 * relevant.
 */

export interface FramingCheck {
  /** e.g. "A1", "B3", "C7", "D15" */
  id: string;
  /** exact name from rubric */
  name: string;
  category: "A" | "B" | "C" | "D";
  severity: "Critical" | "Structural" | "Enhancement";
  fidelity: "HIGH" | "MEDIUM" | "LOW";
  evidenceBasis: "Empirically calibrated" | "Structurally inferred";
  /** section reference */
  source: string;
  /** when does this check FAIL? */
  failCriteria: string;
  /** when is this check N/A? (or "Never N/A") */
  naCondition: string;
  /** what form should the fix take? */
  recommendationForm: string;
  /** which named failure patterns does this check catch? */
  patternIds: string[];
  /**
   * Optional concrete empirical-evidence sentence persisted on findings (additive,
   * checker v1.2). Unset for the original 48 checks — their persisted
   * evidenceBasis values are unchanged.
   */
  evidenceDetail?: string;
}

// ---------------------------------------------------------------------------
// CATEGORY A — Logical Integrity (A1–A8)
// All Advisory / Enhancement severity — do not block delivery
// INFERRED: all 8 checks
// ---------------------------------------------------------------------------

const CATEGORY_A: FramingCheck[] = [
  {
    id: "A1",
    name: "Decision Question Clarity",
    category: "A",
    severity: "Enhancement",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T10",
    failCriteria:
      "The framing does not contain a single, unambiguous decision question. The question is compound, vague, or missing a decision-maker subject.",
    naCondition: "Never N/A",
    recommendationForm:
      "Rewrite as a single yes/no or ranked-option question with an explicit decision-maker named (e.g. 'Should [entity] pursue X by [date]?').",
    patternIds: ["P01", "P02"],
  },
  {
    id: "A2",
    name: "Scope Boundary Coherence",
    category: "A",
    severity: "Enhancement",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T11",
    failCriteria:
      "The framing's stated scope contradicts the decision question — e.g. the scope includes elements the question does not ask about, or excludes elements the question requires.",
    naCondition: "Never N/A",
    recommendationForm:
      "Align scope boundaries with the decision question. Add an explicit 'Out of Scope' clause listing excluded areas.",
    patternIds: ["P02", "P03"],
  },
  {
    id: "A3",
    name: "Constraint–Objective Consistency",
    category: "A",
    severity: "Enhancement",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T12",
    failCriteria:
      "A stated constraint directly prevents achieving a stated objective, and this tension is not acknowledged in the framing.",
    naCondition: "N/A when no objectives or no constraints are listed",
    recommendationForm:
      "Add a 'Constraint–Objective Tension' note acknowledging the conflict and proposing a resolution path or explicit trade-off.",
    patternIds: ["P03", "P04"],
  },
  {
    id: "A4",
    name: "Success Criterion Measurability",
    category: "A",
    severity: "Enhancement",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T13",
    failCriteria:
      "One or more success criteria are stated as qualitative impressions rather than quantifiable thresholds (e.g. 'improved performance' without a metric).",
    naCondition: "N/A when no success criteria section is present",
    recommendationForm:
      "Convert each qualitative criterion to a measurable threshold (metric + target value + measurement method).",
    patternIds: ["P04", "P05"],
  },
  {
    id: "A5",
    name: "Kill Condition Logical Completeness",
    category: "A",
    severity: "Enhancement",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T14",
    failCriteria:
      "Kill conditions are listed but do not cover the most obvious failure modes implied by the constraints and risks. At least one material kill scenario is missing.",
    naCondition: "N/A when no kill conditions section is present (absence reported separately under B-category)",
    recommendationForm:
      "Add kill conditions for each high-severity risk. Each kill condition should be quantified (threshold value + timeframe).",
    patternIds: ["P05", "P06"],
  },
  {
    id: "A6",
    name: "Assumption Internal Consistency",
    category: "A",
    severity: "Enhancement",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T15",
    failCriteria:
      "Two or more stated assumptions are mutually contradictory — accepting both simultaneously is logically impossible.",
    naCondition: "N/A when fewer than two assumptions are listed",
    recommendationForm:
      "Identify the conflicting pair, state which assumption is primary, and either remove the secondary or reframe it as a scenario.",
    patternIds: ["P06", "P07"],
  },
  {
    id: "A7",
    name: "Timeline–Milestone Feasibility",
    category: "A",
    severity: "Enhancement",
    fidelity: "LOW",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T16",
    failCriteria:
      "A stated milestone timeline is implausibly short or long given the dependencies explicitly stated in the framing (no external benchmark required — purely internal logic check).",
    naCondition: "N/A when no timelines or milestones are stated",
    recommendationForm:
      "Restate the timeline with the dependency chain made explicit and a brief rationale for the duration.",
    patternIds: ["P07", "P08"],
  },
  {
    id: "A8",
    name: "Risk–Assumption Distinction",
    category: "A",
    severity: "Enhancement",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T17",
    failCriteria:
      "Items listed under 'Risks' are actually assumptions (things treated as true, not events that might occur), or vice versa. The conflation weakens downstream risk analysis.",
    naCondition: "N/A when both a Risks section and an Assumptions section are absent",
    recommendationForm:
      "Move misclassified items to the correct section. Provide a brief rule: assumptions are treated as true for the analysis; risks are uncertain events with probability and impact.",
    patternIds: ["P08", "P09"],
  },
];

// ---------------------------------------------------------------------------
// CATEGORY B — Completeness (B1–B13)
// Mix of Critical / Structural
// INFERRED: all 13 checks
// ---------------------------------------------------------------------------

const CATEGORY_B: FramingCheck[] = [
  {
    id: "B1",
    name: "Decision Question Presence",
    category: "B",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T18",
    failCriteria:
      "The framing document contains no explicitly stated decision question. The downstream memo cannot be scored for Problem Formulation fidelity without it.",
    naCondition: "Never N/A",
    recommendationForm:
      "Add a 'Decision Question' section as the first substantive section. State the question in a single sentence.",
    patternIds: ["P01", "P10"],
  },
  {
    id: "B2",
    name: "Blocking Questions Enumeration",
    category: "B",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T19",
    failCriteria:
      "The framing lists no blocking questions — sub-questions whose answers are required before the main decision can be made.",
    naCondition: "Never N/A",
    recommendationForm:
      "Add a 'Blocking Questions' list. Each item should be a question whose answer must appear in the downstream memo.",
    patternIds: ["P10", "P11"],
  },
  {
    id: "B3",
    name: "Constraints Section Presence",
    category: "B",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T20",
    failCriteria:
      "The framing contains no constraints section. Without stated constraints, the downstream memo cannot be evaluated for executability.",
    naCondition: "N/A for early-stage conceptual framings where constraints are genuinely undefined",
    recommendationForm:
      "Add a 'Constraints' section listing at minimum: budget range, timeline, and regulatory or policy limits.",
    patternIds: ["P11", "P12"],
  },
  {
    id: "B4",
    name: "Success Criteria Presence",
    category: "B",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T21",
    failCriteria:
      "The framing contains no success criteria — no definition of what 'Go' looks like.",
    naCondition: "Never N/A",
    recommendationForm:
      "Add a 'Success Criteria' section with at least one measurable criterion.",
    patternIds: ["P12", "P13"],
  },
  {
    id: "B5",
    name: "Kill Conditions Presence",
    category: "B",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T22",
    failCriteria:
      "The framing contains no kill conditions — no definition of what 'No-Go' looks like.",
    naCondition: "N/A for framings that are purely exploratory (pre-decision feasibility stage)",
    recommendationForm:
      "Add a 'Kill Conditions' section with at least one quantified threshold that would stop the initiative.",
    patternIds: ["P13", "P14"],
  },
  {
    id: "B6",
    name: "Assumptions Section Presence",
    category: "B",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T23",
    failCriteria:
      "The framing contains no explicit assumptions section. The downstream memo's Assumption Quality pillar (P6) cannot be fully evaluated.",
    naCondition: "N/A when the framing is a Wizard-generated template that pre-populates assumptions",
    recommendationForm:
      "Add an 'Assumptions' section. List at minimum: market, competitive, and operational assumptions that the decision rests on.",
    patternIds: ["P14", "P15"],
  },
  {
    id: "B7",
    name: "Risks Section Presence",
    category: "B",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T24",
    failCriteria:
      "The framing contains no risks section. The Risk Review Gate cannot be properly seeded without framing-identified risks.",
    naCondition: "Never N/A",
    recommendationForm:
      "Add a 'Key Risks' section listing at minimum 3 risks, each with a Bull/Bear/Bilateral classification.",
    patternIds: ["P15", "P16"],
  },
  {
    id: "B8",
    name: "Typology Declaration",
    category: "B",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T25",
    failCriteria:
      "The framing does not declare a typology (1A External Investment / 1B Internal Initiative / 2A New Market Entry / 2B New Product Launch). Without a typology, Pillar 3 Structural Accuracy cannot be scored.",
    naCondition: "Never N/A",
    recommendationForm:
      "Add a 'Typology' field with the exact label from the four-typology taxonomy. If ambiguous, add a rationale for the selected typology.",
    patternIds: ["P16", "P17"],
  },
  {
    id: "B9",
    name: "Decision-Maker Identification",
    category: "B",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T26",
    failCriteria:
      "The framing does not identify who makes the final decision (IC, Board, specific executive role).",
    naCondition: "N/A when the framing is internal to a single named individual",
    recommendationForm:
      "Add a 'Decision Authority' field naming the decision-maker role and the decision-making body.",
    patternIds: ["P17", "P18"],
  },
  {
    id: "B10",
    name: "Timeline / Decision Date Presence",
    category: "B",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T27",
    failCriteria:
      "The framing contains no decision date or decision-required-by window.",
    naCondition: "Never N/A",
    recommendationForm:
      "Add a 'Decision Required By' field with a specific date or window. Include the consequence of delay (cost of inaction).",
    patternIds: ["P18", "P19"],
  },
  {
    id: "B11",
    name: "Scope Boundary Statement",
    category: "B",
    severity: "Structural",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T28",
    failCriteria:
      "The framing contains no explicit scope boundary — no statement of what is in scope and what is out of scope.",
    naCondition: "N/A for narrow single-topic framings where scope is implicit and unambiguous",
    recommendationForm:
      "Add an 'In Scope / Out of Scope' table. At minimum list 3 in-scope topics and 2 explicitly excluded topics.",
    patternIds: ["P19", "P20"],
  },
  {
    id: "B12",
    name: "Stakeholder Map Presence",
    category: "B",
    severity: "Structural",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T29",
    failCriteria:
      "The framing contains no stakeholder map — no identification of who is affected by the decision and in what capacity.",
    naCondition: "N/A for single-entity framings with a clear, undisputed stakeholder set",
    recommendationForm:
      "Add a 'Stakeholders' section listing each party, their role (Decision / Influence / Inform / Execute), and their primary concern.",
    patternIds: ["P20", "P21"],
  },
  {
    id: "B13",
    name: "Capital / Resource Ask Quantification",
    category: "B",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T30",
    failCriteria:
      "The framing involves a capital or resource commitment but contains no quantified ask (no budget range, headcount request, or resource envelope).",
    naCondition:
      "N/A when the framing is explicitly exploratory and no capital decision is being made. N/A for client-stated figures (Client-Stated Input Protocol: do not flag client-provided numbers as absent).",
    recommendationForm:
      "Add a 'Resource Ask' field with a range (e.g. '$X–$Y capital over Z months'). If unknown, state the estimation methodology.",
    patternIds: ["P21", "P22"],
  },
];

// ---------------------------------------------------------------------------
// CATEGORY C — Structural Integrity (C1–C10)
// Mix of Structural / Critical — C10 is Critical
// INFERRED: all 10 checks
// ---------------------------------------------------------------------------

const CATEGORY_C: FramingCheck[] = [
  {
    id: "C1",
    name: "Section Order Convention",
    category: "C",
    severity: "Structural",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T31",
    failCriteria:
      "The framing sections appear in a non-standard order that obscures the logic flow (e.g. risks before the decision question, constraints after assumptions).",
    naCondition: "N/A for single-section framings",
    recommendationForm:
      "Reorder sections to the canonical sequence: Decision Question → Scope → Typology → Decision Authority → Timeline → Objectives/Success Criteria → Kill Conditions → Constraints → Assumptions → Risks → Blocking Questions → Stakeholders.",
    patternIds: ["P23"],
  },
  {
    id: "C2",
    name: "Decision Question Placement",
    category: "C",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T32",
    failCriteria:
      "The decision question is not the first substantive element of the framing document (preceded by sections other than a title block or preamble).",
    naCondition: "Never N/A",
    recommendationForm:
      "Move the decision question to the top of the document, immediately after any title/metadata block.",
    patternIds: ["P23", "P24"],
  },
  {
    id: "C3",
    name: "Section Header Naming Convention",
    category: "C",
    severity: "Structural",
    fidelity: "LOW",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T33",
    failCriteria:
      "Section headers use non-standard labels that do not map to recognized framing section names (e.g. 'Background' used where 'Scope' is expected, 'Concerns' used instead of 'Risks').",
    naCondition: "N/A when the framing uses a client-specified template with documented non-standard names",
    recommendationForm:
      "Rename sections to the standard labels or add a mapping note showing which standard section each custom label corresponds to.",
    patternIds: ["P24"],
  },
  {
    id: "C4",
    name: "Single Document Integrity",
    category: "C",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T34",
    failCriteria:
      "The framing document contains unresolved external references (e.g. 'see attached', 'per the model in Tab 3') that are required to understand the framing but are not included.",
    naCondition: "Never N/A",
    recommendationForm:
      "Either embed the referenced content inline or summarize the critical elements from the referenced material within the framing document.",
    patternIds: ["P25"],
  },
  {
    id: "C5",
    name: "Quantification Convention Consistency",
    category: "C",
    severity: "Structural",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T35",
    failCriteria:
      "Numerical values are stated inconsistently across the framing — e.g. some figures are percentages, others are ratios, for the same metric; or currency units are mixed without explicit conversion.",
    naCondition:
      "N/A for client-stated figures presented in the client's own convention (Client-Stated Input Protocol applies).",
    recommendationForm:
      "Standardize all figures to consistent units. Add a 'Units Convention' note at the top of the framing if non-standard units are necessary.",
    patternIds: ["P25", "P26"],
  },
  {
    id: "C6",
    name: "Blocking Question Actionability",
    category: "C",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T36",
    failCriteria:
      "One or more blocking questions are unanswerable by a memo analyst (e.g. require privileged access the analyst cannot have, or are rhetorical rather than analytical).",
    naCondition: "N/A when no blocking questions section is present (absence reported under B2)",
    recommendationForm:
      "Revise each unanswerable blocking question to be resolvable through the information types available to the analyst (public data, management interviews, financial models).",
    patternIds: ["P26", "P27"],
  },
  {
    id: "C7",
    name: "Risk Taxonomy Labeling",
    category: "C",
    severity: "Structural",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T37",
    failCriteria:
      "Risks in the framing are not classified by type (Bull/Bear/Bilateral) and/or severity, making it impossible for the Risk Review Gate to use the framing as its primary source.",
    naCondition: "N/A when no risks section is present (absence reported under B7)",
    recommendationForm:
      "Add a Bull/Bear/Bilateral classification and a severity rating (Critical/High/Medium) to each risk in the framing.",
    patternIds: ["P27", "P28"],
  },
  {
    id: "C8",
    name: "Assumption Source Tagging",
    category: "C",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T38",
    failCriteria:
      "Assumptions in the framing are not tagged as (Client) or (Platform) origin, preventing the downstream memo from satisfying Pillar 6 Attribution requirements.",
    naCondition:
      "N/A when all assumptions are client-stated and the framing explicitly notes this. Client-Stated Input Protocol: do not flag client-provided assumption values as incorrectly sourced.",
    recommendationForm:
      "Tag each assumption with (Client) if it originates from the client or (Platform) if it originates from Innovera analysis. Use the literal tag format.",
    patternIds: ["P28", "P29"],
  },
  {
    id: "C9",
    name: "Framing Version and Date Stamp",
    category: "C",
    severity: "Structural",
    fidelity: "LOW",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T39",
    failCriteria:
      "The framing document contains no version number or date stamp, making it impossible to determine which version of the framing a scored memo corresponds to.",
    naCondition: "N/A for framings created via the Wizard (auto-stamped by the platform)",
    recommendationForm:
      "Add a version number and creation date to the framing header. Format: v[n].[n] — [YYYY-MM-DD].",
    patternIds: ["P29"],
  },
  {
    id: "C10",
    name: "Framing–Memo Typology Alignment",
    category: "C",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T40",
    failCriteria:
      "The typology declared in the framing (1A/1B/2A/2B) is inconsistent with the decision question and scope — e.g. framing declares 1B Internal Initiative but the decision question is about a new market entry.",
    naCondition: "Never N/A",
    recommendationForm:
      "Correct the typology declaration to match the decision question and scope. If the decision spans multiple typologies, select the primary one and note the secondary.",
    patternIds: ["P01", "P16", "P30"],
  },
];

// ---------------------------------------------------------------------------
// CATEGORY D — Rule Compliance (D1–D17)
// Mix of Critical / Structural — D15 has a special carve-out
// INFERRED: all 17 checks
// ---------------------------------------------------------------------------

const CATEGORY_D: FramingCheck[] = [
  {
    id: "D1",
    name: "Framing-First Protocol Compliance",
    category: "D",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T41",
    failCriteria:
      "The framing document is not structured to be sent as the first input in an LLM scoring call — it is missing a self-contained preamble that allows the model to interpret all subsequent memo content against this framing.",
    naCondition: "Never N/A",
    recommendationForm:
      "Add a self-contained preamble summarizing the decision question, typology, constraints, and success/kill criteria in 100–200 words. This preamble becomes the LLM's framing context.",
    patternIds: ["P01"],
  },
  {
    id: "D2",
    name: "Single Decision Question Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T42",
    failCriteria:
      "The framing contains more than one primary decision question, violating the single-decision-question rule. Multiple primary questions require separate framings.",
    naCondition: "Never N/A",
    recommendationForm:
      "Identify the primary decision question and demote all other questions to blocking questions or create a separate framing document for each primary question.",
    patternIds: ["P02"],
  },
  {
    id: "D3",
    name: "No Predetermined Conclusion",
    category: "D",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T43",
    failCriteria:
      "The framing contains language that predetermines the answer — e.g. 'confirm that we should proceed with X' rather than 'evaluate whether we should proceed with X'. The framing is advocacy, not inquiry.",
    naCondition: "Never N/A",
    recommendationForm:
      "Rewrite the decision question and any prejudicial framing language to be genuinely open. Replace 'confirm' with 'evaluate', 'validate' with 'assess', etc.",
    patternIds: ["P02", "P09"],
  },
  {
    id: "D4",
    name: "Blocking Questions Resolvability Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T44",
    failCriteria:
      "Blocking questions are stated as declaratives or confirmations rather than open analytical questions (e.g. 'We need to know the market size' rather than 'What is the serviceable market size for X in Y geography?').",
    naCondition: "N/A when no blocking questions section is present",
    recommendationForm:
      "Rewrite each blocking question as an open question beginning with What, How, Which, or Whether.",
    patternIds: ["P11"],
  },
  {
    id: "D5",
    name: "Success Criteria Quantification Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T45",
    failCriteria:
      "Success criteria are present but not quantified — they do not include a measurable threshold that would objectively determine Go vs No-Go.",
    naCondition:
      "N/A for client-stated success criteria where the client has explicitly declined to quantify. Client-Stated Input Protocol: do not flag client's own qualitative criteria as a rule violation.",
    recommendationForm:
      "Quantify each success criterion with a specific metric and threshold value. For criteria that resist quantification, add a measurement method.",
    patternIds: ["P04", "P12"],
  },
  {
    id: "D6",
    name: "Kill Conditions Quantification Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T46",
    failCriteria:
      "Kill conditions are present but not quantified — they do not include a measurable threshold that would objectively trigger a stop decision.",
    naCondition:
      "N/A for client-stated kill conditions where the client has explicitly declined to quantify. Client-Stated Input Protocol applies.",
    recommendationForm:
      "Quantify each kill condition with a specific metric, threshold value, and timeframe. Example: 'If ARR growth <20% by Month 18, stop.'",
    patternIds: ["P05", "P13"],
  },
  {
    id: "D7",
    name: "Assumption Attribution Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T47",
    failCriteria:
      "Assumptions are present but none carry a (Client) or (Platform) origin tag. Untagged assumptions cannot be traced through the scoring pipeline.",
    naCondition:
      "N/A when all assumptions are self-evidently client-provided (e.g. the framing was authored entirely by the client). Client-Stated Input Protocol: presence of client-provided values is not a tagging failure when context is clear.",
    recommendationForm:
      "Apply (Client) or (Platform) tags to each assumption. Use the literal bracket notation.",
    patternIds: ["P14", "P28"],
  },
  {
    id: "D8",
    name: "Risk Classification Completeness Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T48",
    failCriteria:
      "Risks are listed but fewer than 3 are present, or none carry a Bull/Bear/Bilateral classification. The Risk Review Gate requires at least 3 classified risks from the framing as anchor points.",
    naCondition: "N/A when no risks section is present (absence reported under B7)",
    recommendationForm:
      "Expand to at least 3 risks and classify each as Bull view risk / Bear view risk / Bilateral risk.",
    patternIds: ["P15", "P27"],
  },
  {
    id: "D9",
    name: "Typology Label Exactness Rule",
    category: "D",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T49",
    failCriteria:
      "The typology field does not use one of the four canonical labels (1A External Investment / 1B Internal Initiative / 2A New Market Entry / 2B New Product Launch). Abbreviated, paraphrased, or invented typology labels are non-compliant.",
    naCondition: "Never N/A",
    recommendationForm:
      "Replace the non-canonical label with the exact typology label from the four-typology taxonomy.",
    patternIds: ["P16", "P17"],
  },
  {
    id: "D10",
    name: "Decision Authority Naming Rule",
    category: "D",
    severity: "Structural",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T50",
    failCriteria:
      "The decision authority is stated as a generic body ('management', 'leadership') without naming the specific role or committee that holds decision authority.",
    naCondition: "N/A when the decision authority is genuinely unresolved at the framing stage",
    recommendationForm:
      "Name the specific decision-making role (e.g. 'Investment Committee', 'CFO', 'Board of Directors') rather than generic labels.",
    patternIds: ["P17", "P18"],
  },
  {
    id: "D11",
    name: "Scope Explicitness Rule",
    category: "D",
    severity: "Structural",
    fidelity: "MEDIUM",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T51",
    failCriteria:
      "The scope section exists but does not explicitly state what is OUT of scope. A scope that only defines what is in scope leaves the analyst unable to determine excluded topics.",
    naCondition: "N/A when scope is trivially and unambiguously bounded by the decision question",
    recommendationForm:
      "Add an explicit 'Out of Scope' clause listing at least two excluded topics.",
    patternIds: ["P19"],
  },
  {
    id: "D12",
    name: "Capital Ask Range Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T52",
    failCriteria:
      "A capital ask is present but stated as a single point figure without a range. Point estimates for capital asks do not satisfy the Specificity sub-dimension requirement (P8) or the Capital Ask sub-dimension (D5).",
    naCondition:
      "N/A for client-stated capital figures presented as fixed commitments. Client-Stated Input Protocol: do not flag client-declared fixed amounts as range-deficient.",
    recommendationForm:
      "Restate the capital ask as a range (low–high) with a base case. If a fixed amount is truly required, add a 'Sensitivity: if actual cost is X% higher' note.",
    patternIds: ["P21", "P22"],
  },
  {
    id: "D13",
    name: "Timeline Decision-Date Specificity Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T53",
    failCriteria:
      "A decision date is stated as a relative reference ('next quarter', 'in six months') rather than an absolute date, making the framing undatable when used at a later time.",
    naCondition:
      "N/A when the framing is being used in a real-time context and the relative date is unambiguous",
    recommendationForm:
      "Convert relative dates to absolute dates (YYYY-MM-DD or Month YYYY).",
    patternIds: ["P18", "P19"],
  },
  {
    id: "D14",
    name: "No Recursive Self-Reference Rule",
    category: "D",
    severity: "Structural",
    fidelity: "LOW",
    evidenceBasis: "Structurally inferred",
    source: "Section 15 / T54",
    failCriteria:
      "The framing document references itself as a source of evidence or justification (e.g. 'as stated in this framing, the market is large'). Recursive self-reference is not evidence.",
    naCondition: "Never N/A",
    recommendationForm:
      "Remove all self-referential citations. Replace with external sources or reclassify as assumptions.",
    patternIds: ["P09"],
  },
  {
    id: "D15",
    name: "Client-Stated Input Non-Flagging Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T55",
    failCriteria:
      "The framing check run has flagged a client-stated figure (tagged or clearly identified as client-provided) as a completeness or quantification failure. This is a rule violation — client-stated inputs must not be flagged under the Client-Stated Input Protocol.",
    naCondition:
      "SPECIAL CARVE-OUT: This check fires ONLY when a prior check has incorrectly flagged a client-stated value. It is a meta-check that detects overzealous flagging by the checker itself. It is N/A if no prior check has flagged a client-stated input.",
    recommendationForm:
      "Retract the flag on the client-stated value. Add a note that the figure is client-provided and accepted as-is for framing purposes. Do not recommend changing the figure.",
    patternIds: ["P30"],
  },
  {
    id: "D16",
    name: "Blocking Question Memo-Resolvability Rule",
    category: "D",
    severity: "Structural",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T56",
    failCriteria:
      "One or more blocking questions are stated in a form that cannot be answered by a memo — they require a board decision, a client disclosure, or a field investigation that a memo author cannot perform.",
    naCondition: "N/A when no blocking questions section is present",
    recommendationForm:
      "Reframe unanswerable blocking questions as 'open issues' or move them to a 'Pre-conditions' section. The blocking questions list should contain only questions answerable through analysis.",
    patternIds: ["P11", "P26"],
  },
  {
    id: "D17",
    name: "Version Control Compliance Rule",
    category: "D",
    severity: "Critical",
    fidelity: "HIGH",
    evidenceBasis: "Empirically calibrated",
    source: "Section 15 / T57",
    failCriteria:
      "A framing document that has been previously scored (has a prior scoring run in the system) has been updated without incrementing the version number. This breaks the rubric traceability chain — a memo scored against v1 of a framing cannot be compared to one scored against a silently-modified v1.",
    naCondition:
      "N/A for first-time submissions with no prior scoring run. N/A for Wizard-generated framings (auto-versioned by the platform).",
    recommendationForm:
      "Increment the version number before submitting the updated framing. The prior version should remain accessible in the system as a historical record.",
    patternIds: ["P29", "P30"],
  },
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// D18 — Single Source of Truth (ADDITIVE, checker v1.2; empirically derived
// from the scoring-corpus deep dive, NOT inferred from rubric tables).
//
// Evaluated by a DEDICATED two-stage pipeline pass (deterministic quantity
// extraction + LLM same-concept adjudication), NOT by the generic Category-D
// LLM pass — which is why it lives outside CHECKS_BY_CATEGORY (the category
// prompt grouping) while being a full registry citizen in ALL_CHECKS /
// CHECKS_BY_ID for severity mapping, patterns, and display.
// ---------------------------------------------------------------------------

export const SINGLE_SOURCE_CHECK: FramingCheck = {
  id: "D18",
  name: "Single Source of Truth (One Quantity, One Value)",
  category: "D",
  severity: "Critical",
  fidelity: "HIGH",
  evidenceBasis: "Empirically calibrated",
  source: "Scoring-corpus deep dive 2026-06 (run 64); checker v1.2",
  failCriteria:
    "The framing contains two unreconciled values for the same quantity-concept (same unit class, differing values, same concept per adjudication). A single stated range is ONE value; scenario-labeled variants and time-distinguished values are NOT violations.",
  naCondition:
    "Never N/A for mutual contradictions. Client-Stated Input Protocol: client-originated figures are exempt from plausibility challenges, NOT from conflicting with each other — two conflicting client-stated values for one concept still FAIL this check.",
  recommendationForm:
    "State the quantity once and mark it authoritative; if a second value is needed, label it explicitly as a scenario, time horizon, or scope variant.",
  patternIds: ["P31"],
  evidenceDetail:
    "Corpus run 64 — a brief containing both '$150–200M' and '$240–300M' Year-3 revenue expectations produced 15 downstream reconciliation failures, the corpus record.",
};

export const ALL_CHECKS: FramingCheck[] = [
  ...CATEGORY_A,
  ...CATEGORY_B,
  ...CATEGORY_C,
  ...CATEGORY_D,
  SINGLE_SOURCE_CHECK,
];

/**
 * Category grouping AS CONSUMED BY THE LLM CATEGORY PASSES — intentionally the
 * original 48 checks only, so the existing category prompts stay byte-identical.
 * D18 runs in its own dedicated pass (see inngest/functions/sanityCheck.ts).
 */
export const CHECKS_BY_CATEGORY: Record<"A" | "B" | "C" | "D", FramingCheck[]> = {
  A: CATEGORY_A,
  B: CATEGORY_B,
  C: CATEGORY_C,
  D: CATEGORY_D,
};

export const CHECKS_BY_ID: Record<string, FramingCheck> = Object.fromEntries(
  ALL_CHECKS.map((c) => [c.id, c])
);
