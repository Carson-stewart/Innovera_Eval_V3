# Innovera Eval V3 — Claude Code Build Instructions
## Phase 0 (Foundation) + Phase 1 (Data Layer)

**For:** Carson, executing via Claude Code in the `Innovera_Eval_V3` repo
**Pattern:** Execute this document, report results back, confirm before requesting Phase 2
**Inputs required in `/docs`:** Framework Spec (.docx), Dimension Hardening (.md), UI/UX Design Spec (.md)

---

## How to Use This Document

1. Open the repo in your terminal, run `claude`.
2. Paste the **Bootstrap Prompt** (Section A) as your first message.
3. Then work through Phase 0, then Phase 1, in order. Each phase has a verification checklist — confirm it passes before moving on.
4. If Claude Code proposes changes outside the stated scope of a phase, decline and keep it to scope.

---

## Section A — Bootstrap Prompt (paste first)

> You are building Innovera Eval V3, a memo evaluation platform, from three specification documents in the `/docs` folder of this repo:
> 1. `Innovera_Eval_V3_Framework_Spec_v1.0_Complete.docx` — the scoring framework: 13 dimensions, formulas, traceability logs, AI guardrails, and the Pillar 7 benchmark library.
> 2. `Innovera_Eval_V3_Dimension_Hardening.md` — per-dimension traceability log formats and guardrails.
> 3. `Innovera_Eval_V3_UIUX_Design_Spec.md` — the screen-by-screen UI design.
>
> Before writing any code: read all three documents in full. Then read this instruction document. Confirm back to me, in your own words: (1) the two-stage scoring architecture, (2) why Decision Confidence is a placeholder in v1.0, (3) the tech stack, and (4) what Phase 0 builds. Do not start coding until I reply "proceed."
>
> Stack (fixed): Next.js 14 (App Router), TypeScript, Prisma, PostgreSQL 17, Tailwind + shadcn/ui, Inngest for background jobs, OpenRouter for LLM calls. Document generation via the `docx` and `pptxgenjs` libraries.
>
> Build discipline: build only what each phase specifies. Do not scaffold future phases early. After each phase, stop and report what you built and the verification results.

---

## Section B — Create CLAUDE.md (persistent project rules)

Have Claude Code create a `CLAUDE.md` at the repo root with this content. It persists across sessions and keeps the build on-spec.

```markdown
# Innovera Eval V3 — Project Rules

## What this is
A collaborative memo evaluation platform. Two modules:
- Memo Evaluator (primary): Confidence Erosion scoring across 13 dimensions, Risk Review Gate, Pairwise ELO.
- Decision Framing Sanity Checker (carry-over): multi-model framing validation.

## Non-negotiable architecture rules
1. Stage 1 (Solution Validity, 8 pillars) and Stage 2 (Output Quality, 5 dimensions) are NEVER combined into one number. They are reported separately.
2. Confidence Erosion: every memo starts at 100; quality issues erode it. Memo Confidence = 100 minus pillar erosion.
3. Decision Confidence in v1.0 = equal to Memo Confidence. The Risk Multiplier is held at 1.0 (Critical Risk Suppressor deferred to v1.5). Show it as a quiet placeholder, never a co-equal hero number.
4. Traceability is one-directional: the agent measures and classifies; the server computes scores from those classifications. NEVER reverse-engineer a classification to hit a target score.
5. The framing document is sent as the FIRST input in every LLM scoring call, before memo content.
6. Each memo is scored in isolation — no cross-memo contamination of absolute scores.

## v1.0 scope guards (do NOT build these in v1.0)
- No active Risk Multiplier / Critical Risk Suppressor (held at 1.0).
- No Risk Analysis tab on the scorecard.
- No Effective Penalty / Risk Erosion Summary panel.
- No Pillar 7 deferral — Pillar 7 IS active in v1.0, benchmark-library-backed.

## Design language (hard requirement)
- White / black / grey base, single orange accent (Innovera "A").
- Soft cards, generous spacing, one clean font. Status colors (green/amber/red) only on scores and alerts.
- Shared shell on every page: left sidebar (active item orange) + top bar + main area.

## Safety rules for destructive actions
- Every delete is two-step: action -> confirmation dialog ("cannot be undone") -> confirm. No one-click deletes anywhere.

## Stack
Next.js 14 App Router, TypeScript, Prisma, PostgreSQL 17, Tailwind + shadcn/ui, Inngest (port 8288), dev server on port 3000, OpenRouter for LLM calls.
```

