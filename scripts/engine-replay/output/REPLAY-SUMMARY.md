# C0 Replay Summary — V3 v1.1 candidate rules vs stored V3 v1.0 corpus

READ-ONLY replay over 43 stored runs; formulas implemented inline (the
engine is unchanged — that is the point of the checkpoint). New-rule readiness and
badges are reported under BOTH candidate C1 variants (see Deviations §1).

## 1. P1 changes under the graduated penalty (C2)

34 runs change, all downward, all with ≥3 major failures:

- run 15 (LGIT MedTech Market Entry_LastGen.md): majors=8, P1 2 -> 1 (Δ -1)
- run 23 (Ecolab_Parallel_Gen.md): majors=6, P1 2 -> 1 (Δ -1)
- run 24 (Zebra_Last_Gen.md): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 26 (25-12-06_Pasha_DCnt_1st_Gen.md): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 27 (2026-02-12_Daikin_Oxi_Corporate_Last_Gen.docx): majors=4, P1 2.25 -> 1.75 (Δ -0.5)
- run 28 (Ecolab_Parallel_Gen.md): majors=5, P1 2 -> 1.25 (Δ -0.75)
- run 29 (Ecolab_Parallel_Gen.md): majors=5, P1 2 -> 1.25 (Δ -0.75)
- run 30 (Visiomex_1st_Gen.md): majors=4, P1 2 -> 1.5 (Δ -0.5)
- run 31 (26-01-09-Pasha_DC_Last_Gen.md): majors=6, P1 2 -> 1 (Δ -1)
- run 32 (LGIT MedTech Market Entry_LastGen.md): majors=7, P1 2 -> 1 (Δ -1)
- run 33 (LG_Parallel_Gen.md): majors=4, P1 2 -> 1.5 (Δ -0.5)
- run 34 (Daikin_Last_Gen_docx_refix): majors=9, P1 2 -> 1 (Δ -1)
- run 35 (26-01-09-Pasha_DC_Last_Gen.md): majors=11, P1 2 -> 1 (Δ -1)
- run 36 (NEE New York Storage Market Entry_LastGen.md): majors=7, P1 2 -> 1 (Δ -1)
- run 37 (samsung_Final.md.docx): majors=9, P1 2 -> 1 (Δ -1)
- run 38 (MN_4_1.docx): majors=14, P1 2 -> 1 (Δ -1)
- run 39 (Zebra final.md): majors=5, P1 2 -> 1.25 (Δ -0.75)
- run 42 (ecolab2.docx): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 43 (ecolab1.docx): majors=4, P1 2 -> 1.5 (Δ -0.5)
- run 44 (ecolab1.docx): majors=4, P1 2 -> 1.5 (Δ -0.5)
- run 45 (ecolab2.docx): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 46 (Visiomex_1st_Gen.md): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 47 (samsung_entry.docx): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 51 (Samsungv5.docx): majors=4, P1 2 -> 1.5 (Δ -0.5)
- run 52 (ecolab1.docx): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 53 (ecolab2.docx): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 54 (ecolab1.docx): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 56 (Visiomex_1st_Gen.md): majors=3, P1 2 -> 1.75 (Δ -0.25)
- run 57 (ecolab1.docx): majors=5, P1 2 -> 1.25 (Δ -0.75)
- run 58 (Zebrav5.docx): majors=4, P1 2 -> 1.5 (Δ -0.5)
- run 59 (sumitomo_06_09.docx): majors=5, P1 2 -> 1.25 (Δ -0.75)
- run 62 (NEEv5.docx): majors=4, P1 2 -> 1.5 (Δ -0.5)
- run 63 (Reckitt EU Vitamin Gummy.md): majors=5, P1 2 -> 1.25 (Δ -0.75)
- run 64 (US Vitamin Gummy Market.md): majors=15, P1 2 -> 1 (Δ -1)

Runs with majors ≤ 2 are unchanged (cliff preserved: 2 failures still → penalty 2.0).

