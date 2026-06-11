# Sanity Checker Architecture Notes (Step 0 — discovered before implementation)

Recorded 2026-06-11, before any upgrade code.

## Check registry — `lib/framing/checks.ts`
- 48 checks as four const arrays: `CATEGORY_A` (A1–A8, ALL Enhancement/advisory — "do
  not block delivery" is a category invariant), `CATEGORY_B` (B1–B13, Completeness),
  `CATEGORY_C` (C1–C10, Structural Integrity), `CATEGORY_D` (D1–D17, Rule Compliance).
- Shape: `FramingCheck { id, name, category, severity: Critical|Structural|Enhancement,
  fidelity: HIGH|MEDIUM|LOW, evidenceBasis: "Empirically calibrated"|"Structurally
  inferred", source, failCriteria, naCondition, recommendationForm, patternIds[] }`.
- Exports: `ALL_CHECKS`, `CHECKS_BY_CATEGORY`, `CHECKS_BY_ID`.
- The file carries an INFERENCE FLAG: all 48 definitions were inferred from CLAUDE.md +
  spec section 15, not read from rubric tables T10–T57.
- **Next free ID: D18** (the new check is Critical, so Category A is excluded by its
  advisory-only invariant; "one quantity, one value" reads naturally as Rule
  Compliance). **Convention decision:** `CHECKS_BY_CATEGORY` is also the grouping the
  LLM category passes consume — to keep the existing 48-check prompts byte-identical,
  D18 is exported separately (`SINGLE_SOURCE_CHECK`) and included in
  `ALL_CHECKS`/`CHECKS_BY_ID` (metadata, severity mapping, display) but NOT in
  `CHECKS_BY_CATEGORY.D`. It is evaluated by its own dedicated two-stage pipeline pass.

## Patterns — `lib/framing/patterns.ts`
- `PATTERNS: FramingPattern[]`, P1–P30. Shape: `{ id, name, symptom, whyItMatters,
  detectionLogic, caughtBy[], recommendedFix }` (no fidelity field on patterns; the
  check's `fidelity` carries the tier). **Next free pattern ID: P31.**

## Pipeline — `inngest/functions/sanityCheck.ts`
- Trigger `framing/sanity-check.requested`; steps: `load-framing` → `pass0-structure`
  (typology, LLM) → server commercialization override → `pass1-cat-a` …
  `pass4-cat-d` (one `callModelJSON` per category; the framing document is sent FIRST
  in every prompt, per protocol) → `server-verdict` (model never sets the verdict) →
  `persist`.
- LLM call pattern: `callModelJSON<T>({ system, messages })` from `lib/openrouter`
  (temp 0 default). **Stage 2 of the new check follows this exact pattern**, wrapped
  behind an injectable adjudicator so tests can mock it with zero reachable LLM path.
- Existing verdict enum (`READY_FOR_*`) is computed server-side with the D15 lone-fail
  carve-out and C10/D1–D3 escalations — untouched. The new T3 gate verdict is a
  SEPARATE field; it does not replace or alter `SanityCheck.verdict`.

## Persistence — `prisma/schema.prisma`
- `SanityCheck { framingId, verdict, passCount, failCount, enhanceCount, triageMatrix
  Json, revisedFraming, typology?, typologyConfidence?, createdAt }` 1:N
  `SanityIssue { checkId, issue, impact, fix, severity HIGH|MEDIUM|LOW, category,
  fidelityTier, confidence, location?, rewrite?, evidenceBasis?, escalated }`.
- Severity mapping at persist: Critical→HIGH, Structural→MEDIUM, Enhancement→LOW.
- `evidenceBasis` on SanityIssue is a free String — the run-64 empirical sentence for
  D18 findings is carried via a new optional `evidenceDetail` field on `FramingCheck`
  (additive interface field; unset for the existing 48, so their persisted values are
  unchanged).
- **Additive columns added by this task:** `checkerVersion String?`,
  `gateVerdict String?`, `anchorInventory Json?` on SanityCheck. Existing rows keep
  null everywhere.

## Client-Stated Input Protocol — implementation and the T1 reading
- Implemented as PROMPT TEXT in `buildCategoryPrompt` (sanityCheck.ts:106–107): for
  non-advisory categories, "verify whether the element under review was explicitly
  provided by the client as a given input. If so, return status NA rather than FAIL,"
  with each check's own `naCondition` passed alongside.
- **Confirmed reading:** the protocol shields client figures from being judged
  *implausible* (external challenge). It is generic prompt guidance, and the per-check
  `naCondition` is the specific override mechanism the architecture already provides.
  Nothing in the implementation hard-exempts *internal contradictions between two
  client figures* — so the task's intended reading holds, and D18's `naCondition`
  states it explicitly: client-origin makes a figure exempt from plausibility
  challenge, not from conflicting with another client figure. Stage 2's dedicated
  adjudication prompt repeats this. → No stop-and-report needed.

## Version constant
- None existed: the persist step hardcodes the string "[Sanity Check v1.0 …]" in
  `revisedFraming`. **Created `lib/framing/version.ts`** with
  `CHECKER_VERSION = "v1.2"` (and `GATE_MODE`), now stamped on results via the new
  `checkerVersion` column and the revisedFraming header.

## Scoring-flow surfacing target
- `app/score-memo/page.tsx` owns the upload → Risk Gate → score flow and knows the
  selected `framingId`; the gate chip is fetched from a new read-only
  `GET /api/framing-gate?framingId=` (latest SanityCheck for that framing).
  Enforcement (flag off) lives server-side in `POST /api/score` via the pure
  `gateAllowsScoring()` helper.

## Anchor-count semantics (ground-truth driven)
- "Stated N times" counts **distinct statements** (newline-delimited lines) containing
  the anchor, not raw token occurrences — Zebra's framing mentions $500M in 8
  statements but 10 tokens (two lines restate it within the same sentence); the
  registered ground truth is 8. Locations[] are 1-based line numbers.
