# Innovera Eval V3 — Dimension Hardening Amendment Set

**Version:** 1.0
**Date:** May 2026
**Purpose:** Bring all 11 remaining dimensions (P1–P6, P8, D1–D5) to the standard established by Pillar 7 — full independence demarcation, locked formulas, quantifiable metrics, mandatory traceability logs, AI guardrails, and scoring guardrails. Includes the two independence fixes for D4/P1 and D5/P8.
**Status:** Ready for integration into the V3 Framework Specification and handoff to Claude Code.

---

## How to Read This Document

Each dimension below is specified across six layers:

1. **Independence** — demarcation rules against any pillar it could overlap with
2. **Formula** — the locked aggregation method and calculation
3. **Quantifiable Metrics** — the measurable thresholds (restated for completeness)
4. **Traceability Log (TR)** — the mandatory structured output that makes every score reproducible
5. **AI Guardrails (AG)** — constraints preventing hallucination, contamination, and unbounded judgment
6. **Scoring Guardrails** — interpretation rules that keep human/agent scoring consistent

Pillar 7 already meets this standard and is not re-specified here. It is the reference template.

---

## Common AI Guardrails (Apply to ALL Dimensions)

These five guardrails are inherited by every dimension. Dimension-specific guardrails are listed in addition.

| ID | Guardrail | Rationale |
|---|---|---|
| **AG-C1** | **No cross-memo contamination.** Each memo is scored in isolation. The agent may not use knowledge of how other memos scored to calibrate the current memo. Absolute scores derive solely from memo content + rubric. | Prevents relative (ELO-like) scoring contaminating the absolute rubric layer. |
| **AG-C2** | **Count/identify before scoring.** The agent must enumerate the scoreable elements (claims, chapters, contradictions, sources, etc.) and emit the count before computing any sub-score. | Prevents scoring-then-rationalizing; forces the evidence base to exist before the score. |
| **AG-C3** | **Evidence from memo text only.** The agent may not infer, impute, or hallucinate content not present in the memo. Absent evidence yields a documented absence, not an invented value. | Keeps every score traceable to actual memo content. |
| **AG-C4** | **Rule-bound classification.** Where a rule or vocabulary exists, the agent must use it rather than a holistic impression. | Holistic impressions vary across runs; rule-bound classification is reproducible. |
| **AG-C5** | **Traceability direction is fixed.** The agent measures and classifies; the score is computed from the classifications. The agent must never reverse-engineer classifications to hit a target score. | The load-bearing traceability principle of the framework. |

---

# STAGE 1 — Solution Validity

---

## Pillar 1 — Coherence

### Independence
- **vs P7 FIC:** P1 owns **cross-section numerical contradictions** — the same figure stated differently in two places, or a claim in chapter X that directly contradicts chapter Y. P7 FIC owns **scaling-relationship incoherence** — figures that are each consistent as stated but financially implausible in relation to each other. Demarcation test: if the failure is "two stated numbers disagree," it is P1; if the failure is "these numbers can't all be true together given the business model," it is P7 FIC.
- **vs D4 Self-containment:** P1 owns **whole-memo consistency** (does the entire document hold together). D4-5 owns **Exec-Summary-reads-alone** (can the Exec Summary be understood without the body). A memo can be fully coherent yet have a non-self-contained Exec Summary, and vice versa.

### Formula
`CI = 5 − penalties + tension_bonus`, clamped to [1, 5]

Penalty schedule (each event counted):
- 1 flat contradiction: −2.0
- 2+ flat contradictions: −3.0 (replaces the −2.0, not additive)
- 1 major numerical reconciliation failure: −1.0
- 2+ major numerical reconciliation failures: −2.0 (replaces the −1.0)
- Each minor reconciliation gap: −0.25
- Each definitional drift: −0.25
- Each implicit reasoning gap: −0.25
- Tension bonus (explicit acknowledgment + addressed in recommendation): +0.5 (max one bonus)

### Quantifiable Metrics
| Score | Threshold |
|---|---|
| 5 | Zero contradictions, full reconciliation, tensions acknowledged |
| 4 | Minor gaps only, no major contradictions |
| 3 | 1–2 minor gaps OR 1 major numerical issue |
| 2 | Multiple issues including major contradictions |
| 1 | Severe internal incoherence |

