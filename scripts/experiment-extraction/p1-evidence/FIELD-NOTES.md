# P1 Evidence Field Mapping (Step 0)

Inspected: run 23's P1 `DimensionScore` row, its P1 `Gap` row, and its P1 `Edit` rows
(read-only, `probe-p1*.ts`). Frozen files read for shape reference only:
`lib/scoring/stage1/p1.ts`, `lib/prompts/types.ts`.

## Where P1 evidence lives

### 1. `DimensionScore` (dimensionKey = "P1") — COUNTS ONLY, no named facts

`subScores` (camelCase) and `traceabilityLog` (snake_case) store the same numeric
penalty math, e.g. run 23:

```
subScores:        { ci: 2, bonus: 0.5, minorGaps: 6, flatPenalty: 0, majorPenalty: 2,
                    reasoningGaps: 19, totalPenalties: 3.5, ..., majorReconciliations: 6 }
traceabilityLog:  { ci: 2, formula: "CI = 5 − penalties + tension_bonus, clamp [1,5]",
                    major_reconciliation_failures: 6, reasoning_gaps: 19,
                    minor_cap_applied: true, ... }
```

- **`reconciliationFailureCount`** = `subScores.majorReconciliations`
  (≡ `traceabilityLog.major_reconciliation_failures`).
- Other numeric subs: `flatContradictions`, `minorGaps`, `definitionalDrifts`,
  `reasoningGaps`, `flatPenalty`, `majorPenalty`, `minorCombinedPenalty`,
  `totalPenalties`, `bonus` (tension), `ci` (= final score).
- **⚠️ The specific conflicting facts are NOT here.** The agent's Tier-1/Tier-2 output
  carries full per-failure detail — `ReconciliationEntry { quoteA, quoteB, description,
  locations[] }` (lib/prompts/types.ts:20-27) and cross-chapter equivalents
  (types.ts:197-204) — but `computeP1` (lib/scoring/stage1/p1.ts:33-46) reduces every
  array to `.length` before building the persisted result. The quotes/locations are
  never written to the database; they existed only in the ephemeral Inngest step journal
  (already confirmed unrecoverable in the Phase 2 verification).

### 2. `Gap` (dimensionKey = "P1") — generic templated text

One row per low-scoring pillar, e.g. run 23: "Coherence: 6 major reconciliation
failure(s) — the same metric appears with conflicting values in different sections."
Template from `deriveSpecificGap` — **only the count is interpolated; no facts named.**

### 3. `Edit` (dimensionKey = "P1") — THE ONLY STORED NAMED-FACT EVIDENCE

LLM-generated at scoring time (step `generate-edits`, temp 0) for pillars < 4.0,
grounded in the traceability log + memo content. These DO name the conflicting
figures and their sections, e.g. run 23:

> "The memo states conflicting revenue timelines: '~18–24 months' in the Executive
> Summary table versus '24 months' in Strategic Opportunity Validation…"

**Caveats for the hypothesis test (recorded, not interpreted):** Edit rows are a
secondary LLM artifact, not the scoring agent's own failure list; 1–3 edits are
generated per finding, so they may not enumerate all N counted failures (run 23:
6 counted failures, 3 stored P1 edits); runs whose P1 ≥ 4.0 have no P1 edits at all;
and a run-level LLM failure in edit generation silently yields zero edits
(non-fatal catch in scoreMemo.ts:369-372).

### 4. Raw LLM responses — NOT PERSISTED

No table stores Tier-1/Tier-2 raw responses. `DimensionScore.traceabilityLog` is the
only persisted "TR-log" and for P1 it is numeric. **Gap: per-failure quoteA/quoteB/
locations are unrecoverable for all stored runs.**

## Consequence for the hypothesis (flagged per task instruction)

The stored data identifies P1 reconciliation failures **by count only**; the
agent-cited conflicting facts were discarded before persistence. The P1 ↔ Favorite
Friends comparison therefore cannot match the scoring agent's own failure list against
repeated clusters. The nearest stored proxy is the P1 **Edit** text (named facts, but
secondary, capped at ~3, and absent for P1 ≥ 4.0 runs). This materially changes how
the hypothesis can be tested and is restated in the extraction summary.
