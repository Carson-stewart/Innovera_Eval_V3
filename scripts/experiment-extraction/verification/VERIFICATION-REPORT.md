# Phase 2 Verification Report — Four Open Items

Read-only investigation, 2026-06-11. Evidence gathered from code inspection (frozen files
read, never modified or executed) and read-only Prisma queries
(`probe-verification.ts` in this directory). No fixes were made anywhere.

---

## Item 1 — READY_TO_SHIP badge logic (run 25 anomaly)

### What computes the badge

The badge is **computed once at scoring time and persisted** to `ScoringRun.statusBadge`
(enum in `prisma/schema.prisma:44-48`). All display surfaces (`app/scorecard/[id]/ScorecardClient.tsx`,
history, dashboard, compare) read the stored value; nothing re-derives it at display time.

The decision rule lives in [lib/confidence/index.ts:83-98](../../../lib/confidence/index.ts):

```ts
export function statusBadge(memoConf: number, gaps: GapEntry[]): StatusBadge {
  const hasHighGap = gaps.some((g) => g.severity === "HIGH");
  if (memoConf < MAJOR_REWORK_THRESHOLD || hasHighGap) return "MAJOR_REWORK";
  if (memoConf >= READY_TO_SHIP_THRESHOLD && !hasHighGap) return "READY_TO_SHIP";
  return "NEEDS_WORK";
}
```
with `READY_TO_SHIP_THRESHOLD = 75`, `MAJOR_REWORK_THRESHOLD = 50` (lines 7-8).

The badge therefore has **two inputs**: Memo Confidence and the derived Gap list.
Gap severity is set in `deriveSpecificGap` ([lib/scoring/editGeneration.ts:51-54](../../../lib/scoring/editGeneration.ts)):

```ts
const score = dr.serverComputed ?? 0;
if (score >= 4.0) return null;
const severity: "HIGH" | "MEDIUM" | "LOW" = score <= 2 ? "HIGH" : "MEDIUM";
```

and gaps are derived only from Stage-1 pillars (`deriveGaps`, [inngest/functions/scoreMemo.ts:60-91](../../../inngest/functions/scoreMemo.ts):
skips D1–D5, skips `serverComputed === null`, skips scores ≥ 4.0). The call site is
scoreMemo.ts:305-310 (step `confidence-status`), persisted in step `persist`.

**Exact decision rule, in order:**
1. Any Stage-1 pillar with `serverComputed ≤ 2.0` produces a HIGH gap → **MAJOR_REWORK**, regardless of readiness.
2. Else `memoConfidence < 50` → **MAJOR_REWORK**.
3. Else `memoConfidence ≥ 75` → **READY_TO_SHIP**.
4. Else → **NEEDS_WORK**.

### Re-derivation table (stored values → rule output)

| runId | memo | memoConfidence | min Stage-1 pillar | stored HIGH gap? | stored badge | rule produces | match |
|---|---|---|---|---|---|---|---|
| 23 | Ecolab_Parallel_Gen.md | 82.437 | P1 = 2.00 | yes (P1) | MAJOR_REWORK | MAJOR_REWORK | ✅ |
| 24 | Zebra_Last_Gen.md | 73.278 | P1 = 2.00 | yes (P1) | MAJOR_REWORK | MAJOR_REWORK | ✅ |
| 25 | 2026-02-11_Daikin_Oxi_Corporate_1st_Gen.docx | 81.875 | P7 = 2.333 | no | READY_TO_SHIP | READY_TO_SHIP | ✅ |
| 26 | 25-12-06_Pasha_DCnt_1st_Gen.md | 64.945 | P1 = 2.00 | yes (P1) | MAJOR_REWORK | MAJOR_REWORK | ✅ |
| 27 | 2026-02-12_Daikin_Oxi_Corporate_Last_Gen.docx | 73.629 | P1 = 2.25 | no | NEEDS_WORK | NEEDS_WORK | ✅ |
| 41 | ecolab3.docx | 72.656 | P8 = 2.75 | no | NEEDS_WORK | NEEDS_WORK | ✅ |

**6/6 reproduce exactly.** No logic change since June 2 and no manual override path exists.

### Why run 25 beat run 23

The badge is **not monotonic in readiness**. Run 23's readiness (82.437) is higher than
run 25's (81.875), but run 23 has P1 = 2.00 ("6 major reconciliation failure(s)" per its
stored Gap row), which is ≤ 2.0 → HIGH gap → rule 1 fires → MAJOR_REWORK. Run 25's worst
pillar is P7 = 2.333 — **0.333 above the HIGH cutoff** — so its gaps are all MEDIUM
(stored: `P7:MEDIUM`, `P5:MEDIUM`), and with readiness ≥ 75 it lands READY_TO_SHIP.
A single pillar crossing 2.0 flips the badge across two categories; total readiness
contributes nothing to that trigger.