### Traceability Log (TR-P1)
```
COHERENCE DEFECT LOG
Flat contradictions: [n] → [list each: "chapter X says A; chapter Y says B"]
Major numerical reconciliation failures: [n] → [list each: figure + locations]
Minor reconciliation gaps: [n] → [list]
Definitional drifts: [n] → [list]
Implicit reasoning gaps: [n] → [list]
Tension bonus applied: [yes/no] → [quote the acknowledged tension]
Derivation: 5 − [total penalties] + [bonus] = CI = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-P1.1:** A contradiction requires two explicitly stated, directly opposed claims. A claim that is elaborated or nuanced in a later chapter is NOT a contradiction (depth ≠ contradiction). The agent must quote both sides before counting a contradiction.
- **AG-P1.2:** Numerical reconciliation requires verifying figures across the Executive Summary, Full Summary, and at least 2 body chapters. The agent must list the locations checked.

### Scoring Guardrails
- Distinguish "summary states A, chapter expands to nuance" (depth) from "chapter X says A, chapter Y says not-A" (contradiction).
- Tension bonus applies only when the tension is BOTH acknowledged AND addressed in the recommendation logic — surfacing alone is insufficient.

---

## Pillar 2 — Problem Formulation

### Independence
- **vs P3 Fidelity:** P2 owns **content alignment to the framing** (does the memo answer the question asked). P3 owns **structural presence** (are the expected chapters there). A memo can have all chapters (P3 = 5) yet answer the wrong question (P2 = 2).
- **vs P8 Solution Quality:** P2 Executability owns whether action items **have** Success/Kill/Timeframe structure tied to the framing. P8 Decision Architecture owns whether the recommendation's decision structure is **analytically sound**. P2 checks framing-fidelity of actions; P8 checks recommendation construction.

### Formula
`PFI = geometric_mean(Fidelity, Gap_filling, Executability)`, each sub-score 1–5

Geometric mean chosen to penalize imbalance: one weak sub-dimension pulls the pillar down more than arithmetic mean would.

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Fidelity | Decision exactly answers framing question, appropriate scope | Addresses framing topic, not the specific question | Unrelated to framing |
| Gap-filling | All blocking + high-priority questions answered with named answers | Most blocking addressed, partial high-priority | Multiple blocking questions ignored |
| Executability | All actions have Success+Kill+Timeframe; (Client)/(Platform) tags | Actions present, missing 2+ of Success/Kill/Timeframe | No actionable next steps |

### Traceability Log (TR-P2)
```
PROBLEM FORMULATION LOG
Framing decision question: [quote]
Fidelity: memo's decision = [quote] → match assessment → Fidelity = [1-5]
Framing blocking questions: [list]
  → addressed? [Q1: yes/no/partial, ...] → Gap-filling = [1-5]
Action items found: [n] → [list with Success/Kill/Timeframe presence per action]
  → Executability = [1-5]
Derivation: geomean([Fidelity], [Gap-filling], [Executability]) = PFI = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-P2.1:** The framing decision question and blocking questions must be quoted from the framing document before scoring Fidelity/Gap-filling. The framing is sent as the first input; the agent scores against the actual framing text, not an inferred question.
- **AG-P2.2:** (Client)/(Platform) assumption tags are counted only when the literal tag is present — not inferred from context.
- **AG-P2.3:** Success/Kill thresholds count toward Executability only when quantitative.

### Scoring Guardrails
- Action items in tables earn higher Executability credit than narrative actions.
- A blocking question "addressed" requires a named answer, not a restatement of the question.

---

## Pillar 3 — Fidelity / Structural Accuracy

### Independence
- **vs P2:** P3 owns presence/structure; P2 owns content alignment (see P2 above).
- **vs D2 Structural Clarity:** P3 owns **whether required chapters/sub-sections exist** (Stage 1 structural completeness). D2 owns **visual scaffolding and formatting discipline** of what exists (Stage 2 presentation). P3 = "is the Risk chapter present"; D2 = "is the Risk chapter well-formatted with tables and flat headers."

### Formula
`FI = 5 + bonuses − penalties`, clamped to [1, 5]

Penalties: missing required chapter −0.5 each; missing required sub-section −0.25 each; duplicate header −0.25 each; wrong-template-for-typology −0.5.
Bonuses: typology refinement applied +0.5; 1–2 typology-appropriate additional chapters +0.25–0.5.

