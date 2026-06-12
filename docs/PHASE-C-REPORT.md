# Engine Reopen Phase C — V3 v1.1 Version Bump Report

Date: 2026-06-11. Checkpoint passed before implementation (C0 delivered; Carson
approved rescaled exclusion and the run 27 badge flip). Five commits: C1, C2,
C3, C4, C5 (version bump + harness re-run + this report). All of C1–C4 ship
together as one comparability break; historical runs keep their stored values
and "V3 v1.0" label — nothing was rewritten (checksums below).

## What changed (V3 v1.1)

| Task | Change | Where |
|---|---|---|
| C1 | Not-scored pillars excluded from readiness via **rescaling**: 100 − (8/scoredCount) × Σ erosion (≡ 20 × mean of scored pillars); throws on zero scored; `stage1Avg` over scored pillars with additive `ScoringRun.scoredPillarCount` | lib/confidence/index.ts, scoreMemo confidence step, schema |
| C2 | Graduated major-reconciliation penalty: 0 → 0; 1 → 1.0; f ≥ 2 → min(3.5, 2 + 0.25 × (f − 2)). Cliff at 2 preserved; traceability formula string updated; minor cap + tension bonus untouched (Phase D) | lib/scoring/stage1/p1.ts |
| C3 | P1 findings cache keyed sha256(rubricVersion + framing + memo); hit substitutes only the cached P1 detection into fresh Tier outputs; miss behaves exactly as today and stores; hit/miss + key prefix stamped in P1 traceabilityLog | P1FindingsCache table, lib/scoring/p1Cache.ts, scoreMemo steps 4b/5b |
| C4 | Stage-2 floor in the ship gate: would-be READY_TO_SHIP with any D ≤ 2.0 → NEEDS_WORK; MAJOR_REWORK semantics unchanged; badge hint "Held at NEEDS_WORK by {dim} ≤ 2.0" | lib/confidence/index.ts statusBadge, scoreMemo, ScorecardClient |
| Version | `RUBRIC_VERSION = "V3 v1.1"` (lib/scoring/version.ts, with history note); persist stamp switched from the hardcoded literal; version label already visible on the scorecard (run-meta line + Rubric version card) and as a History filter | lib/scoring/version.ts, scoreMemo persist |

## Replay harness re-run (real functions)

`scripts/engine-replay/replay.ts` now imports the implemented engine —
`computeP1` (Tier inputs reconstructed from the stored counts), `memoConfidence`,
`statusBadge` — instead of inline reimplementations. Result:

- **replay-report.csv is byte-identical to the checkpoint-approved
  `approved-replay-report.csv`** (kept in the same directory).
- **0 deviations** against the approved expected results:
  - 34 runs change P1, all downward, all with ≥ 3 major failures (cliff intact).
  - Run 26: P1 2.0 → 1.75, recomputed readiness **70.65** (rescaled exclusion);
    stored 64.94 untouched.
  - Exactly two badge flips: run 25 READY_TO_SHIP → NEEDS_WORK (D1 = 1.8 floor)
    and run 27 NEEDS_WORK → MAJOR_REWORK (4-failure P1 2.25 → 1.75 crosses the
    HIGH-gap threshold — the approved leniency-hole closure). No run improves;
    nothing else moves.
- Audits (report-only): tension bonus 0.5 on 43/43 (the per-chapter OR
  saturates — code quoted in REPLAY-SUMMARY.md); minor cap binds on **42/43**
  (raw 1.75–11.5 vs cap 1.5) — deferred to Phase D.

## Verification checklist

- [x] C0 delivered and approved before any C1–C4 code (checkpoint 2026-06-11)
- [x] Unit tests (70/70 green):
  - `memoConfidence` with nulls — pins run 26's vector at **71.366** (stored P1)
    and **70.651** (graduated P1, the approved C0 value). *Note: the checklist
    text still said "reproduces 74.94", which is the simple-exclusion figure
    rejected at the checkpoint; the tests pin the approved rescaling semantics
    instead.*
  - `gradedMajorPenalty` at f = 0, 1, 2, 3, 6, 15 → 0, 1.0, 2.0, 2.25, 3.0, 3.5
  - `statusBadge` D-floor: run 25's vector → NEEDS_WORK; run 41's → unchanged;
    boundary at exactly 2.0; null-D immunity; MAJOR_REWORK invariance;
    two-arg (v1.0) compatibility
- [x] Replay re-run with real imports matches the approved report **exactly** (byte-identical CSV)
- [x] No stored historical row modified — all five table checksums identical before/after the phase
- [x] New runs stamp "V3 v1.1": persist reads the single `RUBRIC_VERSION` constant. Cache determinism "hash a fixture twice" verified in `p1Cache.test.ts`; the live hit path additionally guards chapter-count mismatch (degrades to miss). *A full end-to-end cache hit requires an actual LLM scoring run, which this phase does not perform; the first production re-score of an already-scored memo will exercise it, visible via `p1_findings_cache: "hit"` in P1's traceability.*
- [x] TypeScript clean; dev app healthy (one stale-`.next` webpack cache cleared after the repeated Prisma regenerations — standard dev-cache reset, no code issue); scorecards 23/25/26 render their stored values and historical "V3 v1.0" label identically to the pre-Phase-A capture

## CLAUDE.md rule update (quoted per C4)

Rule 1 now reads:

> Stage 1 (Solution Validity, 8 pillars) and Stage 2 (Output Quality, 5
> dimensions) are NEVER combined into one number. They are reported separately.
> The ship gate may consult BOTH profiles (since V3 v1.1 a Stage 2 dimension
> ≤ 2.0 holds a would-be Ready-to-Ship at Needs Work) — that is a gate
> condition, not a combination; no formula ever merges the two scores into one
> number.

Rule 2 gained: "…rescaled over the scored pillars when a pillar is not-scored
(V3 v1.1 — an unscored pillar neither erodes nor counts as a perfect 5)."

## Notes for what's next

- Phase D inherits the two audited constants: the saturated tension bonus
  (+0.5 on 43/43) and the minor-cap saturation (42/43) — both reported, neither
  touched here.
- The first v1.1 scoring run will also populate `scoredPillarCount`,
  `scorableChapterCount` (A5), and P1 `findings` (B2) — all additive.
- Cross-version dashboards: stored v1.0 runs and new v1.1 runs are not
  comparable on absolute scores; the History version filter and ELO remain the
  cross-version-safe views.