### Did the single-chapter parse help run 25?

Indeterminate — the evidence is mixed, two competing readings:

- **Plausibly yes:** run 25's memo (pre-docx-fix parse, `chapterCount = 1`) ran Tier-1 once
  over the whole text instead of per-chapter. P1's penalty inputs (reconciliation failures
  across sections) and several count-based sub-scores get fewer independent detection passes.
  Run 25 scored P1 = 4.00 while the three .md memos scored that session (runs 23, 24, 26)
  all scored P1 = 2.00.
- **Counter-evidence:** run 27 — the *other* Daikin docx, also a collapsed single-chapter
  parse, scored 11 minutes after run 25 — got P1 = 2.25 with "4 major reconciliation
  failure(s)". A collapsed parse demonstrably does not prevent coherence penalties.

What is certain: the badge itself was computed correctly from its stored inputs. Whether
those inputs were depressed by the parse can only be settled by re-scoring the memo
post-docx-fix (out of scope here; runs 39/40 — the .md re-uploads of the Daikin memos —
have no scoring runs yet).

### VERDICT (Item 1)
**No bug in badge computation — the stored badges are exactly what the current rule
produces (6/6).** The run 25 "anomaly" is the designed HIGH-gap override: any single
Stage-1 pillar ≤ 2.0 forces MAJOR_REWORK regardless of readiness, so badge ordering and
readiness ordering legitimately diverge. Whether run 25's collapsed docx parse inflated
its pillar inputs is **indeterminate** (mixed evidence above).

---

## Item 2 — Memo Readiness = Stage 1 only

### Code trace

The persisted value comes from `memoConfidence()` in
[lib/confidence/index.ts:19-30](../../../lib/confidence/index.ts), called in scoreMemo.ts:298-301
with **only** the eight Stage-1 scores:

```ts
/**
 * Memo Confidence = 100 − sum(erosion for each Stage-1 pillar score), clamp [0, 100].
 * Stage-2 scores are NOT included (they form a separate profile).
 * @param stage1Scores Array of 8 Stage-1 pillar scores (P1–P8).
 */
export function memoConfidence(stage1Scores: number[]): number {
```