### Quantifiable Metrics
| Score | Threshold |
|---|---|
| 5 | All standard chapters present, typology-refined, additional chapters added |
| 4 | All standard chapters present, modest typology refinement |
| 3 | 1–2 missing chapters or sub-sections |
| 2 | Multiple missing chapters |
| 1 | Structural breakdown |

### Traceability Log (TR-P3)
```
STRUCTURAL FIDELITY LOG
Typology: [1A/1B/2A/2B]
Expected chapters for typology: [list]
Present: [list] | Missing: [list with -0.5 each]
Missing sub-sections: [list with -0.25 each]
Duplicate headers: [list with -0.25 each]
Template check: [correct / wrong-for-typology -0.5]
Bonuses: typology refinement [+0.5?] | additional chapters [+0.25-0.5?]
Derivation: 5 + [bonuses] − [penalties] = FI = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-P3.1:** The expected-chapter list is determined by the declared typology (1A/1B/2A/2B) per the framework's chapter map — not by the agent's general expectation of "what a memo should have." The agent must state the typology-specific expected list before scoring.
- **AG-P3.2:** The 2 non-scored sections (Financial Appendix, Six-T/Risk Analysis) are excluded from completeness penalties — their absence is not penalized as a missing required chapter.

### Scoring Guardrails
- A 10-chapter evaluation is a FULL evaluation, not partial (the 2 non-scored sections are optional).
- Typology variants legitimately include chapter subsets — only penalize chapters required for the declared typology.

---

## Pillar 4 — Coverage

### Independence
- **vs P7 NP:** P4 owns **whether** options/scenarios/sensitivities/alternatives were explored (breadth of analysis). P7 NP owns **whether the numbers in them are plausible**. A memo can have rich scenarios (P4 = 4) with implausible figures (P7 NP = 2).
- **vs P8 Move 8:** P4 produces CovI; Move 8 (in P8) *consumes* CovI as input. This is the framework's single intentional cross-pillar dependency. CovI is computed independently in P4; the dependency is one-directional and explicit.

### Formula
`CovI = geometric_mean(Options, Scenarios, Sensitivities, Interpretive_Alternatives)`, each 1–5

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Options | 3+ options, multi-dimensional comparison | 2–3 options, some comparison | Single option/direction |
| Scenarios | Base/Bear/Bull, 3+ params vary | Base + one alternative | Single point estimate |
| Sensitivities | Multi-variable tables | Single-variable only | Threshold statements only |
| Interpretive Alternatives | Standalone section, multiple devil's-advocate readings | One alternative interpretation acknowledged | None |

### Traceability Log (TR-P4)
```
COVERAGE LOG
Options: [count + structure] → Options = [1-5]
Scenarios: [list scenarios + params varied] → Scenarios = [1-5]
Sensitivities: [list analyses] → Sensitivities = [1-5]
Interpretive Alternatives: [list, or "none"] → IA = [1-5]
Derivation: geomean([O],[S],[Se],[IA]) = CovI = [score]
NOTE: IA near-constant floor (1.5-2.0) documented; see framework Section on Pillar 4.
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-P4.1:** IA must be scored on the explicit presence of alternative interpretations in the text, not inferred. The known IA floor (1.5–2.0) is an observation, not a default — the agent still scores IA from the actual content. A memo with a genuine "Strongest counterargument" column earns IA = 2.0+; the agent must not auto-assign the floor.
- **AG-P4.2:** Confirmed risks from the Risk Review Gate are the reference for whether Sensitivities/IA address the material risks — the agent uses the confirmed risk list, not its own risk priors.

### Scoring Guardrails
- IA is a known system-wide weakness; score it honestly (most memos 1.5–2.0) without artificially inflating or auto-flooring.
- Geometric mean means one strong facet cannot rescue three weak ones — this is intended.

---

## Pillar 5 — Evidence Quality

### Independence
- **vs P7 CC:** P5 owns **source quality** (are the cited sources high-tier). P7 CC owns **language calibration** (does certainty match evidence tier). P5 does not evaluate language; P7 CC does not re-evaluate source quality.
- **vs P6 Assumption Quality:** P5 owns **citations/sources backing claims**. P6 owns **assumptions and their attribution**. A cited claim is P5 territory; a stated assumption is P6 territory.

### Formula
`EQI = arithmetic_mean(Citation_Density, Source_Quality, Provenance_Tagging)`, each 1–5

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Citation density (per 100 lines) | 15+ | 6–10 | < 3 |
| Source quality | 0% red-flag, 25%+ premium | < 15% red-flag, 10–25% premium | 30%+ red-flag |
| Provenance tagging | 100+ tags, all 4 types | 25–50 tags, 2–3 types | Zero tagging |

