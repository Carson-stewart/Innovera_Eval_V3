# Innovera Eval V3 — Claude Code Build Instructions
## Phase 3 — Score Memo Flow + Risk Review Gate

**For:** Carson, executing via Claude Code in the `Innovera_Eval_V3` repo
**Prerequisite:** Phase 2 verified — scoring engine, Inngest `scoreMemo` function, `POST /api/score` all built and unit-tested.
**Build decisions (locked):** Inputs = file upload (.docx/.md/.txt) + paste-text fallback; live per-chapter progress during scoring; real LLM risk generation now (OpenRouter, framing-first).

> Reference: `docs/Innovera_Eval_V3_UIUX_Design_Spec.md` Page 4 (Score Memo) for layout/buttons, and Section 7 of the framework spec for the Risk Gate definition.

---

## Phase 3 Goal

A working Score Memo experience: the 3-step input flow, real AI risk generation, the 5-card Risk Review Gate with approve/reject/edit, and a live progress view that hands off to the scorecard. By the end of this phase, a real scoring run executes end-to-end and writes the first ScoringRun to the database (closing out the Phase 2 deferred item).

---

## 3.0 Guiding Rules

1. **Framing first** in the risk-generation call too — framing content before memo content.
2. **The engine is already built.** This phase produces the inputs it consumes (`memoId`, `framingId`, `typology`, `approvedRisks[]`) and calls `POST /api/score`. Do not modify the scoring math.
3. **Two-step deletes / inline edits** per the design spec wherever edit/delete appears.
4. **v1.0 scope** unchanged — nothing here touches the risk multiplier or Decision Confidence.

---

## 3.1 File Parsing & Memo Storage

Create a file-ingest module.

- Accept `.docx`, `.md`, `.txt` uploads plus a paste-text fallback (a textarea).
- Parse `.docx` to text using `mammoth` (already the project's docx-reading approach) or equivalent; `.md`/`.txt` read as plain text.
- On submit, create the `Memo` row (name, typology, notes) and the `Framing` row (content, sourceType DOCX/WIZARD/CHAT, typology). Store the raw memo text where the engine can read it (a `content` field on Memo, or a related text store — keep it simple and consistent with the Phase 1 schema; if a content field is missing, add it via a migration).
- **Chapter splitting:** the engine's Tier 1 operates per chapter. Implement a chapter splitter that divides the memo text into chapters (by markdown headings / the memo's standard chapter headers). Store the chapter list with the memo so Tier 1 can fan out. Handle the 10-scorable-chapter + 2-non-scored-section structure: the 2 non-scored sections (Financial Appendix, Six-T/Risk Analysis) are passed for context but flagged non-scored.

## 3.2 The 3-Step Flow (Score Memo page)

Build the page per UIUX Page 4 with a step tracker (1 — 2 — 3) across the top.

- **Step 1 — Framing:** upload or select an existing framing record; show its content; allow inline **edit** before continuing. "Next" advances.
- **Step 2 — Typology:** four large choice buttons (1A External Investment, 1B Internal Initiative, 2A New Market Entry, 2B New Product Launch). One must be selected to advance. Pre-select if the framing carries a typology.
- **Step 3 — Memo:** upload or paste the memo; edit memo name/notes (inline pencil). "Next" advances to the Risk Gate.
- Back/Next navigation between steps; state preserved across steps.

## 3.3 Risk Generation (real LLM)

Create `POST /api/risks/generate` taking `{ framingId, memoId, typology }`.

- Build a framing-first prompt that asks the model to surface the **top 5 critical risks** for this memo+framing+typology, returning strict JSON: an array of 5 objects, each with `statement`, `classification` (BULL / BEAR / BILATERAL), `source` (TYPOLOGY / FRAMING / EMPIRICAL / LLM_INFERENCE), `severity` (CRITICAL / HIGH / MEDIUM), and `whyNotARisk` (the steelman "why this might NOT be a risk" line from the framework's Tier-1 gate).
- Return the 5 risks to the client. Do NOT persist them yet — they become `ConfirmedRisk` rows only after the user reviews and starts scoring.
- Include the **Framework's-Eye-View Caveat** text in the UI near the risks (these are the model's flagged risks, subject to human judgment).