---

## PHASE 0 — Foundation & Shell

**Goal:** A running Next.js app with the shared shell (sidebar + top bar), all six page routes stubbed, the design tokens in place, and environment wiring. No scoring logic yet.

### 0.1 Scaffold
- Initialize Next.js 14 with the App Router, TypeScript, Tailwind.
- Install and initialize shadcn/ui.
- Install Prisma; do not write the schema yet (Phase 1).
- Set up `.env.example` listing the variables needed (`DATABASE_URL`, `OPENROUTER_API_KEY`, `INNGEST_DEV=1`). Do NOT put real keys anywhere; Carson fills `.env` himself.

### 0.2 Design tokens
- Create a Tailwind theme with the design language: white background, dark grey text, light grey borders, one orange accent token, and three status tokens (green/amber/red). Use placeholder hex values now; mark them clearly as `// TODO: replace with Innovera brand hex` so they're easy to swap.
- One clean sans-serif font family configured globally.

### 0.3 Shared shell
- Build a layout with a fixed left **sidebar** and a **top bar**, with the main area as the page slot.
- Sidebar items (icon + label), in this order: Dashboard, Upload Framing, Sanity Check, Score Memo, History, Scoring Guide. Active item highlighted in orange.
- Top bar: page title left; user-initials placeholder right; a slot for page-level actions (search, edit, overflow) that individual pages can fill.

### 0.4 Stub the six routes
- Create routes for all six pages with placeholder content (just the page title in the main area). The Scorecard is NOT in the sidebar — create it as a route reachable by URL only (e.g. `/scorecard/[id]`), also stubbed.

### Phase 0 Verification Checklist
- [ ] `npm run dev` starts cleanly on port 3000.
- [ ] All six sidebar links navigate; active item highlights orange.
- [ ] Scorecard route loads by direct URL but is absent from the sidebar.
- [ ] Design tokens render (orange accent visible on the active nav item).
- [ ] `.env.example` exists; no real secrets committed; `.env` is gitignored.
- [ ] CLAUDE.md exists at repo root.

**STOP. Report Phase 0 results before starting Phase 1.**

---

## PHASE 1 — Data Layer

**Goal:** The full Prisma schema and database, matching the framework's versioning and traceability requirements. No UI wiring yet — just the data model and a seed.

### 1.1 Schema — core tables
Build a Prisma schema with these models (names indicative; Claude Code may refine field types):

**Memo**
- id, name, typology (enum: ONE_A, ONE_B, TWO_A, TWO_B), createdAt, updatedAt, notes (optional)
- relation: scoringRuns[]

**Framing**
- id, name, sourceType (enum: DOCX, WIZARD, CHAT), content (text), typology (optional), createdAt
- relation: sanityChecks[]

**ScoringRun** (one per scoring event; supports versioned re-scoring)
- id, memoId, rubricVersion (string, e.g. "V3 v1.0"), memoConfidence (float), decisionConfidence (float), riskMultiplier (float, default 1.0), statusBadge (enum: READY_TO_SHIP, NEEDS_WORK, MAJOR_REWORK), stage1Avg, stage2Avg, scoredAt, scorerId (optional)
- relations: dimensionScores[], confirmedRisks[], gaps[], edits[], diagnostics[]

**DimensionScore** (one per scored dimension per run — 13 per run)
- id, scoringRunId, dimensionKey (enum — exactly 13 values: P1, P2, P3, P4, P5, P6, P7, P8 (all 8 Stage 1 pillars, P7 ACTIVE), D1, D2, D3, D4, D5 (5 Stage 2 dimensions)), score (float), subScores (json), traceabilityLog (json — the TR-log content), serverComputed (float), agentSelfReported (float, optional), calibrationDrift (boolean)
- NOTE: There are 13 DimensionScore rows per ScoringRun — one per dimension key above. P7 (Output Realism) IS included and active in v1.0.