### Traceability Log (TR-P5)
```
EVIDENCE QUALITY LOG
Total citations: [n] / [lines] → density per 100 lines = [n] → Citation Density = [1-5]
Sources by tier: premium [n,%] | mid [n,%] | low/red-flag [n,%]
Red-flag domains found: [list against the 8-domain list] → Source Quality = [1-5]
Provenance tags: [count] across [n] of 4 types [list types present] → Provenance = [1-5]
Derivation: mean([CD],[SQ],[PT]) = EQI = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-P5.1 (red-flag list is exclusive):** Source Quality is capped at ≤3.0 if any of the 8 canonical red-flag domains appear. The agent uses the documented 8-domain list as the authority — it may flag a domain as "candidate red-flag (not on list)" for human review but may not cap the score on a domain not on the list.
- **AG-P5.2:** Provenance tags are counted only where the literal tag/attribution phrase appears in claim text — not inferred from the presence of a citation.

### Scoring Guardrails
- A single red-flag source caps Source Quality regardless of other citation strength.
- Premium tier = government, peer-reviewed, top-tier research firms (Wood Mackenzie, IEA, Gartner-class), regulatory filings.

---

## Pillar 6 — Assumption Quality

### Independence
- **vs P5:** P6 owns assumptions; P5 owns citations (see P5).
- **vs P7 CC:** P6 owns **assumption identification and attribution** (are assumptions tagged, sourced, validation-linked). P7 CC owns **certainty of expression** (is the language appropriate to evidence). A memo can tag every assumption (P6 = 5) yet express them with over-confident language (P7 CC = 2).
- **vs P2 Executability:** P6 owns assumption *attribution and validation linkage*; P2 owns whether *action items* tie to framing with Success/Kill. Validation methods linked to actions are scored for existence in P6 and for framing-fidelity in P2 — different questions on the same artifact.

### Formula
`AQI = arithmetic_mean(Identification, Attribution, Sensitivity_Awareness)`, each 1–5

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Identification | Top-level Assumptions section + sectional assumptions in body | Scattered in body, no top-level section | Implicit, none flagged |
| Attribution | All tagged (Client)/(Platform); Provenance Audit table, 5 source types | Some tagging, no audit table | Zero attribution |
| Sensitivity awareness | Validation methods linked to actions with Success/Kill | Validation goals stated narratively | No validation methodology |

### Traceability Log (TR-P6)
```
ASSUMPTION QUALITY LOG
Top-level Assumptions section: [present/absent]
Sectional assumptions: [count by chapter]
→ Identification = [1-5]
Tagged assumptions: [(Client): n] [(Platform): n] [untagged: n]
Provenance Audit table: [present/absent] → source types: [list]
→ Attribution = [1-5]
Validation methods linked to actions: [list] → Sensitivity = [1-5]
Derivation: mean([Id],[At],[Se]) = AQI = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-P6.1:** Tags counted only when the literal (Client)/(Platform) marker appears — not inferred.
- **AG-P6.2:** The Provenance Audit table is credited only when the structured table exists with named columns — narrative mention of assumption sources is not the table.

### Scoring Guardrails
- An assumption "identified" requires it to be explicitly stated as an assumption, not merely present as an unflagged claim.
- Validation linkage requires a method tied to a specific action with Success/Kill — a goal alone is insufficient.

---

## Pillar 8 — Solution Quality (+ Move 8)

