# Innovera Eval V3 — Framework Specification (v1.0, Complete & Hardened)

**Author:** Carson (Innovera AI) · **Date:** May 2026 · **Status:** Complete Hardened Specification
**Rubric Version:** V3 v1.0 · **Dimensions:** 13 scored (8 Stage 1 + 5 Stage 2)
**Calibration:** Phase 1 + Phase 2 empirical pass + Pillar 7 Benchmark Library

> This is the markdown source of truth for the build. It is identical in content to the .docx of the same name. Read this file rather than the .docx — it requires no extraction.

---

## 1. Framework Identity & Value Proposition

**What it is:** A collaborative evaluation tool for Innovera investment and decision memos. Not an autonomous scorer. Two modules:
- **Memo Evaluator** (primary): Confidence Erosion scoring across 13 dimensions, Risk Review Gate, Pairwise ELO.
- **Decision Framing Sanity Checker** (V1.1 carry-over): multi-model framing validation (Claude + Gemini), Triage Matrix, Consolidated Report.

**Confidence Erosion principle:** Every memo starts at 100% confidence. Quality issues erode it. The output reports how much confidence was preserved and where it was lost.

**Two-score output:**
- **Memo Confidence (pre-risk):** 100 minus the sum of pillar-based erosion. What editors control.
- **Decision Confidence (post-risk):** Memo Confidence × Risk Multiplier. In v1.0 the Risk Multiplier is held at 1.0 (Critical Risk Suppressor deferred to v1.5), so Decision Confidence equals Memo Confidence. Shown as a quiet placeholder ("Suppressor pending v1.5"), never a co-equal hero number.

**Who uses it:** Scorer (runs evaluations, reviews risks, applies the rubric — every memo); Top Management + experts (ELO seeding, comparison overrides); memo authors and IC (consume outputs).

---

## 2. Architecture Overview

Three operational components, run in order:
1. **Risk Review Gate** — AI flags top 5 critical risks; Scorer approves/rejects (90-sec default tier).
2. **Absolute Scoring** — starts at 100% confidence; 13 dimensions each contribute erosion based on 1–5 scores; produces Memo Confidence and Decision Confidence.
3. **Pairwise ELO** — LLM compares the new memo against prior corpus on a decision-utility basis; humans verify/override.

Output = Quality Profile: per-pillar erosion + both confidence numbers + ELO rating + approved risk list + rubric version stamp.

---

## 3. Confidence Erosion Foundation

A 5/5 on a pillar means **zero confidence erosion** from that pillar (a zero-defect criterion, not a maximalist one). Erosion direction per score: 5 = zero erosion, 4 = small, 3 = moderate, 2 = large, 1 = maximum.

**Phase 2 calibration note:** Pillar scores over-credit structural completeness vs. human holistic judgment by ~0.6–1.2 points (n=2 only). Pillar scores are operative truth for v1.0; a correction factor will be derived in Phase 3 at n ≥ 7–8.

**Math policy:**
- **Geometric mean** (Pillars 2, 4): penalizes imbalanced sub-scores.
- **Arithmetic mean** (Pillars 5, 6, 7, 8, all Stage 2): independent quality axes.
- **Base-5 minus penalties** (Pillars 1, 3): absence-of-defects dimensions.

Aspirational 5 is **versioned** (v1.0 anchors fixed); ELO preserves cross-version comparability.

---

## 4. Common AI Guardrails (apply to ALL 13 dimensions)

| ID | Guardrail |
|---|---|
| AG-C1 | No cross-memo contamination. Each memo scored in isolation. |
| AG-C2 | Count/identify before scoring. Emit the count before any sub-score. |
| AG-C3 | Evidence from memo text only. No hallucinated content. Absent evidence = documented absence. |
| AG-C4 | Rule-bound classification. Use the defined rule/vocabulary, not holistic impressions. |
| AG-C5 | Traceability direction fixed: agent measures and classifies; server computes from classifications; never reverse-engineer to a target score. |

---

## 5. Stage 1 — Solution Validity (8 pillars)

Each pillar below lists construct, formula, key thresholds, traceability log (TR), and dimension-specific guardrails (AG). Full sub-dimension threshold tables are in the companion file `Innovera_Eval_V3_Dimension_Hardening.md`; this section is the authoritative summary.