## 2. Readiness delta distribution (simple-exclusion variant, new P1)

| Δ readiness | runs |
|---|---|
| -2.5 | 10 |
| -1.87 | 6 |
| -1.25 | 8 |
| -0.62 | 9 |
| 0 | 9 |
| 9.38 | 1 |

(Δ = new − stored. Negative deltas are the graduated P1 penalty translating to
readiness; the only run whose Stage-1 vector composition changes is run 26 — P7
null since Phase B1.)

## 3. Badge flips (stored → new)

- run 25 (2026-02-11_Daikin_Oxi_Corporate_1st_Gen.docx): READY_TO_SHIP -> NEEDS_WORK — Stage-2 floor: D1 <= 2.0 [simple-exclusion variant]
- run 27 (2026-02-12_Daikin_Oxi_Corporate_Last_Gen.docx): NEEDS_WORK -> MAJOR_REWORK — Stage-1 HIGH gap (pillar <= 2.0) [simple-exclusion variant]

D dimensions ≤ 2.0 by run (floor candidates): run 25 [D1] (stored: READY_TO_SHIP); run 27 [D1] (stored: NEEDS_WORK)

## 4. Expected-result checks (checkpoint-approved values)

| Expectation | Result |
|---|---|
| P1 changes only for ≥3 majors, only downward | ✅ holds |
| Run 26 ≈ 70.65 rescaled, P1 2.0 → 1.75 (stored 64.94 untouched) | ✅ holds |
| Exactly two flips: run 25 → NEEDS_WORK (D1 floor); run 27 → MAJOR_REWORK (graduated P1 crosses HIGH-gap threshold) | ✅ holds |
| No run gains a better badge | ✅ holds |
| No other badge moves | ✅ holds |

## 5. Deviations (stop-and-report)

none — results match the checkpoint-approved report.

### Run 26 readiness decomposition (for the record)

| Variant | Readiness |
|---|---|
| stored (v1.0: P7 treated as 1) — never rewritten | 64.94 |
| **APPROVED v1.1: new P1 (1.75) + rescaled exclusion** | **70.65** |
| new P1 + simple exclusion (rejected at checkpoint) | 74.32 |
| old P1 + rescaled / old P1 + simple (informational) | 71.37 / 74.94 |

Rescaled exclusion was approved at the checkpoint: simple exclusion would let an
unscored pillar contribute zero erosion — an implicit perfect 5 and a sparse-data
gaming vector. The badge outcome is identical under both variants for every run.

## 6. Tension-bonus audit (report only)

Stored `subScores.bonus` distribution: 0.5 → 43 runs.

Code: `lib/scoring/stage1/p1.ts` (computeP1) —
```ts
const tensionAcknowledged =
  tier2.p1_tension_acknowledged != null ||
  tier1Chapters.some((c) => c.tension_acknowledged != null);
...
const bonus = tensionAcknowledged ? 0.5 : 0;
```
Why 0.5 on all 43/43 runs: the bonus fires if the cross-chapter synthesis OR
**any single chapter** returns a non-null `tension_acknowledged` string. On a real
multi-chapter memo the agent essentially always finds at least one acknowledged
tension somewhere (any hedged trade-off sentence qualifies), so the OR across
~5–22 chapters saturates. The bonus is therefore a constant +0.5 offset in
practice, not a discriminating signal. No change in this phase.

## 7. Minor-cap audit (report only)

Cap hit (`minor_cap_applied = true`) on **42/43** runs. Raw vs capped
penalty per run is in replay-report.csv (`minorCombinedRaw` vs
`minorCombinedPenalty`; cap = 1.5). Raw range: 1.25 – 15.25.
Every run's combined minor/reasoning penalty saturates the 1.5 cap, i.e. the three
minor categories currently contribute a near-constant −1.5. Recalibration deferred
to Phase D where thresholds move together.

---
**CHECKPOINT: awaiting Carson's approval before any C1–C4 implementation.**
