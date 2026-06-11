# Engine Reopen Phase D — Gate Hardening & Decision Support Report

Date: 2026-06-11. Prerequisite verified: V3 v1.1 live, replay matched (Phase C).
D1 from the master plan (Stage 2 floor) shipped as C4. This phase: three
implementation commits (D2a `8b238db`, D2b `ba25de9`, D3 `a3b5d0f`) and two
recorded deferrals.

## D2a — Explicit ship rule

`deriveGaps` (extracted to `lib/scoring/gaps.ts` for testability) now contains
an explicit trigger: a P1 result with `majorReconciliations ≥ 2` produces a
HIGH gap regardless of CI, with issue text naming the count ("ship rule: N
major reconciliation failures — memos ship at ≤ 1"). The rule no longer
depends on the minor channel's cap binding.

**Replay check (quoted, executed before commit** — `scripts/engine-replay/d2a-check.ts`,
real engine functions over all 43 stored runs under v1.1 values**):**

> Runs with majors >= 2: 40; all with v1.1 CI <= 2.0: true
> Badge changes from the explicit trigger: **0**

Zero impact corpus-wide → ships under the existing "V3 v1.1" stamp as pure
robustness for future runs, per the task's gate. Unit tests: f = 1 never trips
the trigger (severity stays CI-driven); f = 2 at an artificially high CI (4.5)
fires HIGH despite the score ≥ 4.0 skip; null-P1 guard intact; Stage-2
dimensions unaffected.

## D2b — Minor/reasoning channel visibility

P1 breakdown now shows, beneath the A2 conflict count:
"Minor gaps: N · Reasoning gaps: M (raw penalty X.XX, capped at 1.5)" — from
the persisted traceability log only (definitional drifts appear when nonzero;
"under the 1.5 cap" when the cap did not bind). No math changes. Verified:
run 35 → 17 / 42, raw 15.25, capped; run 27 → 1 / 4, raw 1.25, the uncapped run.
This is the free data-accumulation surface for the calibration track.

## D3 — k-run verification scoring

- **Flow:** scorecard overflow menu → "Verify score (3 runs)…" → confirmation
  modal stating the token cost explicitly (~2 full pipelines, cannot be
  un-spent) → POST `/api/verify-score` queues two `memo/score.requested`
  events with the anchor's Risk Gate decisions carried over verbatim
  (gate-bypass anchors carry `allowEmptyRisks`, so re-scores self-label).
- **Storage:** additive `ScoringRun.verificationGroupId` (anchor run id) on the
  NEW runs only — the anchor row is never modified; group membership is id
  equality. No stored score is averaged into any single run's record.
- **Display:** an aggregate strip on every scorecard in a group of ≥ 2:
  per-run readiness + badge, mean, spread (max − min), and a worst-of-group
  consensus badge (conservative by design). The C3 findings cache pins P1
  across the group, so the spread is the honest noise figure for the other
  pillars.
- **Guards verified live:** 404 unknown run; 400 anchor without a durable
  framing link (pre-2026-06-10 runs); 400 when invoked on a verification run
  instead of its anchor.
- **Tested:** `aggregateVerification` unit-tested (mean/spread/worst-of-three,
  MAJOR_REWORK dominance, single-run groups, empty-group throw). **The live
  end-to-end test costs real tokens and is explicitly Phase E's first action**
  — fire it on a post-v1.1 run with a durable framing link (e.g. any new
  scoring run; among stored runs only run 57 qualifies).

## Recorded deferrals

1. **Threshold recalibration (75/50, the 2.0 cutoff) → Phase E.** Under v1.1
   every corpus run above 75 readiness is P1-blocked, so the READY threshold
   currently decides nothing; tuning it against a corpus with zero valid
   shippable memos is calibration against noise. Revisit with Daikin v12 and
   the reference re-scores on the board.
2. **Minor-cap recalibration and tension-bonus redesign → calibration track.**
   The cap change is offline-replayable but must move together with the
   thresholds above. The tension fix (granting the bonus only for
   cross-chapter synthesis acknowledgment rather than the any-chapter OR that
   saturates it at +0.5 on 43/43 runs) cannot be simulated: per-source
   booleans are not persisted — it needs live scoring with an eval harness.
   D2b keeps the channel visible in the meantime.

## Verification checklist

- [x] D2a replay check executed and quoted above: **zero** badge changes across the 43-run corpus
- [x] D2a unit tests: f = 1 no forced HIGH; f = 2 at artificially high CI → HIGH fires (76→82-test suite green overall)
- [x] D2b verified on run 35 (17/42, raw 15.25, capped) and run 27 (1/4, raw 1.25, uncapped)
- [x] D3 aggregation unit-tested; token-cost confirmation present; live test deferred to Phase E (first action)
- [x] No stored row modified — all five table checksums identical to the pre-Phase-C baseline (dimensionScore `d2988613…`, gap, edit, confirmedRisk, scoringRunCore all unchanged); tsc clean; 82/82 tests; dev app healthy and scorecards rendering