### Pillar 1 — Coherence
- **Construct:** Memo-internal consistency (no contradictions, numbers reconcile, tensions acknowledged).
- **Formula:** `CI = 5 − penalties + tension_bonus`, clamp [1,5]. Flat contradiction −2.0 (2+ → −3.0); major reconciliation failure −1.0 (2+ → −2.0); minor gap/drift/reasoning-gap −0.25 each; tension bonus +0.5 (max one).
- **Independence:** vs P7-FIC (P1 = stated-number contradictions; FIC = scaling incoherence). vs D4 (P1 = whole-memo; D4-5 = Exec-Summary-standalone).
- **TR-P1:** log each contradiction, reconciliation failure, gap, drift, bonus → derive CI.
- **AG-P1.1:** quote both opposed claims before counting a contradiction. **AG-P1.2:** check Exec Summary + Full Summary + ≥2 body chapters; list locations.

### Pillar 2 — Problem Formulation
- **Construct:** Memo vs framing alignment.
- **Formula:** `PFI = geometric_mean(Fidelity, Gap-filling, Executability)`, each 1–5.
- **Independence:** vs P3 (content vs structure). vs P8 (framing-fidelity of actions vs recommendation construction).
- **TR-P2:** quote framing decision question; per blocking-question addressed?; per-action Success/Kill/Timeframe → derive PFI.
- **AG-P2.1:** quote framing questions before scoring. **AG-P2.2:** (Client)/(Platform) tags counted only when literal. **AG-P2.3:** Success/Kill count only when quantitative.

### Pillar 3 — Fidelity / Structural Accuracy
- **Construct:** Structural element presence per typology.
- **Formula:** `FI = 5 + bonuses − penalties`, clamp [1,5]. Missing chapter −0.5; missing sub-section −0.25; duplicate header −0.25; wrong template −0.5; typology refinement +0.5; additional chapters +0.25–0.5.
- **Independence:** vs P2 (structure vs content). vs D2 (existence vs formatting).
- **TR-P3:** typology; expected vs present chapters; missing items; bonuses → derive FI.
- **AG-P3.1:** expected list from declared typology, stated before scoring. **AG-P3.2:** 2 non-scored sections (Financial Appendix, Six-T/Risk) excluded from completeness penalties.

### Pillar 4 — Coverage
- **Construct:** Exploration depth (Options, Scenarios, Sensitivities, Interpretive Alternatives).
- **Formula:** `CovI = geometric_mean(Options, Scenarios, Sensitivities, IA)`, each 1–5.
- **Independence:** vs P7-NP (breadth vs plausibility). vs P8 Move 8 (P4 produces CovI; Move 8 consumes it — one-directional).
- **TR-P4:** log each facet → derive CovI.
- **Known finding:** IA scores 1.5–2.0 across all corpus memos (near-constant floor). **AG-P4.1:** score IA on explicit content, do NOT auto-assign the floor. **AG-P4.2:** use the confirmed Risk Gate list, not the agent's own risk priors.

### Pillar 5 — Evidence Quality
- **Construct:** Citation density + source quality tier + provenance tagging.
- **Formula:** `EQI = arithmetic_mean(Citation Density, Source Quality, Provenance Tagging)`, each 1–5.
- **Independence:** vs P7-CC (source quality vs language calibration). vs P6 (citations vs assumptions).
- **TR-P5:** citations/100 lines; sources by tier; red-flag domains found; provenance tags by type → derive EQI.
- **AG-P5.1 (red-flag list is exclusive):** Source Quality capped ≤3.0 if any of the 8 red-flag domains appear; may flag non-listed domains as "candidate" only. **AG-P5.2:** provenance tags counted only where literal.
- **Red-flag domains (8):** swotanalysisexample.com, matrixbcg.com, dcfmodeling.com, pmarketresearch.com, useaiforbusiness.com, callin.io, hubifi.com, thedigitalbloom.com.

### Pillar 6 — Assumption Quality
- **Construct:** Explicit identification + source attribution + sensitivity awareness.
- **Formula:** `AQI = arithmetic_mean(Identification, Attribution, Sensitivity)`, each 1–5.
- **Independence:** vs P5 (assumptions vs citations). vs P7-CC (attribution vs certainty language). vs P2 (attribution/validation vs framing-fidelity).
- **TR-P6:** top-level Assumptions section?; tagged counts; Provenance Audit table?; validation linkage → derive AQI.
- **AG-P6.1:** tags counted only when literal. **AG-P6.2:** Provenance Audit table credited only when structured table with named columns exists.

