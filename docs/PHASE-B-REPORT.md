# Engine Reopen Phase B — Persistence Report

Date: 2026-06-11. Two commits (B1, B2). No scoring formula, penalty value,
threshold, or LLM prompt changed. Acceptance: byte-identical scores everywhere
except run 26's P7 *representation* — verified below.

## B1 — Nullable scores, sentinel removed

- `DimensionScore.score` and `serverComputed` are now `Float?` (additive/relaxing
  schema change, `prisma db push` applied, dev server restarted).
- The `?? -1` substitutions in the scoreMemo persist step are removed; a
  NOT_SCORED engine result (`null`) now persists as `null`. Grep confirms no
  `?? -1` remains in app/lib/inngest code (only explanatory comments).
- The `?? 1` coalescing in the confidence step (scoreMemo.ts, step
  `confidence-status`) is deliberately untouched — scoring math, Phase C1.

### Authorized backfill (exactly one row)

```
BEFORE: {"id":332,"scoringRunId":26,"dimensionKey":"P7","score":-1,"serverComputed":-1,"agentSelfReported":null,"calibrationDrift":false}
AFTER:  {"id":332,"scoringRunId":26,"dimensionKey":"P7","score":null,"serverComputed":null,"agentSelfReported":null,"calibrationDrift":false}
```

Run 26's `memoConfidence` (64.94485677636598), `stage1Avg` (3.247242838818299)
and badge (MAJOR_REWORK) were not touched — historical readiness stays as
scored. Script: `scripts/backfill-run26-p7-null.ts` (idempotent; refuses to run
unless the row still holds −1/−1).

### Byte-identity proof

Full-table MD5 over all 559 DimensionScore rows, with row 332's score fields
restored to −1/−1, equals the pre-phase hash exactly:
`21af750d4a471351f0858b3345720d9e` — i.e. **558 rows byte-identical, row 332
changed only in the two authorized fields.** Gap (188), Edit (416),
ConfirmedRisk (168), and ScoringRun core-field hashes are unchanged.

### Null-consumer audit (how each renders null)

| Consumer | Location | Null behavior |
|---|---|---|
| Stage matrix pillar rows | ScorecardClient `StageMatrix` | "Not scored", gray empty bar |
| Chip strip (13 dimensions) | `ChipStrip` / `chipStyle` | "Not scored", gray chip |
| Breakdown row header | `BreakdownRow` | "Not scored" in place of the number |
| Breakdown "What this score means" | `BreakdownRow` | dedicated "Not scored — insufficient input data" copy |
| Calibration-drift line | `BreakdownRow` | `server=Not scored` (defensive; can't co-occur with drift flag) |
| Explanation tab (narrative + erosion ranking) | `generateExplanation`, `ExplanationTab` | null pillars excluded from erosion narrative/ranking; Stage 2 profile averages non-null only |
| Recovery tab | `computeRecovery` | null pillars excluded (no claimable headroom) |
| Scorecard CSV export | `OverflowMenu` export | "Not scored" cell |
| Gaps tab synthetic gaps | `GapsTab` filter + `deriveGapFromTrace` | **explicit null guard** — without it JS coerces `null < 4` → true and `null <= 2` → HIGH, fabricating a phantom HIGH gap; null now produces no gap |
| A2 conflict count | `p1ConflictCount` / `P1Trace` | reads `subScores`, independent of score nullability — a null-score row with subScores still shows the count; a fully null row shows a dash (run 26 verified: count renders "3") |
| A3 badge hint | `majorReworkHint` | derives from stored Gap rows only — inherently null-safe; run 26 post-backfill shows "Forced by P1 ≤ 2.0", **no phantom P7** |
| Compare view | `app/compare/page.tsx` | was already null-propagating; cells now read "Not scored" |
| History page | reads `memoConfidence`/`subScores` only | unaffected |
| Dashboard | reads `memoConfidence` only | unaffected |
| Engine: `deriveGaps` / generate-edits step | scoreMemo.ts | already filtered `serverComputed === null` before calling `deriveSpecificGap` (its internal `?? 0` is unreachable with null; left as-is — frozen scoring file) |
| `verifyScoring` | lib/scoring/verify.ts | already null-aware (expects null for 0-claim P7) |
| `scripts/noise-floor.ts` | dimension delta map | null scores skipped → print as "n/a" |

Run 26 renders P7 "Not scored" in the stage matrix and chip strip (2
occurrences in server HTML); no `score: -1` appears anywhere in the payload.

## B2 — Reconciliation detail persisted

- **Storage decision: nullable `findings Json?` column on DimensionScore**, not
  a dedicated table. Justification: findings are written once at scoring time,
  read only with their parent row (scorecard breakdown), never queried across
  runs by themselves; entries are sentence-length quote pairs, so 50 entries ≈
  25–40 KB worst case — comfortably inside Postgres JSONB norms and far below
  TOAST limits. A join table would add migration and query surface for no
  access-pattern benefit. Revisit only if cross-run finding queries become a
  Phase 2-style analysis need (the JSON is still queryable with JSONB operators).
- `computeP1` count computation is character-identical; a new `collectFindings`
  pass reads the same arrays and emits
  `{ version: 1, totalFound, truncated, entries[≤50] }`, ordered
  most-severe-first (flat contradictions → major reconciliations → minor
  reconciliations) so the cap drops the least important detail. Reasoning gaps
  and definitional drifts are not quote-pair findings and stay count-only, as
  before. Cross-chapter minor gaps are plain strings in the agent schema (no
  quotes to preserve) and also stay count-only.
- Persist step writes `findings` for any dimension result that carries it (P1
  only today); all other dimensions and all 559 existing rows hold null —
  verified: 0 rows with non-null findings, and the table minus the new column
  hashes identically to the post-B1 state (`3d87ec292c2819a58ab6b8ea708d9cbc`).
- Display: the P1 breakdown trace lists each persisted finding as
  "Conflict (kind): 'quoteA' vs 'quoteB' (locations)" beneath the A2 conflict
  count, with a "showing first N" marker when truncated. Older runs (findings
  null) show the count alone — verified on runs 23/26/41.

### computeP1 fixture verification

`lib/scoring/__tests__/p1-fixtures.test.ts` — expected values are the stored
database outputs of three runs, reconstructed from persisted subScores:

| Fixture | Inputs (flat/major/minor/drift/reasoning/tension) | Expected → got |
|---|---|---|
| Run 23 | 0 / 6 / 6 / 0 / 19 / yes | CI 2, penalties 3.5, majorPenalty 2, minorCombined 1.5, bonus 0.5 ✅ |
| Run 38 | 0 / 14 / 13 / 3 / 27 / yes | CI 2, penalties 3.5 ✅ |
| Run 41 | 0 / 1 / 9 / 0 / 10 / yes | CI 3, penalties 2.5, majorPenalty 1 ✅ |

Plus: findings pass-through verbatim, 50-entry cap with truncation marker
(score unchanged at 60 majors), severity-first ordering. Full suite: 45/45
tests pass; `tsc --noEmit` clean.

## Checklist

- [x] Schema migrated (two `db push` runs); dev app restarted and serving; TypeScript clean
- [x] 559 rows byte-identical except run 26 P7 (hash-restoration proof above)
- [x] Run 26 renders P7 "Not scored"; readiness 64.9 and MAJOR_REWORK badge unchanged vs pre-phase capture
- [x] No phantom HIGH gap from null anywhere (Gaps-tab guard + A3 hint re-verified on run 26)
- [x] computeP1 fixtures identical to stored outputs (runs 23/38/41)
- [x] `?? -1` absent from the persist path (grep)
- [x] Consumer audit table above