### Independence
- **vs D5 Actionability (RE-SCOPED):** P8 owns **existence and analytical soundness** of the decision architecture — are Success Gates, Kill Conditions, Timelines, Priorities structurally present and logically tied to the analysis. D5-5 owns **legibility and default-action communication** — is the threshold presented so an IC can act without hunting, is the cost of delay quantified for the reader. Same artifact (e.g., a kill condition), different question: P8 = "is it there and sound?"; D5 = "is it communicated clearly?"
- **vs P2 Executability:** P2 checks framing-fidelity of action items; P8 checks recommendation construction quality. P2 = "do actions tie to the framing's questions"; P8 = "is the recommendation well-built."
- **vs P7 CC:** Move 8 operates at **memo level** (overall conviction vs overall CovI). P7 CC operates at **claim level** (individual assertion language vs that claim's evidence tier).

### Formula
`SQI = arithmetic_mean(Specificity, Decision_Architecture, Integration, Move_8)`, each 1–5

**Move 8 rule (consumes CovI from P4):**
| CovI | Appropriate conviction | Move 8 score for high conviction |
|---|---|---|
| > 3.5 | High | 5 |
| 3.0–3.5 | Moderate | 3–4 |
| 2.5–3.0 | Hedged | 2–3 |
| < 2.5 | Hedged + explicit uncertainty | 1–2 |

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Specificity | Concrete + quantified scale + named entities | Concrete, not quantified | No clear recommendation |
| Decision Architecture | Full Gate/Kill/Timeline/Priority per action | 2 of 4 per action | None |
| Integration | Q/A/Basis chains, quantified | Narrative logic | Disconnected from analysis |
| Move 8 | Conviction matches CovI band | Partial calibration | Mismatch |

### Traceability Log (TR-P8)
```
SOLUTION QUALITY LOG
Recommendation: [quote] → quantified? named entities? → Specificity = [1-5]
Decision architecture per action: [list actions + which of Gate/Kill/Timeline/Priority present]
  → Decision Architecture = [1-5]
Integration: Q/A/Basis chains [count, quantified?] → Integration = [1-5]
CovI (from P4) = [value] → conviction band = [band] | memo conviction observed = [level]
  → Move 8 = [1-5]
Derivation: mean([Sp],[DA],[In],[M8]) = SQI = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-P8.1:** Move 8 must read CovI from the P4 computation, not re-derive coverage. The dependency is one-directional: P4 → Move 8.
- **AG-P8.2:** Decision Architecture scores structural presence/soundness only — it does not score how clearly the architecture is communicated to the reader (that is D5, re-scoped).

### Scoring Guardrails
- Hedged verdicts are scored two-faced and both are correct: Move 8 credits honest hedging matched to weak CovI; D5 Actionability separately penalizes ambiguity of immediate ask.
- Specificity requires a quantified scale (capital amount, ideally with range) for a 5.

---

# STAGE 2 — Output Quality

---

## Stage 2 Dimension 1 — Interpretability

### Independence
- **vs D2 Structural Clarity:** D1 owns **cognitive load of the prose** (acronyms, sentence complexity, numerical density, length, verdict-first). D2 owns **visual scaffolding** (headers, tables, bold, cross-refs). D1 = readability of the text; D2 = formatting of the document.
- **vs D3 Audience Calibration:** D1 owns reader cognitive load generically; D3 owns whether the voice/tone fits an *executive* audience specifically.

### Formula
`II = arithmetic_mean(Verdict_First, Acronym_Discipline, Numerical_Density, Sentence_Complexity, Exec_Summary_Length)`, each 1–5

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Verdict-first | Q/A/Rationale in Exec Summary | Verdict present, not front-loaded | Buried/absent |
| Acronym discipline | ≤2 OR all defined | 7–11, partial defs | 15+ undefined |
| Numerical density (/100 words) | 2.5+ | 1.5–2.0 | < 1.0 |
| Sentence complexity (avg words) | 12–22 | 26–30 or 8–10 | > 35 |
| Exec Summary length (words) | 800–1500 | 400–600 or 1800–2200 | > 2500 or < 200 |

### Traceability Log (TR-D1)
```
INTERPRETABILITY LOG
Verdict structure: [Q/A/Rationale? placement] → Verdict-First = [1-5]
Acronyms in Exec Summary: [count, defined: n] → Acronym = [1-5]
Numbers per 100 words (Exec Summary): [value] → Numerical Density = [1-5]
Avg words/sentence: [value] → Sentence Complexity = [1-5]
Exec Summary word count: [value] → Length = [1-5]
Derivation: mean of 5 = II = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-D1.1:** All five sub-dimensions are computed from counts/measurements (acronym count, word count, number count, sentence length) — not holistic readability impressions. The agent must emit the raw measurement before the sub-score.
- **AG-D1.2:** Measurements are taken from the Executive Summary specifically where the threshold says so — not the whole memo.

### Scoring Guardrails
- 12+ undefined acronyms in the Exec Summary forces Acronym sub-score ≤2.
- Numerical density and sentence length are mechanical counts; do not adjust for "feel."

---

## Stage 2 Dimension 2 — Structural Clarity

### Independence
- **vs P3 Fidelity:** D2 owns **formatting of what exists** (Stage 2 presentation); P3 owns **whether required structure exists** (Stage 1 completeness).
- **vs D1:** D2 owns visual scaffolding; D1 owns prose cognitive load (see D1).

### Formula
`SCI = arithmetic_mean(Header_Hierarchy, Visual_Scaffolding, Chapter_Prefix, Bold_Discipline, Cross_References)`, each 1–5

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Header hierarchy | < 10 H4 total | 20–40 H4 | > 60 H4 |
| Visual scaffolding | 50+ tables, Key Takeaways per chapter, framing prose | 15–30 tables, occasional | Prose-only |
| Chapter prefix | "Executive Summary" prefix replacing "Overview" | "Overview" throughout | No convention |
| Bold (per 1000 lines) | < 80 | 150–250 | > 400 |
| Cross-references | Clean links, no dangling | Some dangling | Broken |

### Traceability Log (TR-D2)
```
STRUCTURAL CLARITY LOG
H4 header count: [n] → Header Hierarchy = [1-5]
Tables: [n] | Key Takeaways: [n chapters] | framing prose: [present?] → Visual = [1-5]
Chapter prefix: [Executive Summary / Overview / mixed / none] → Prefix = [1-5]
Bold markers per 1000 lines: [value] → Bold Discipline = [1-5]
Cross-references: [intact: n | dangling: n] → Cross-Ref = [1-5]
Derivation: mean of 5 = SCI = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-D2.1:** All five sub-dimensions are counts (H4 headers, tables, bold markers, dangling refs) — the agent emits the raw count before the sub-score.
- **AG-D2.2:** Bold count is normalized per 1000 lines; the agent must state total lines and total bold markers before computing the ratio.

### Scoring Guardrails
- Structure > count for some signals: a memo with fewer risk annotations but a structured P/S/M table can still score well on the relevant scaffolding signal (ergonomics over raw count).
- "Executive Summary" chapter prefix replacing "Overview" is a specific signal — score literal presence.

---

## Stage 2 Dimension 3 — Audience Calibration

### Independence
- **vs D1:** D3 owns executive-audience fit (voice, terminology, hedging discipline); D1 owns generic cognitive load. A memo can be readable (D1 = 4) but written in operator voice rather than executive voice (D3 = 2).
- **vs P8:** D3 owns tone/voice of the recommendation's presentation; P8 owns the recommendation's analytical construction.

### Formula
`ACI = arithmetic_mean(Voice, Stakeholder_Framing, Executive_Terminology, Hedging_Discipline, Salience_Hierarchy)`, each 1–5

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Voice/abstraction | Consistent 3rd-person executive | Mixed | Operator throughout |
| Stakeholder framing | ## Decision H2 + "Core Decision" framing | Generic decision section | None |
| Executive terminology | 13+ exec terms | 4–8 | 0–2 |
| Hedging discipline (hedge:strong ratio) | < 0.3 | 0.4–0.5 | > 0.6 |
| Salience hierarchy | Verdict-first, quantified reasons | Verdict present, suboptimal placement | Buried |

### Traceability Log (TR-D3)
```
AUDIENCE CALIBRATION LOG
Voice: [3rd-person exec / mixed / operator] → Voice = [1-5]
Stakeholder framing: [## Decision present? "Core Decision"?] → Framing = [1-5]
Executive terms found: [count + list] → Terminology = [1-5]
Hedge markers: [n] | strong markers: [n] | ratio: [value] → Hedging = [1-5]
Verdict placement: [position] → Salience = [1-5]
Derivation: mean of 5 = ACI = [score]
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-D3.1:** Executive terminology is counted against a defined term list (capital allocation, risk-adjusted return, hurdle rate, exit multiple, downside protection, etc.). The agent lists matched terms before scoring.
- **AG-D3.2:** Hedge-to-strong ratio is computed from counted hedge markers and strong markers — the agent emits both counts and the ratio before the sub-score.

### Scoring Guardrails
- Voice is assessed across the whole memo; isolated operator phrasing in an otherwise executive memo is a minor, not a 1.
- The hedge:strong ratio is mechanical — do not adjust for perceived intent.

---

## Stage 2 Dimension 4 — Communicative Completeness

### Independence (FIX — D4/P1 demarcation)
- **vs P1 Coherence (RESOLVED):** P1 owns **whole-memo consistency** — contradictions, numerical reconciliation, reasoning gaps across the entire document. D4-5 (self-containment) owns **whether the Executive Summary can be understood on its own**, without requiring the reader to consult body chapters. These are independent: a memo can be fully coherent (P1=5) with a non-self-contained Exec Summary full of unexplained cross-references (D4-5=2); or have a self-contained Exec Summary (D4-5=5) that contradicts the body (P1=2). **Demarcation test:** if the failure is "the document disagrees with itself," it is P1; if the failure is "the Exec Summary can't be read standalone," it is D4-5.
- **vs P6:** D4 risk annotations owns **presentation of risks with P×S×M structure** (Stage 2). P6 owns assumption attribution (Stage 1). Different artifacts.

### Formula
`CCI = arithmetic_mean(Timed_Actions, Basis_Tags, Risk_Annotations, Quantification_Completeness, Self_Containment)`, each 1–5

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Timed actions | 30+ with ownership | 10–20 | Few/none |
| Basis tags | 4+ Basis: tags in Q/A chains | 1–2 | Zero |
| Risk annotations | P×S×M table, 25+ annotations | Some, inconsistent structure | Sparse, no structure |
| Quantification completeness | > 90% numbers paired with units | 70–80% | < 60% |
| Self-containment | Exec Summary fully standalone, no cross-ref dependencies | Mostly standalone, minor deps | Requires body to understand |

### Traceability Log (TR-D4)
```
COMMUNICATIVE COMPLETENESS LOG
Timed actions: [count + ownership present?] → Timed Actions = [1-5]
Basis: tags: [count] → Basis Tags = [1-5]
Risk annotations: [count] | P×S×M table: [present?] → Risk Annotations = [1-5]
Numbers paired with units: [n paired / n total = %] → Quantification = [1-5]
Self-containment: [cross-ref dependencies in Exec Summary: list] → Self-Containment = [1-5]
Derivation: mean of 5 = CCI = [score]
NOTE: Self-Containment scores Exec-Summary-standalone ONLY; whole-memo consistency = P1.
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-D4.1:** Self-containment is scored by counting cross-reference dependencies in the Executive Summary ("see Chapter X", undefined references resolved only in the body). The agent lists each dependency before scoring. It must NOT score whole-memo consistency here (that is P1).
- **AG-D4.2:** Quantification completeness is a mechanical ratio (numbers with units ÷ total numbers); the agent emits both counts.

### Scoring Guardrails
- Self-containment failures are cross-reference dependencies, not contradictions. A contradiction routes to P1.
- Risk annotation structure (P×S×M table) can outweigh raw annotation count — ergonomics over count.

---

## Stage 2 Dimension 5 — Actionability

### Independence (FIX — D5/P8 re-scope)
- **vs P8 Decision Architecture (RESOLVED):** P8 owns **existence and analytical soundness** of the decision architecture (Stage 1) — are Success Gates, Kill Conditions, Timelines, Priorities present and logically sound. D5-5 (decision threshold / default-action visibility) is **RE-SCOPED to legibility and communication only** (Stage 2) — is the threshold presented so an IC can act without hunting, is the default action visible, is the cost of delay quantified for the reader. **Demarcation test:** if the failure is "the kill condition is missing or illogical," it is P8; if the failure is "the kill condition exists but is buried/unclear to the reader," it is D5-5. D5-5 NEVER scores the existence or soundness of the architecture — only its presentation.
- **vs P2 Executability:** P2 owns framing-fidelity of action items (Stage 1); D5 owns presentation clarity of the immediate ask (Stage 2).

### Formula
`AI = arithmetic_mean(Verdict_Clarity, First_Action_Specificity, Capital_Ask, Priority_Sequencing, Decision_Threshold_Legibility)`, each 1–5

(Note: AI = Actionability Index; distinct from "AI" as in the model. Internal code should use `ACTI` to avoid collision.)

### Quantifiable Metrics
| Sub-dim | Score 5 | Score 3 | Score 1 |
|---|---|---|---|
| Verdict clarity | Clear directional verdict (Go/No-Go/Conditional w/ explicit condition) | Conditional without clear criteria | Ambiguous |
| First action specificity | Singular first action + timeframe + Success/Kill + priority | Named but loosely specified | Generic ("do diligence") |
| Capital ask | Quantified with ranges | Present, not quantified | None visible |
| Priority sequencing | Structured Priority tags (Critical/High/Medium) | Present, not tagged | None |
| Decision threshold legibility | Threshold + "if no decision" framing + quantified cost of delay, all clearly presented | Status quo mentioned, not quantified | No default-action discussion |

### Traceability Log (TR-D5)
```
ACTIONABILITY LOG
Verdict: [quote + directional clarity] → Verdict Clarity = [1-5]
First action: [quote + timeframe/Success/Kill/priority present?] → First Action = [1-5]
Capital ask: [quote + quantified/ranged?] → Capital Ask = [1-5]
Priority sequencing: [tags present? Critical/High/Medium] → Sequencing = [1-5]
Decision threshold LEGIBILITY: [threshold presented clearly? default action visible? cost of delay quantified?]
  → Threshold Legibility = [1-5]
Derivation: mean of 5 = ACTI = [score]
NOTE: Threshold Legibility scores PRESENTATION only; architecture existence/soundness = P8.
```

### AI Guardrails (in addition to AG-C1–C5)
- **AG-D5.1:** Decision Threshold Legibility scores ONLY whether the threshold/default-action is communicated clearly to the reader. The agent must NOT score whether the kill condition exists or is sound (that is P8 Decision Architecture). If the architecture is absent entirely, that is a P8 failure; D5-5 scores the legibility of whatever is present.
- **AG-D5.2:** Capital ask presence is scored from explicit memo text; the agent does not infer an implied capital figure.

### Scoring Guardrails
- A hedged verdict is penalized here for ambiguity of the immediate ask, even when Move 8 (P8) credits the same hedge as honest calibration — both are correct in their own scope.
- Threshold legibility is about reader access to the decision rule, not the quality of the rule.

---

## Summary — All 13 Dimensions at Standard

| Dim | Independence demarcations | Formula | TR Log | AI Guardrails | Scoring Guardrails |
|---|---|---|---|---|---|
| P1 Coherence | vs P7-FIC, vs D4-5 | base5−pen+bonus | TR-P1 | AG-C1-5 + P1.1-2 | ✓ |
| P2 Problem Form | vs P3, vs P8 | geomean(3) | TR-P2 | AG-C1-5 + P2.1-3 | ✓ |
| P3 Fidelity | vs P2, vs D2 | base5+bon−pen | TR-P3 | AG-C1-5 + P3.1-2 | ✓ |
| P4 Coverage | vs P7-NP, vs P8-M8 | geomean(4) | TR-P4 | AG-C1-5 + P4.1-2 | ✓ |
| P5 Evidence | vs P7-CC, vs P6 | mean(3) | TR-P5 | AG-C1-5 + P5.1-2 | ✓ |
| P6 Assumption | vs P5, vs P7-CC, vs P2 | mean(3) | TR-P6 | AG-C1-5 + P6.1-2 | ✓ |
| P7 Output Realism | (reference template) | mean(3) | TR-1/2/3 | AG-1-7 | ✓ |
| P8 Solution Quality | vs D5, vs P2, vs P7-CC | mean(4)+Move8 | TR-P8 | AG-C1-5 + P8.1-2 | ✓ |
| D1 Interpretability | vs D2, vs D3 | mean(5) | TR-D1 | AG-C1-5 + D1.1-2 | ✓ |
| D2 Structural Clarity | vs P3, vs D1 | mean(5) | TR-D2 | AG-C1-5 + D2.1-2 | ✓ |
| D3 Audience Calib | vs D1, vs P8 | mean(5) | TR-D3 | AG-C1-5 + D3.1-2 | ✓ |
| D4 Comm Complete | **vs P1 (FIXED)**, vs P6 | mean(5) | TR-D4 | AG-C1-5 + D4.1-2 | ✓ |
| D5 Actionability | **vs P8 (RE-SCOPED)**, vs P2 | mean(5) | TR-D5 | AG-C1-5 + D5.1-2 | ✓ |

### Independence fixes applied
- **D4/P1:** Demarcation rule added. P1 = whole-memo consistency; D4-5 = Exec-Summary-standalone. Constructs confirmed independent; the Phase 2 "redundancy" was a correlation misread.
- **D5/P8:** Re-scope applied. P8 = decision architecture existence/soundness (Stage 1); D5-5 = threshold legibility/default-action communication (Stage 2). Overlap eliminated by the Stage 1/Stage 2 split.

### Naming collision flagged for implementation
- D5 Actionability Index abbreviates to "AI" in the original spec. Internal code should use **ACTI** to avoid collision with model references.