## 3.4 Risk Review Gate UI

Per UIUX Page 4 Risk Gate. Render the 5 risks as cards.

- Each card shows: statement, classification, source, severity, and the "why this might NOT be a risk" line.
- Each card has **Approve** / **Reject** controls and an **Edit** (pencil) to adjust the statement or classification inline before approving.
- A **"Need deeper review"** button triggers the Tier-2 deep pass (a second, more thorough LLM call returning the same shape for the flagged risk(s)); show its result in place.
- **"Start Scoring"** is disabled until all 5 risks have an Approve/Reject decision. On click: assemble `approvedRisks[]` (the approved ones, with any edits) and `POST /api/score` with `{ memoId, framingId, typology, approvedRisks }`. Capture the returned `eventId`.

## 3.5 Live Progress View

After "Start Scoring," show a progress view (not a bare spinner).

- Display the pipeline stages: per-chapter Tier 1 steps, then synthesis (Tier 2), then full-memo passes (Tier 3), then scoring/persist.
- Reflect real progress by polling an Inngest run-status endpoint (or the recommended Inngest run subscription) keyed off the `eventId` / run id. Show each chapter ticking from "pending" → "done."
- On completion, read the new ScoringRun id and **redirect to `/scorecard/[id]`**.
- On failure of a step, surface a clear message; per the engine's isolation, a single chapter retry should not fail the whole run.

## 3.6 Wire the Scorecard Landing (minimal)

The full Scorecard is Phase 4. For Phase 3, ensure `/scorecard/[id]` can at least load the persisted ScoringRun and confirm the data is there (a minimal render is fine — even a raw display of Memo Confidence, status badge, and the 13 dimension scores). This proves the end-to-end write worked. Phase 4 makes it the full designed scorecard.

---

## Phase 3 Verification Checklist

- [ ] Score Memo page shows the 1–2–3 step tracker; Back/Next preserves state.
- [ ] Step 1 accepts a framing via upload (.docx/.md/.txt) and via paste; inline edit works.
- [ ] Step 2 shows four typology buttons; selection required to advance; framing-carried typology pre-selects.
- [ ] Step 3 accepts a memo via upload and paste; memo name/notes editable.
- [ ] `.docx` upload parses to text correctly (test with a real memo .docx).
- [ ] Chapter splitter produces a sensible chapter list; the 2 non-scored sections are flagged non-scored.
- [ ] `POST /api/risks/generate` returns 5 risks as valid JSON with all required fields; framing appears first in the prompt.
- [ ] Risk Gate renders 5 cards; Approve/Reject/Edit each work; "Start Scoring" stays disabled until all 5 are decided.
- [ ] "Need deeper review" triggers a Tier-2 call and shows its result.
- [ ] "Start Scoring" calls `POST /api/score` and returns an eventId.
- [ ] Live progress view reflects real pipeline progress (chapters tick to done), not a static spinner.
- [ ] **End-to-end: a real scoring run completes and writes ONE ScoringRun + 13 DimensionScore rows + Gaps/Edits/Diagnostics + the approved ConfirmedRisk rows.** (This closes the Phase 2 deferred item.)
- [ ] On completion the app redirects to `/scorecard/[id]` and that page loads the persisted run (minimal render OK).
- [ ] Both serverComputed and agentSelfReported are populated on the real run's DimensionScores; any drift produced a Diagnostic.

**STOP. Report Phase 3 results. This is the first real end-to-end run — include the resulting Memo Confidence, status badge, and confirm 13 DimensionScore rows were written. On confirmation, Phase 4 (full Scorecard) follows.**

---

## Notes for Phase 4 (not yet)

Phase 4 builds the full Scorecard: hero Memo Confidence + status badge, the quiet Decision Confidence placeholder line, the Stage1/Stage2 matrix, ELO + version stamp, the 13-chip pillar strip, the Gaps/Edits/Breakdown/Explanation/Recovery tabs (Gaps & Edits emphasized), the collapsible engine-diagnostics strip, and the edit/delete controls. The data it renders is exactly what Phase 3's run just wrote.

*End of Phase 3 build instructions.*