**ConfirmedRisk**
- id, scoringRunId, statement, classification (enum: BULL, BEAR, BILATERAL), source (enum: TYPOLOGY, FRAMING, EMPIRICAL, LLM_INFERENCE), severity (enum: CRITICAL, HIGH, MEDIUM), approved (boolean), edited (boolean)

**Gap** and **Edit** (the two lead scorecard tabs)
- id, scoringRunId, dimensionKey, issue (text), impact (text), fix (text), severity (enum: HIGH, MEDIUM, LOW)

**Diagnostic** (the engine self-audit strip)
- id, scoringRunId, type (enum: ERROR, CALIBRATION_WARNING), message (text)

**SanityCheck** (framing module)
- id, framingId, verdict (enum: READY_FOR_ANALYSIS, MAJOR_REWORK_NEEDED), passCount, failCount, enhanceCount, triageMatrix (json), revisedFraming (text), createdAt
- relation: sanityIssues[]

**SanityIssue**
- id, sanityCheckId, issue, impact, fix, severity, evidenceBasis, escalated (boolean)

**EloRecord** (version-independent)
- id, memoId, rating (float, default 1500), comparisonCount (int), updatedAt
- relation: comparisons[]

**EloComparison**
- id, memoAId, memoBId, winner (enum: A, B, TIE), margin (enum: CLEAR, MODERATE, SLIGHT, AMBIGUOUS), confidence (enum: HIGH, MEDIUM, LOW), humanOverride (boolean), reasoning (text optional), comparedAt

**BenchmarkEntry** (Pillar 7 library — seeded, editable)
- id, typology (enum incl. CROSS), metric, plausibleRange, boundaryRange, outOfRange, sources

### 1.2 Key schema rules (from the framework)
- ScoringRun + DimensionScore are separate from EloRecord/EloComparison: ELO is version-independent; absolute scores carry a rubricVersion stamp.
- Re-scoring a memo under a new rubric version creates a NEW ScoringRun, never overwrites an existing one. Both persist.
- DimensionScore stores BOTH serverComputed and agentSelfReported so calibration drift is queryable (this powers the diagnostics strip).

### 1.3 Migration + seed
- Run the initial migration against local Postgres.
- Seed the BenchmarkEntry table from Appendix G of the Framework Spec (all four typologies + cross-typology reference rows).
- Seed nothing else (no fake memos).

### Phase 1 Verification Checklist
- [ ] `npx prisma migrate dev` runs cleanly; tables exist in Postgres.
- [ ] `npx prisma studio` shows all models.
- [ ] BenchmarkEntry table is populated from Appendix G (spot-check: SaaS gross margin row reads 65–82%).
- [ ] DimensionScore has both serverComputed and agentSelfReported fields.
- [ ] ScoringRun has rubricVersion and statusBadge; riskMultiplier defaults to 1.0.
- [ ] No fake/seed memos exist.

**STOP. Report Phase 1 results. On confirmation, I will write Phase 2 (Scoring Engine + LLM Call Architecture).**

---

## Phases Still to Come (for context, not to build yet)

- **Phase 2 — Scoring Engine:** the three-tier LLM call architecture, per-dimension scoring with TR-logs and AG guardrails, server-side score computation, status-badge logic.
- **Phase 3 — Score Memo flow + Risk Gate:** the 3-step flow, the 5-card risk gate with edit/approve/reject, progress view.
- **Phase 4 — Scorecard:** hero score + badge, quiet Decision Confidence line, pillar strip, Gaps/Edits/Breakdown/Explanation/Recovery tabs, collapsible diagnostics strip, edit/delete.
- **Phase 5 — Sanity Checker:** upload framing, multi-model check, triage matrix, consolidated report, always-on revised framing.
- **Phase 6 — Dashboard + History + ELO:** summary cards, activity, alerts, history table with filters, ELO progression + seeding.
- **Phase 7 — Scoring Guide + polish:** the explainer page, Innovera brand hex swap, final QA.

---

*End of Phase 0 + Phase 1 build instructions.*