Stage-2 scores go to `stage2Profile()` (lines 43-69, "Stage-2 profile — **separate from
Memo Confidence**") and to the persisted `stage2Avg` column. No Stage-2 weighting constant
exists anywhere in `lib/confidence/` or `lib/scoring/` — there is nothing "defined but
never applied." The observed identity `memoReadiness = stage1Avg × 20` is the algebraic
consequence of the formula: `100 − Σ(5−sᵢ)·2.5 = 2.5·Σsᵢ = 20·avg` (when no per-pillar
erosion hits its 10-point cap).

### Design-intent evidence

- **CLAUDE.md, non-negotiable rule 1:** "Stage 1 (Solution Validity, 8 pillars) and
  Stage 2 (Output Quality, 5 dimensions) are NEVER combined into one number."
- **Scoring guide UI** (`app/scoring-guide/page.tsx:337-339`): "The 13 dimensions split
  into two stages that are **deliberately never added into one number**."
- **Memo Readiness definition** (same page, lines 528-532): "100 minus everything the
  pillars eroded" — "pillars" being the Stage-1 term throughout the app.

### One contradicting UI string

`app/scoring-guide/page.tsx:309` ("The Scoring Journey", step 2):

> "The memo is scored across 13 dimensions. Each dimension produces a 1–5 score, which
> becomes an amount of readiness erosion. The erosions add up to the final Memo Readiness."

Read literally, this claims all 13 dimensions erode Memo Readiness. The code erodes from
8. This is a copywriting error in one sentence, contradicted by the same page's §"The Two
Stages" and §"The Two Readiness Numbers".

### VERDICT (Item 2)
**Intended design.** Evidence: the formula's own doc comment ("Stage-2 scores are NOT
included"), CLAUDE.md architecture rule 1, and the scoring guide's "deliberately never
added into one number." One UI sentence (scoring-guide step 2, line 309) misleadingly
implies otherwise and should be reworded — copy fix only, no engine change.

---

## Item 3 — June 10 zero-risk window (runs 44, 45, 46, 52–57)

### Storage shape (read-only queries)

`ConfirmedRisk` is a per-row table; "zero risks" means **zero rows at all** — not empty
JSON, not zero-count rows:

| run | scoredAt (UTC) | ConfirmedRisk rows | includeInAnalysis | dataNote |
|---|---|---|---|---|
| 43 (control) | Jun 8 19:47 | **5** (3 CRITICAL, 2 HIGH, all approved) | true | "Included. docx memo…" |
| 44 | Jun 10 09:17 | **0** | false | "Measurement run (post-model-pin) for noise-floor measurement; not part of the analysis set." |
| 45, 46 | Jun 10 09:27/09:29 | **0** | false | same noise-floor note |
| 52–56 | Jun 10 10:51–10:59 | **0** | false | "verification run" |
| 57 | Jun 10 13:50 | **0** | false | "verification run" |

### There is no risk-extraction step inside scoring

The scoring pipeline never extracts risks. Risks are identified **before** scoring at the
Risk Review Gate (`/api/risks/generate`, human approves/rejects in `app/score-memo/page.tsx`),
then passed into the job as `event.data.approvedRisks` (scoreMemo.ts:33-38, 106). The
persist step writes exactly one row per element of that array (scoreMemo.ts:497-515):

```ts
for (const risk of approvedRisks) {
  ...
  await tx.confirmedRisk.create({ ... })
}
```

An empty `approvedRisks: []` → the loop body never runs → zero rows. The only other
risk-related step, `check-critical-risks` (scoreMemo.ts:397-401), short-circuits:
`if (criticalApproved.length === 0) return []`. **No LLM error, empty response, or parse
failure can produce zero stored risks** — a failure in risk *generation* happens pre-scoring
in the UI and would have blocked submission, not written zeros.

### How these nine runs were invoked

The normal UI cannot send an empty array — `startScoring` is gated on
`riskCards.length === 5 && every(decided)` (`app/score-memo/page.tsx:365-379`) and always
sends all 5 cards. `/api/score/route.ts` accepts any array including `[]`
(`!Array.isArray(approvedRisks)` is the only check, line 27). So these runs were triggered
outside the UI flow — direct POST to `/api/score` (or direct Inngest event) with
`approvedRisks: []`. That matches their purpose: runs 44-46 are the noise-floor re-score
pairs hard-coded in `scripts/noise-floor.ts:12-16` (43→44, 42→45, 30→46), and 52-57 carry
the "verification run" label. All nine were excluded from the analysis set
(`includeInAnalysis = false`) at curation time.

### Inngest step history

Not retrievable: the Inngest dev server (port 8288) responds, but its run journal contains
**no runs for 2026-06-10** (queried via its GraphQL API) — the dev journal is ephemeral and
has been reset since. The verdict does not depend on it: the storage shape plus the persist
code path fully determine the outcome.

### VERDICT (Item 3)
**Deliberately bypassed — not a silent failure.** Risk extraction did not "fail"; it was
never invoked, because risk rows are a pure copy of the caller-supplied Risk-Gate output
and these nine measurement/verification runs were submitted with an empty `approvedRisks`
array, bypassing the gate (evidence: zero rows rather than failed/empty records, the
persist loop quoted above, UI gating that excludes this path, and the runs' own dataNote
labels). Caveat for Phase 3: on these runs, "0 critical risks" is **missing data, not a
measurement** — they must not enter any risk-related comparison.

---

## Item 4 — Run 26 stored P7 = −1.0

### What is stored (run 26, memo `25-12-06_Pasha_DCnt_1st_Gen.md`, scored Jun 2 14:46 UTC)

```
score: -1, serverComputed: -1, agentSelfReported: null, calibrationDrift: false
subScores: { "claimCount": 0 }
traceabilityLog.formula: "NOT SCORED — 0 financial claims"
traceabilityLog.sparse_data_protocol: "not-scored"
traceabilityLog.np_claims_count: 0, cc_records_count: 0, fic_tests: all "NA"
```

The LLM did **not** emit −1: Tier-3 returned `claim_count: 0` with coherent per-test
reasons ("No explicit revenue figure or margin figure found…"). Parsing succeeded.

### The responsible code path

1. **By design, P7 with 0 claims scores `null`** — [lib/scoring/stage1/p7.ts:10-11, 94-96](../../../lib/scoring/stage1/p7.ts):
   ```ts
   /** Sentinel score value for NOT_SCORED (sparse-data: 0 claims) */
   export const P7_NOT_SCORED = null;
   ...
   if (claimCount === 0) { protocol = "not-scored"; ori = null; }
   ```
2. **Validation exists but runs before the leak** — `verifyScoring`
   ([lib/scoring/verify.ts:176-183](../../../lib/scoring/verify.ts)) explicitly checks
   `claimCount === 0` → `serverComputed` must be null, and it *was* null at that point,
   so no diagnostic fired (run 26 has zero diagnostics). verify.ts has range/clamp checks
   only for P1 and P3 and never re-inspects persisted values.
3. **The persist step substitutes −1 for null** — [inngest/functions/scoreMemo.ts:487, 490](../../../inngest/functions/scoreMemo.ts):
   ```ts
   score: dr.score ?? -1,
   ...
   serverComputed: dr.serverComputed ?? -1,
   ```
   `DimensionScore.score`/`serverComputed` are non-nullable `Float` columns
   (schema.prisma:210, 213), so null cannot be stored; −1 is the chosen stand-in. There is
   no range validation between this substitution and the database.

### Side effect found while verifying: the not-scored pillar still eroded readiness

The confidence step uses a *different* coalescing — scoreMemo.ts:298:
```ts
const stage1Scores = stage1Results.map((dr) => dr.serverComputed ?? 1);
```
A not-scored P7 enters `memoConfidence` as a score of **1** (maximum erosion, 10 points).
Verified arithmetically against run 26's stored values: with P7→1 the formula reproduces
the stored `memoConfidence = 64.94485677636598` and `stage1Avg = 3.247242838818299`
exactly; with P7 excluded it would have been 74.945. So "not scored — insufficient data"
was silently converted into "worst possible score" for readiness purposes (it did not
change run 26's badge — its P1 = 2.00 HIGH gap forces MAJOR_REWORK regardless — but it
cost 10 readiness points). One inconsistency, three representations: null in the engine,
1 in the confidence math, −1 in the database.

### Blast radius

Full corpus scan (559 DimensionScore rows = 43 runs × 13 dimensions): **exactly one row**
outside [1, 5] — run 26 / P7 (`score = −1, serverComputed = −1`). No other dimension on
any run is out of range.

### Re-derivation hazard (noted, not fixed)

Any future re-derivation of gaps/badges from *stored* values would treat −1 as a real
score: `deriveSpecificGap` uses `score ≤ 2 → HIGH`, so run 26's P7 would suddenly produce
a HIGH gap that did not exist at scoring time (when the value was null and skipped).
Consumers of the Phase-1 dataset should treat `P7 = −1` as null.

### VERDICT (Item 4)
**Sentinel leak.** The −1 is not LLM-emitted and not a parse failure: the engine
deliberately scores 0-claim P7 as `null` (`P7_NOT_SCORED`, p7.ts:11), validation correctly
passes the null *before* persistence, and the persist step's `?? -1` (scoreMemo.ts:487,490)
writes the sentinel into a non-nullable column with no range check. Corpus-wide it is the
only out-of-range value. Secondary finding: the parallel `?? 1` in the confidence step
(scoreMemo.ts:298) silently maximally erodes readiness for a not-scored pillar — a design
question for Carson, not an obvious coding slip.

---

## Follow-up fix tasks implied by the evidence (descriptions only)

1. **Scoring-guide copy fix** (Item 2): reword `app/scoring-guide/page.tsx:309` so it does
   not claim all 13 dimensions feed Memo Readiness.
2. **P7 not-scored representation** (Item 4): make `DimensionScore.score`/`serverComputed`
   nullable (or add an explicit `notScored` flag) so null survives persistence; remove the
   `?? -1`. Requires a schema migration and a backfill decision for run 26.
3. **Not-scored pillar vs readiness** (Item 4, design decision for Carson): decide whether
   a 0-claim P7 should erode readiness as score 1 (current behavior), be excluded from the
   erosion sum, or use the neutral-3 convention (`npClaimScore` already returns 3 for
   "no claims" in thresholds.ts:154). Document the choice wherever it lands.
4. **Guard `/api/score` against empty risk arrays** (Item 3): either reject
   `approvedRisks.length === 0` or stamp such runs (e.g. `dataNote`/flag) at creation time
   so bypass runs are self-labeling instead of relying on after-the-fact curation.
5. **(Optional, Item 1)** If badge/readiness divergence keeps surprising reviewers, surface
   the HIGH-gap trigger on the scorecard ("MAJOR_REWORK forced by P1 ≤ 2.0") — display
   change only; the rule itself reproduced 6/6.

## Checklist

- [x] `git status` clean outside `scripts/experiment-extraction/verification/`
- [x] No Prisma write operations in any script written for this task (`probe-verification.ts` greps clean: findUnique/findMany/findFirst only)
- [x] No file under `lib/scoring/`, `lib/prompts/`, or `inngest/functions/` modified
- [x] Four explicit verdicts: Item 1 — no bug (rule reproduces 6/6; parse-effect indeterminate); Item 2 — intended design; Item 3 — deliberately bypassed; Item 4 — sentinel leak
- [x] Dev app responding normally on port 3000