### Pillar 7 — Output Realism (ACTIVE in v1.0)
- **Construct:** Does the analysis reflect how the world works? Three components.
- **Formula:** `ORI = arithmetic_mean(Numerical Plausibility, Claim Calibration, Financial Internal Consistency)`.
- **Sparse-data protocol (applied first):** count scoreable financial claims. 5+ = full; 3–4 = partial `ORI=(NP+CC+FIC×0.5)/2.5`; 1–2 = minimal `ORI=mean(NP,CC)`; 0 = NOT SCORED with Appropriate/Inappropriate classification (Inappropriate routes to Pillar 4, not a P7 failure). Do not penalize financial thinness in P7.
- **NP:** classify each numeric claim vs Benchmark Library (Section 8) as In Range / Boundary / Out of Range / OOR-Justified (J1 adequate / J2 inadequate / J3 absent). Library is a prior, not a ceiling.
- **CC:** load-bearing claims ("if false, would the recommendation change?"); certainty vocabulary (Definitive/Moderate/Hedged) × evidence tier (weakest source cited). Tier3+Definitive = −1.0; Tier2+Definitive or Tier3+Moderate = −0.5.
- **FIC:** 5 tests (revenue-to-headcount, revenue-to-margin, capital-to-plan, growth-to-TAM, timeline-to-milestone). Test 5 = N/A if no explicit dependency chain.
- **TR-1/2/3:** NP claim inventory; CC calibration record; FIC test log.
- **AG-1..AG-7:** Library is exclusive NP reference (not-in-library = neutral); no hallucinated figures (absent = N/A not Fail); rule-bound claim selection; mandatory certainty vocabulary; weakest-source tier rule; sparse protocol declared before scoring; isolation.

