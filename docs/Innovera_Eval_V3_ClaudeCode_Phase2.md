# Innovera Eval V3 — Claude Code Build Instructions
## Phase 2 — Scoring Engine + 3-Tier LLM Call Architecture

**For:** Carson, executing via Claude Code in the `Innovera_Eval_V3` repo
**Prerequisite:** Phase 0 + Phase 1 verified complete (schema migrated to `innovera_eval_v3`, 13-key enum, benchmarks seeded).
**Build decisions (locked):** Inngest now; one model (Claude via OpenRouter) for all scoring, set as a configurable constant; engine logic only — no mock memo (tested through the UI in Phase 3).

> Read `docs/Innovera_Eval_V3_Framework_Spec_v1.0.md` Sections 4–8 and `docs/Innovera_Eval_V3_Dimension_Hardening.md` before building. This phase implements the math and the call structure those documents specify.

---

## Phase 2 Goal

A complete, callable scoring engine: given a memo, its framing, a typology, and a list of approved risks, it runs the 3-tier LLM pipeline through Inngest, computes all 13 dimension scores server-side from agent classifications, derives both confidence numbers and the status badge, and writes the full result set to the database. No UI in this phase — the engine is invoked by an Inngest event and verified via Prisma Studio + Inngest dev dashboard.

---

## 2.0 Guiding Rules (do not violate)

1. **Traceability is one-directional (AG-C5).** The LLM returns *measurements and classifications* (counts, tiers, pass/fail, quotes) — NOT final 1–5 scores. The **server** computes every score from those classifications using the locked formulas. Never let the model hand back a final dimension score that the server stores directly.
2. **Store both numbers.** Persist the server-computed score (`serverComputed`) AND, separately, the score the agent would have given holistically (`agentSelfReported`). Set `calibrationDrift = true` when they differ by ≥1.0. This powers the diagnostics strip.
3. **Framing first.** Every LLM call sends the framing document content as the first input, before any memo content.
4. **Isolation.** Each memo scored alone. Tier-1 chapter failures retry that chapter only, never the whole memo.
5. **v1.0 scope.** `riskMultiplier` stays 1.0. Decision Confidence = Memo Confidence. Do not implement the suppressor.

---

## 2.1 OpenRouter Client

Create a thin OpenRouter client module.

- Read `OPENROUTER_API_KEY` from env.
- Export a single `callModel({ system, messages })` function returning the text completion.
- Define the model as a single exported constant, e.g. `export const SCORING_MODEL = "anthropic/claude-3.7-sonnet"` (Carson can swap the string). Use one model for all scoring calls in v1.0.
- Built-in: timeout, one automatic retry on transient (5xx/network) errors, and a structured error thrown on failure so Inngest can isolate it.
- A helper `callModelJSON(...)` that instructs the model to return ONLY valid JSON, strips any code fences, and safely parses — throwing a typed error if parsing fails.

## 2.2 Prompt Builders (framing-first, classification-not-scoring)

Create a `prompts/` module. Each builder returns `{ system, messages }` with the framing content placed first. The system prompt for every dimension must instruct the model to **return measurements and classifications only**, per that dimension's traceability log (TR) format in the hardening doc — never a final score.

Build these prompt families:

- **Tier 1 — per-chapter analysis prompt:** given framing + one chapter, return the per-chapter raw measurements needed by the dimensions that operate at chapter level (e.g. citation counts, contradictions within the chapter, acronym counts, number/unit pairs, bold counts, header counts). Output strict JSON.
- **Tier 2 — synthesis prompt:** given framing + all Tier-1 chapter results + whole-memo context, return cross-chapter classifications (cross-chapter contradictions for P1, coverage facets for P4, recommendation construction for P8, etc.). Strict JSON.
- **Tier 3 — targeted full-memo passes:** one prompt each for the dimensions that require a whole-document judgment that can't be assembled from chapters:
  - **Pillar 7 Output Realism:** return the claim inventory with each numeric claim classified against the benchmark library (the server passes the relevant `BenchmarkEntry` rows for the typology into the prompt), claim-calibration records (certainty vocab + evidence tier), and FIC test results. Apply the sparse-data claim count first.
  - **Risk-related context** if needed for Move 8 (CovI already comes from P4 synthesis).

Each prompt's JSON shape must map exactly to the TR log fields for its dimension(s). Keep one dimension's classifications clearly separated in the JSON so the server can compute each independently.

## 2.3 Server-Side Scoring Math

Create a `scoring/` module of **pure functions** (no LLM calls, fully unit-testable). These consume the agent's classifications and emit scores.

- `geometricMean(values[])` and `arithmeticMean(values[])` helpers.
- **Per-dimension compute functions**, one each for P1–P8 and D1–D5, implementing the exact formula from the framework:
  - P1, P3: base-5-minus-penalties (apply the penalty schedules; clamp [1,5]).
  - P2, P4: geometric mean of sub-scores.
  - P5, P6, P7, P8, D1–D5: arithmetic mean of sub-scores.
  - Each sub-score is itself derived from the agent's classifications against the thresholds in the hardening doc (e.g. citation density count → 1–5 via the threshold table).
- **Pillar 7 special handling:** apply the sparse-data protocol FIRST using the claim count → choose the formula branch (full / partial ×0.5 / minimal / not-scored). Classify NP against the benchmark rows; apply J1/J2/J3 justification tiers; compute CC with the weakest-source tier rule; run the 5 FIC tests (Test 5 = N/A if no dependency chain).
- **Move 8 (in P8):** read CovI from the P4 result object passed in. One-directional — never recompute coverage here.
- Every compute function returns `{ score, subScores, traceabilityLog }` where `traceabilityLog` is the structured TR record for storage.

