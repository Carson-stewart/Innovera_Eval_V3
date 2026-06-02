# Innovera Eval V3 — Claude Code Build Instructions
## Phase 3.5 — Pillar Explanations (Tooltips + Expandable Panels)

**For:** Carson, executing via Claude Code
**Prerequisite:** Phases 0–3 complete; chapter-splitter bug fixed.
**Scope:** A small UI-only addition. No scoring logic changes. Build before the next scoring run.

**Decisions (locked):**
- Two layers per pillar: a one-line **gloss** (hover tooltip) and a fuller **detail** (expandable).
- Appears **everywhere a pillar name shows** — driven by one shared data source + two reusable components.

---

## 3.5.0 Guiding Rule

Write the explanation text **once** in a single shared module. Every place that shows a pillar name imports from it. Do not hardcode explanation text in individual components — that guarantees drift. The tooltip and the expandable panel both read the same source.

---

## 3.5.1 Create the shared explanations module

Create `lib/pillars/explanations.ts` (or co-locate with existing pillar constants if a pillar-metadata file already exists — reuse, don't duplicate).

Export a typed map keyed by the 13 dimension keys. Each entry has: `key`, `name`, `stage` ("Stage 1" | "Stage 2"), `gloss` (one line, for the tooltip), and `detail` (2–3 plain sentences, for the expandable). Use exactly this content:

```typescript
export type PillarExplanation = {
  key: string;
  name: string;
  stage: "Stage 1" | "Stage 2";
  gloss: string;
  detail: string;
};

export const PILLAR_EXPLANATIONS: Record<string, PillarExplanation> = {
  P1: {
    key: "P1", name: "Coherence", stage: "Stage 1",
    gloss: "Does the memo agree with itself?",
    detail: "Checks that the memo doesn't contradict itself — the same number means the same thing throughout, claims in one section don't clash with another, and any tensions are acknowledged rather than ignored.",
  },
  P2: {
    key: "P2", name: "Problem Formulation", stage: "Stage 1",
    gloss: "Does it answer the actual question that was asked?",
    detail: "Checks that the memo addresses the specific decision in the framing document — not a nearby topic — and that it answers the key questions the framing raised, with concrete next steps.",
  },
  P3: {
    key: "P3", name: "Structural Accuracy", stage: "Stage 1",
    gloss: "Are the expected chapters all there?",
    detail: "Checks that the memo includes the chapters expected for its type of decision. A memo can have every chapter present yet still answer the wrong question — that's why this is separate from Problem Formulation.",
  },
  P4: {
    key: "P4", name: "Coverage", stage: "Stage 1",
    gloss: "Did it explore enough options and scenarios?",
    detail: "Checks the breadth of analysis — were multiple options compared, were best/worst/likely scenarios considered, and were the obvious counterarguments examined, rather than just presenting one path.",
  },
  P5: {
    key: "P5", name: "Evidence Quality", stage: "Stage 1",
    gloss: "Are the claims backed by good sources?",
    detail: "Checks how well claims are supported — how often they're cited, whether the sources are credible (government, research firms, filings) rather than low-quality, and whether the origin of each figure is traceable.",
  },
  P6: {
    key: "P6", name: "Assumption Quality", stage: "Stage 1",
    gloss: "Are the assumptions stated and labelled?",
    detail: "Checks whether the memo names its assumptions out loud, says where each one came from, and links them to a way of testing whether they hold — instead of burying guesses inside the analysis.",
  },
  P7: {
    key: "P7", name: "Output Realism", stage: "Stage 1",
    gloss: "Do the numbers reflect how the world actually works?",
    detail: "Checks the financial figures against real-world benchmark ranges — are the growth rates, margins, and returns plausible, does the confidence of each claim match its evidence, and do the numbers hold together as a coherent model.",
  },
  P8: {
    key: "P8", name: "Solution Quality", stage: "Stage 1",
    gloss: "Is the recommendation clear and well-built?",
    detail: "Checks the recommendation itself — is it specific and quantified, does it come with success gates and kill conditions, and does its confidence match how thoroughly the analysis explored the question.",
  },
  D1: {
    key: "D1", name: "Interpretability", stage: "Stage 2",
    gloss: "Is it easy to read and understand?",
    detail: "Checks the reading effort — does the verdict come first, are acronyms defined, are sentences a reasonable length, and is the summary an appropriate size rather than a wall of text.",
  },
  D2: {
    key: "D2", name: "Structural Clarity", stage: "Stage 2",
    gloss: "Is it well-formatted and easy to scan?",
    detail: "Checks the visual layout — clear headings, tables where they help, sensible use of bold, and working cross-references — so a reader can navigate the document quickly.",
  },
  D3: {
    key: "D3", name: "Audience Calibration", stage: "Stage 2",
    gloss: "Is it written for an executive reader?",
    detail: "Checks whether the tone and language fit a decision-maker audience — an executive voice rather than an operator's, the right terminology, and confident framing rather than excessive hedging.",
  },
  D4: {
    key: "D4", name: "Communicative Completeness", stage: "Stage 2",
    gloss: "Does it give the reader everything they need?",
    detail: "Checks that actions have owners and timing, that claims show their basis, that risks are laid out clearly, and that the summary can be understood on its own without digging into the body.",
  },
  D5: {
    key: "D5", name: "Actionability", stage: "Stage 2",
    gloss: "Is the immediate next step crystal clear?",
    detail: "Checks whether a reader knows exactly what to do next — a clear go/no-go, a specific first action, the capital being asked for, and what happens if no decision is made.",
  },
};
```

(If a pillar-name constant already exists elsewhere, have this module re-use those names rather than re-declaring them, to avoid two sources of names.)

## 3.5.2 Build two reusable components

Create `components/pillars/`:

**`PillarTooltip.tsx`** — wraps a pillar label or chip. On hover (and keyboard focus, for accessibility), shows the `gloss` in a small popup. Use the shadcn/ui Tooltip primitive (already installed). Props: `pillarKey`. Renders its children as the trigger.

**`PillarExplainer.tsx`** — a collapsible block. Shows the pillar name with a small info/chevron affordance; clicking expands to reveal the `detail` text (and optionally the stage label). Use the shadcn/ui Collapsible or Accordion primitive. Props: `pillarKey`, plus an optional `defaultOpen`.

Both components read from `PILLAR_EXPLANATIONS[pillarKey]`. Keep them presentational and theme-consistent (grey body text, the orange accent only for the affordance icon if needed — not the whole block).

## 3.5.3 Wire them in everywhere a pillar name appears

Apply consistently:

- **Scorecard per-pillar strip (the 13 chips):** wrap each chip in `PillarTooltip` so hovering any chip shows its one-line gloss.
- **Score Breakdown tab:** each pillar row gets a `PillarExplainer` (expandable) so the reader can open the fuller explanation inline next to the score.
- **Any other place a pillar/dimension name is rendered** (e.g. Gaps/Edits items that reference a dimension, the Explanation tab): at minimum attach the `PillarTooltip` to the name.
- **Scoring Guide page:** render the full set — all 13 as `PillarExplainer` blocks grouped by Stage 1 / Stage 2 — as the canonical reference list. (This satisfies "a Scoring Guide note that makes the methodology transparent.")

## 3.5.4 Keep it accessible and unobtrusive

- Tooltips trigger on hover AND focus; dismiss on blur/escape.
- Don't auto-expand explainers by default (except optionally the Scoring Guide). The reader opts in.
- No layout shift that pushes scores around when an explainer opens — it should expand in place.

---

## Phase 3.5 Verification Checklist

- [ ] `lib/pillars/explanations.ts` exports all 13 entries (P1–P8, D1–D5), each with name, stage, gloss, and detail. No pillar missing.
- [ ] Pillar names are not duplicated as string literals in components — they come from the shared module.
- [ ] Hovering a chip on the Scorecard pillar strip shows the one-line gloss tooltip.
- [ ] The Score Breakdown tab shows an expandable explainer per pillar; clicking reveals the detail text; it expands in place without shoving the score around.
- [ ] The Scoring Guide page lists all 13, grouped Stage 1 / Stage 2, each expandable.
- [ ] Tooltips work on keyboard focus, not just mouse hover.
- [ ] No scoring logic was touched; Phase 2 unit tests still pass; `tsc --noEmit` clean.

**STOP. Report results. Then we return to the clean scoring run.**

---

*This is a UI-only phase. After it verifies clean, re-upload Ecolab_Parallel_Gen.md and do the first trustworthy scoring run (~15 tier1 steps).*