### Pillar 8 — Solution Quality (+ Move 8)
- **Construct:** Recommendation construction + conviction calibration vs Coverage.
- **Formula:** `SQI = arithmetic_mean(Specificity, Decision Architecture, Integration, Move 8)`, each 1–5.
- **Move 8 (consumes CovI):** CovI>3.5 → high conviction = 5; 3.0–3.5 → 3–4; 2.5–3.0 → 2–3; <2.5 → high conviction = 1–2.
- **Independence:** vs D5 (P8 = existence/soundness of decision architecture; D5-5 = legibility/communication). vs P2 (construction vs framing-fidelity). vs P7-CC (memo-level vs claim-level).
- **TR-P8:** recommendation specificity; per-action architecture; integration chains; CovI band vs observed conviction → derive SQI.
- **AG-P8.1:** Move 8 reads CovI from P4, not re-derived. **AG-P8.2:** Decision Architecture scores presence/soundness only, not communication (that's D5).

---

## 6. Stage 2 — Output Quality (5 dimensions)

All arithmetic mean of 5 sub-dimensions. Stage 2 is NEVER combined with Stage 1 into one number — they form a 2×2 diagnostic matrix (Stage1-High/Stage2-Low = "needs presentation polish"; Stage1-Low/Stage2-High = "polished weak analysis — most concerning").

### D1 — Interpretability
- `II = mean(Verdict-First, Acronym Discipline, Numerical Density, Sentence Complexity, Exec Summary Length)`.
- All sub-dims are counts/measurements. **AG-D1.1:** emit raw measurement before sub-score. **AG-D1.2:** measure from the Exec Summary where the threshold specifies.

### D2 — Structural Clarity
- `SCI = mean(Header Hierarchy, Visual Scaffolding, Chapter Prefix, Bold Discipline, Cross-References)`.
- **Independence:** vs P3 (formatting vs existence). **AG-D2.1:** all sub-dims are counts; emit count first. **AG-D2.2:** bold normalized per 1000 lines (state totals).

### D3 — Audience Calibration
- `ACI = mean(Voice, Stakeholder Framing, Executive Terminology, Hedging Discipline, Salience Hierarchy)`.
- **AG-D3.1:** executive terms counted against a defined list, matched terms listed. **AG-D3.2:** hedge:strong ratio from counted markers (emit both).

### D4 — Communicative Completeness
- `CCI = mean(Timed Actions, Basis Tags, Risk Annotations, Quantification Completeness, Self-Containment)`.
- **Independence (D4/P1 FIX):** P1 = whole-memo consistency; D4-5 Self-containment = Exec-Summary-standalone. Demarcation test: "document disagrees with itself" = P1; "Exec Summary can't be read standalone" = D4-5.
- **AG-D4.1:** self-containment = count of cross-ref dependencies in Exec Summary; must NOT score whole-memo consistency. **AG-D4.2:** quantification = mechanical ratio (emit both counts).

### D5 — Actionability
- `ACTI = mean(Verdict Clarity, First Action Specificity, Capital Ask, Priority Sequencing, Decision-Threshold Legibility)`.
- **Independence (D5/P8 RE-SCOPE):** P8 = decision architecture existence/soundness (Stage 1); D5-5 = threshold legibility/default-action communication (Stage 2). Test: "kill condition missing/illogical" = P8; "exists but buried/unclear" = D5-5. D5-5 never scores existence/soundness.
- **Naming:** abbreviates to "AI" — internal code uses **ACTI** to avoid collision with model references.
- **AG-D5.1:** legibility only, never existence/soundness. **AG-D5.2:** capital ask from explicit text, not inferred.

---

## 7. Risk Review Gate · ELO · LLM Call Architecture (summary)

- **Risk Gate:** Tier 1 (90-sec, top 5 risks, approve/reject) + Tier 2 (on-demand deep). Each risk: statement, classification (Bull/Bear/Bilateral), source (Typology/Framing/Empirical/LLM-inference), severity, "why this might NOT be a risk." Framework's-Eye-View Caveat on every output.
- **ELO:** start 1500; standard Elo update; K=32 first 30 comparisons then 16; decision-utility basis; LLM runs, humans verify/override; version-independent.
- **LLM Call Architecture (3-tier):** Tier 1 per-chapter parallel scoring; Tier 2 cross-chapter synthesis (sequential); Tier 3 targeted full-memo passes (parallel). Inngest orchestration. Failure isolation: retry one chapter, not the whole memo. Framing always sent first, before memo content.

---

## 8. Pillar 7 Benchmark Library (2025/2026)

Sources: Lighter Capital, SaaS Capital, Benchmarkit, Maxio, High Alpha, Optifai, McKinsey, Bain, Eagle Rock CFO, Viking Mergers, Vena, ISM, Deloitte, Hamilton Lane, EQT. Every range corroborated by ≥2 sources. Library is a prior, not a ceiling (J1-justified deviations score full credit). Metrics not listed = "Not in Library" → neutral score (AG-1). **Seed this table into the BenchmarkEntry DB table.**

### Typology 1A — External Investment
| Metric | Plausible | Boundary | Out of Range |
|---|---|---|---|
| Target IRR (PE/strategic) | 15–25% | 10–15% / 25–35% | <10% / >35% |
| PE LP hurdle rate | 7–10% | 5–7% | <5% |
| Deal entry multiple (EV/EBITDA) | 6–12× | 12–16× | >16× / <4× |
| Revenue growth (target, Y1–3) | 15–35% | 8–15% / 35–60% | <5% / >80% (non-AI) |
| Gross margin (SaaS target) | 65–82% | 60–65% / 82–88% | <55% / >90% |
| Gross margin (hardware/industrial) | 30–50% | 25–30% / 50–60% | <20% / >65% |
| Gross margin (manufacturing) | 20–40% | 15–20% / 40–50% | <12% / >55% |
| LTV:CAC (SaaS target) | 3:1–6:1 | 2:1–3:1 | <2:1 |
| CAC payback (enterprise) | 14–24 mo | 12–14 / 24–30 mo | <8 / >36 mo |
| NRR (SaaS target) | 95–120% | 88–95% | <85% |

### Typology 1B — Internal Initiative
| Metric | Plausible | Boundary | Out of Range |
|---|---|---|---|
| Corporate hurdle rate / WACC | 8–15% | 6–8% / 15–20% | <5% / >25% |
| Project IRR (internal) | 15–30% | 10–15% / 30–45% | <8% / >50% |
| Payback period (capex) | 2–5 yr | 1–2 / 5–8 yr | <1 / >10 yr |
| Revenue uplift from initiative | 3–20% | 1–3% / 20–40% | >50% (no justification) |
| Cost reduction target | 5–25% | 2–5% / 25–40% | >50% (single initiative) |
| Headcount change | ±10–30% | ±30–50% | >±50% (no justification) |
| Implementation timeline | 6–24 mo | 3–6 / 24–48 mo | <3 mo / >5 yr |
| CapEx as % of revenue | 2–15% | 15–25% | >30% (non-infrastructure) |

### Typology 2A — New Market Entry
| Metric | Plausible | Boundary | Out of Range |
|---|---|---|---|
| TAM claim | Bottom-up or cited top-down | TAM >10× realistic segment | Top-down only, no bottom-up |
| Year 1 market share | 0.1–3% | 3–8% | >10% (no justification) |
| Revenue growth (Y1–3, from zero) | 40–150% | 150–300% | >300% |
| Time to breakeven | 18–48 mo | 12–18 / 48–72 mo | <12 mo / >7 yr |
| Gross margin (SaaS) | 65–82% | 60–65% | <55% |
| Gross margin (industrial/services) | 30–55% | 25–30% | <20% |
| CAC payback (B2B enterprise) | 14–24 mo | 12–14 mo | <8 mo (new market) |
| Initial capital requirement | Consistent w/ headcount+GTM+infra | Cap ask <6 mo opex, no bridge | — |

### Typology 2B — New Product Launch
| Metric | Plausible | Boundary | Out of Range |
|---|---|---|---|
| Year 1 revenue | Consistent w/ sales cycle + ramp | Y1 >20% of mature-state revenue | — |
| Revenue growth (Y1–3, from launch) | 30–120% | 120–200% | >200% (no justification) |
| Gross margin (SaaS) | 65–82% | 55–65% | <50% |
| Gross margin (hardware/device) | 30–50% | 25–30% / 50–60% | <20% |
| Time to product-market fit | 6–18 mo | 3–6 mo | <3 mo (complex B2B) |
| CAC payback (mid-market) | 14–18 mo | 12–14 mo | <8 mo |
| Break-even timeline | 24–60 mo | 18–24 / 60–84 mo | <18 mo / >7 yr |
| NRR (new product) | 90–110% | 85–90% | <80% |

### Cross-Typology Reference
| Metric | Plausible | Sources |
|---|---|---|
| B2B SaaS gross margin | 65–82% | Eagle Rock CFO, Maxio |
| B2B SaaS revenue growth (median) | 25–35% | Lighter Capital, SaaS Capital |
| B2B SaaS revenue growth (top quartile) | 55–75% | Lighter Capital |
| CAC payback (SMB) | 8–12 mo | Optifai, Benchmarkit |
| CAC payback (mid-market) | 14–18 mo | Optifai |
| CAC payback (enterprise) | 18–24 mo | Optifai, Benchmarkit |
| B2B SaaS NRR (median) | 100–105% | Maxio, Understory |
| LTV:CAC (healthy) | 3:1–5:1 | Optifai |
| Manufacturing gross margin | 20–40% | Viking Mergers, Vena |
| Semiconductor/industrial hardware GM | 35–55% | Eagle Rock CFO |
| Professional services gross margin | 40–65% | Viking Mergers |
| PE buyout target IRR | 15–25% | McKinsey, Bain |
| PE LP hurdle rate | 7–10% | EQT, Hamilton Lane |
| Corporate strategic investment IRR threshold | 12–20% | Wall Street Prep, Eqvista |
| Manufacturing revenue growth (stable) | 3–8%/yr | ISM, Deloitte |

---

## 9. Versioning & Traceability (build-critical)

- Each ScoringRun carries a `rubricVersion` stamp. Re-scoring under a new version creates a NEW ScoringRun; never overwrite.
- DimensionScore stores BOTH `serverComputed` and `agentSelfReported` so calibration drift is queryable (powers the diagnostics strip).
- ELO is version-independent; absolute scores are not comparable across versions.

---

## 10. v1.0 vs v1.5 (scope guards)

| Element | v1.0 | v1.5 |
|---|---|---|
| Memo Confidence | Hero score | Hero score |
| Decision Confidence | Quiet placeholder ("pending v1.5") | Full second score |
| Risk Multiplier / Suppressor | Held at 1.0 (inactive) | Active, multiplicative |
| Risk Analysis tab | Hidden | Visible |
| Effective Penalty panel | Removed | Returns (corrected) |
| Pillar 7 | Active, benchmark-backed | Active |
| Status badge, Diagnostics strip | Active | Active |

*End of Framework Specification (markdown source of truth).*