## 2.4 Confidence & Status Derivation

Create a `confidence/` module:

- `erosionFromScore(score)` — maps a 1–5 dimension score to a confidence-erosion contribution (5 = 0 erosion, scaling to 1 = max). Use a documented mapping; keep it in one place so it's tunable.
- `memoConfidence(stage1Scores[])` = 100 − sum of Stage-1 erosion, clamp [0,100].
- `decisionConfidence(memoConfidence, riskMultiplier)` = memoConfidence × riskMultiplier. In v1.0 riskMultiplier = 1.0.
- `stage2Profile(stage2Scores[])` — returns the Stage-2 average and the 2×2 quadrant label; never folded into Memo Confidence.
- `statusBadge(memoConfidence, gaps[])` — returns READY_TO_SHIP / NEEDS_WORK / MAJOR_REWORK using documented thresholds (e.g. high confidence + no critical gaps = Ready; low confidence or any critical gap = Major Rework; else Needs Work). Keep thresholds as named constants.

## 2.5 Inngest Pipeline

Wire Inngest (dev mode, port 8288). Create a `scoreMemo` Inngest function triggered by an event `memo/score.requested` carrying `{ memoId, framingId, typology, approvedRisks[] }`.

Steps (use Inngest `step.run` so each is retryable in isolation):
1. **Load inputs** — fetch memo, framing, and the typology's benchmark rows from the DB.
2. **Tier 1 (parallel fan-out)** — one `step.run` per chapter calling the Tier-1 prompt. A single chapter failure retries that step only.
3. **Tier 2 (sequential)** — synthesis step consuming all Tier-1 outputs.
4. **Tier 3 (parallel)** — targeted full-memo passes (Pillar 7, etc.).
5. **Server scoring** — run the pure scoring functions over all classifications to produce 13 dimension results.
6. **Confidence + status** — derive Memo Confidence, Decision Confidence (×1.0), Stage-2 profile, status badge.
7. **Persist** — in one transaction, write the ScoringRun (with `rubricVersion = "V3 v1.0"`, both confidences, riskMultiplier 1.0, statusBadge, stage1Avg, stage2Avg), the 13 DimensionScore rows (serverComputed, agentSelfReported, traceabilityLog, calibrationDrift), the Gap[] and Edit[] rows derived from the findings, the ConfirmedRisk[] rows from the passed-in approved risks, and Diagnostic[] rows for any calibration drift or math-verification anomaly.

Provide an API route `POST /api/score` that emits the `memo/score.requested` event (this is what Phase 3's UI will call).

## 2.6 Math Self-Verification (the "catches its own errors" feature)

After server scoring, run a verification pass that re-checks each dimension's arithmetic (e.g. recompute the mean from stored sub-scores; confirm clamps held; confirm Move 8 used the stored CovI). Any mismatch is written as a `Diagnostic` of type ERROR with a message naming the dimension and the discrepancy. Calibration drift (server vs agent ≥1.0) is written as type CALIBRATION_WARNING with the binding metric named. This is exactly the diagnostics strip content the team valued.

---

## Phase 2 Verification Checklist

Because there's no UI yet, verify via the Inngest dev dashboard, a manual event trigger, and Prisma Studio.

- [ ] `npx inngest-cli@latest dev` runs on 8288; the `scoreMemo` function is registered and visible.
- [ ] OpenRouter client reads the key from env; `SCORING_MODEL` is a single swappable constant.
- [ ] Scoring math functions are pure and unit-tested: a known set of sub-scores produces the expected geometric/arithmetic/base-5 result for at least P1, P4, P7, and one Stage-2 dimension.
- [ ] Pillar 7 sparse-data protocol branches correctly: feeding 0 claims → "not scored"; 1–2 → NP+CC only; 5+ → full. (Unit test.)
- [ ] Move 8 consumes a passed-in CovI value and does not recompute coverage. (Unit test.)
- [ ] Confidence: Memo Confidence = 100 − Stage-1 erosion; Decision Confidence equals Memo Confidence (riskMultiplier 1.0); Stage-2 reported separately. (Unit test.)
- [ ] statusBadge returns the right label across three sample inputs (high/clean, mid, low/critical-gap). (Unit test.)
- [ ] Triggering `memo/score.requested` for a manually inserted memo row writes ONE ScoringRun + 13 DimensionScore rows + Gaps/Edits/Diagnostics; each DimensionScore has both serverComputed and agentSelfReported populated. (Use a real memo you paste into the DB, or trigger once Phase 3 exists — note which you did.)
- [ ] A deliberately broken arithmetic case produces a Diagnostic of type ERROR. (Unit test or forced case.)
- [ ] Framing content appears first in the assembled prompt payloads. (Inspect one built prompt.)

**STOP. Report Phase 2 results. On confirmation, Phase 3 (Score Memo flow + Risk Gate UI) follows.**

---

## Notes for Phase 3+ (not to build yet)

- Phase 3 wires the Score Memo 3-step flow and the 5-card Risk Gate that produces the `approvedRisks[]` the engine consumes, then calls `POST /api/score`.
- The engine's outputs already match what the Scorecard (Phase 4) renders: hero Memo Confidence + badge, quiet Decision Confidence line, 13-chip pillar strip, Gaps/Edits/Breakdown/Explanation/Recovery tabs, and the collapsible diagnostics strip.

*End of Phase 2 build instructions.*
