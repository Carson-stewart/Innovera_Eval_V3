# Sanity Checker v1.2 Upgrades — Token-Free Validation Report

Date: 2026-06-11. Zero LLM calls fired (credit probe before/after: usage
430.61116482 → 430.61116482, unchanged). Architecture notes: `docs/SANITY-CHECKER-NOTES.md`.

## What shipped

| Piece | Where |
|---|---|
| T1 stage 1 — quantity extraction, normalization, candidate pairing, non-candidate rules | `lib/framing/quantities.ts` (pure, no LLM import — test-asserted) |
| T1 orchestration — injectable stage-2 adjudicator, D18 result construction | `lib/framing/singleSource.ts` (never imports the LLM client) |
| T1 stage 2 — runtime adjudicator on the checker's existing `callModelJSON` pattern | `inngest/functions/sanityCheck.ts` step `pass5-single-source` |
| D18 check (Critical, HIGH fidelity, empirically calibrated, run-64 evidenceDetail) | `lib/framing/checks.ts` — additive; in `ALL_CHECKS`/`CHECKS_BY_ID`, deliberately NOT in `CHECKS_BY_CATEGORY` so the 48-check category prompts stay byte-identical |
| P31 "Dual Target" pattern with the run-64 empirical basis | `lib/framing/patterns.ts` — additive |
| T2 anchor inventory (per-statement counts, machine-readable) | `quantities.ts` `buildAnchorInventory` + step `anchor-inventory`; persisted as `SanityCheck.anchorInventory Json?`; repetition warnings appended to the result summary |
| T3 gate verdict (BLOCKED / PASS_WITH_WARNINGS / PASS) + `GATE_MODE` | `lib/framing/gate.ts` (pure), `lib/framing/version.ts` (`CHECKER_VERSION = "v1.2"`, `GATE_MODE = "advisory"`); persisted as `SanityCheck.gateVerdict`/`checkerVersion` |
| Scoring-flow chip + lookup API | `GET /api/framing-gate`, chip in `app/score-memo/page.tsx` step 1; enforced-mode guard wired in `POST /api/score` behind the flag (shipped advisory) |

Schema: three additive nullable columns on SanityCheck (`checkerVersion`,
`gateVerdict`, `anchorInventory`), applied via `npm run db:sync`. All 17 existing
SanityCheck rows verified untouched (checkerVersion null on every one).

## Ground-truth results (stage 2 mocked; vitest 97/97 green)

1. **Run 64 (Reckitt US) — non-negotiable:** stage 1 emits the
   "$150-200M/year" vs "$240–300M" candidate pair (unit class money:USD, shared
   signal `noun:revenue`); with the mock affirming exactly that pair, D18 fires
   Critical and `computeGateVerdict` returns **BLOCKED**. ✅
2. **Run 58 (Zebra):** anchor inventory lists $500M with **count = 8**
   (distinct statements; the framing has 10 raw tokens across 8 statements —
   counting semantics documented in the notes) and trips the repetition warning
   → PASS_WITH_WARNINGS when nothing Critical fails. ✅
3. **Run 60 (NEE) — false-positive control:** stage 1 emits **zero candidate
   pairs** (nothing for a human to review — its repeated "5 MW" is equal-valued
   and equal values never pair); D18 passes. ✅
4. **Synthetic non-candidates:** single range = one value; scenario-labeled
   variants excluded; time-distinguished values excluded; cross-currency never
   pairs; positive-control unlabeled dual target IS paired. ✅

Gate tests: Critical → BLOCKED; Structural/anchor-warnings → PASS_WITH_WARNINGS;
advisory mode never blocks; enforced blocks BLOCKED and not-run, allows
PASS/PASS_WITH_WARNINGS. The `/api/score` enforced branch is wired behind
`GATE_MODE` (a compile-time constant currently "advisory") — flipping it is the
documented one-line change.

## Stage-1 candidate counts (LLM adjudication cost preview for the live run)

| Framing (run) | Stage-1 candidates | Repeated anchors |
|---|---|---|
| 57 (Ecolab Vision AI) | 9 | 3 |
| 58 (Zebra) | 2 | 2 |
| 59 (Sumitomo) | 0 | 1 |
| 60 (NEE) | 0 | 1 |
| 61 (NEE dup) | 0 | 1 |
| 62 (NEE dup) | 0 | 1 |
| 63 (Reckitt EU) | 28 | 1 |
| 64 (Reckitt US) | 37 | 0 |

Total: **76 short adjudication calls** to validate all 8 framings live — small,
single-pair prompts (not full-document passes). Runs 63/64 dominate; if cost
matters, batch adjudication (N pairs per call) is a straightforward follow-up.

## Deviations / honest caveats

- **Chip visual states:** the "not run" branch is verified live
  (`GET /api/framing-gate?framingId=36` → not-run; page renders 200). The
  linked-PASS and linked-BLOCKED visuals require a SanityCheck row with a v1.2
  `gateVerdict`, which only a live checker run can create (DB writes outside
  the pipelines are prohibited here). The branch logic is trivial JSX over the
  unit-tested verdict values; full visual confirmation lands with the deferred
  live validation. Pre-v1.2 results (gateVerdict null) deliberately render as
  "not run" under the current checker.
- **D18 ID:** "next free ID" was ambiguous across categories; D18 was chosen
  because Category A is advisory-only by invariant and "one quantity, one
  value" is Rule Compliance. Recorded in the notes.
- **`db:sync` flow** restarted the dev server per the dev-stack rules; stack
  health green after.

## Deferred (post-limit queue, alongside E1)

Live end-to-end checker runs on all 8 framings with real stage-2 adjudication
(~76 calls + the 5 standard passes per framing); compare against the fixture
expectations; measure the false-positive rate before any conversation about
flipping `GATE_MODE` to "enforced".
