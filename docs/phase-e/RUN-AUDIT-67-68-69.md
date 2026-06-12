# Run Audit — Twins (Runs #67, #68, #69)

**Read-only audit, 2026-06-12.** Sources: Prisma reads, Inngest dev-server journal
(REST `/v1/events` + GraphQL `/v0/gql` run traces), file reads of the two memo .md
files. No re-fires, no backfills, no cache writes, no restarts. Audit scripts:
`scripts/phase-e/audit-67-68-69.ts`, `scripts/phase-e/audit-framing-versions.ts`.

**Headline:** all three pipelines completed with zero retries; every stored score
recomputes exactly; the twin inputs are byte-identical and the P1 cache pinned P1
across the pair. The 5.87-point spread is carried entirely by P4 (+2.33), P8 (+1.88)
and P5 (+1.67) — correlated same-direction wobble on the three subjective pillars,
each within known per-pillar noise. One defect found: **run #69 repeats run #66's
silent `edits = 0`** (journal-proven LLM-shape failure, display-only, not a score
input).

---

## A — Pipeline completeness

| | #67 | #68 | #69 |
|---|---|---|---|
| Memo row | #43 G_Parallel | #44 G_Parallel | #45 Parallel_O |
| Inngest run | 01KTY57BSC… **Completed** | 01KTY5NMWM… **Completed** | 01KTY5NXP5… **Completed** |
| Started → ended (UTC) | 14:54:21 → 15:03:50 (9m29s) | 15:02:09 → 15:11:10 (9m01s) | 15:02:18 → 15:12:19 (10m01s; ~93s queued behind the concurrency-2 cap until #67 finished) |
| rubricVersion / model | V3 v1.1 / pinned snapshot | V3 v1.1 / pinned snapshot | V3 v1.1 / pinned snapshot |
| Steps (22–23 spans) | all COMPLETED, **attempts = 0** | all COMPLETED, **attempts = 0** | all COMPLETED, **attempts = 0** |
| Tier-1 / Tier-2 / Tier-3 | 12 chapters ✓ / 59.5s ✓ / 101.4s ✓ | 12 ✓ / 57.6s ✓ / 93.1s ✓ | 12 ✓ / 64.4s ✓ / 35.7s ✓ |
| Gaps | 4 (P1 HIGH + 3 MEDIUM) | 6 (P1 HIGH + 5 MEDIUM) | 4 (P1 HIGH + 3 MEDIUM) |
| **Edits** | **10** (58.9s step) | **14** (81.3s step) | **0 — see defect below** (78.0s step) |
| Redundancy | completed: SRI 0.157, 89 claims, 75 clusters | completed: SRI 0.134, 67 claims, 58 clusters | completed: SRI 0.149, 101 claims, 86 clusters |
| ConfirmedRisks | 5 (5 approved, 4 CRITICAL, addressed-status populated) | 5 (same) | 5 (same) |
| Risk Gate | completed (no bypass dataNote) | completed | completed |
| Framing row scored against | #63 | #64 | #65 |

**Framing version identification:** rows #63/#64/#65 are three separate uploads of
the same file, all byte-identical (sha256 `9d86962e2b0c9c40…`, 21,574 chars) and
content-equal to **framing #59 = v1_1** (the row carrying BLOCKED check #19). None
of the runs used v1_1.1 (that content is sha `f701316…`, rows #62/#66, check #21).
So: **all three runs were scored against v1_1** — same framing version across the
trio. (The uploads happened minutes before the framing-handoff fix landed; future
runs can reuse the checked row instead of re-uploading.)

### Defect: run #69 `generate-edits` returned zero edits (run-66 pattern repeat)

#69 has four pillars under the 4.0 edit threshold (P1 1.25, P4 3.34, P2 3.63,
P7 3.67), so the step entered the LLM path — and persisted nothing. Journal
evidence (GraphQL `runTraceSpanOutputByID`, verbatim):

```json
{ "data": "[]", "error": null }
```

Step status COMPLETED, attempts 0, duration **78.0s**. The duration is the
discriminator: an exception path dies in ~0–2s (and would be invisible anyway —
the step's `catch` swallows errors and returns `[]`), so the model *responded*
after a full-length generation and the response parsed to zero edit rows (either
`edits` missing/empty in the returned JSON, or every entry dropped by the
`issue && fix` filter). #67 (10 edits, 58.9s) and #68 (14 edits, 81.3s) prove the
step normally works on this exact memo family. This is the second occurrence
(run #66 was the first). Edits are a display artifact, never a score input —
scores are unaffected. Fix scoping (separate task, per the audit constraints):
log raw response shape on empty parses so the failure mode is diagnosable, and
consider one bounded retry on empty-with-low-scorers.

## B — Score correctness

Recomputed from persisted `serverComputed` values via the same
`memoConfidence` / `statusBadge` code paths:

| | #67 | #68 | #69 |
|---|---|---|---|
| 13 dimension rows, all non-null | ✓ | ✓ | ✓ |
| scoredPillarCount | 8 ✓ | 8 ✓ | 8 ✓ |
| Readiness recomputed vs stored | 71.8931 = 71.8931 ✓ | 66.0260 = 66.0260 ✓ | 73.0699 = 73.0699 ✓ |
| stage1Avg / stage2Avg | ✓ / ✓ | ✓ / ✓ | ✓ / ✓ |
| Badge recomputed vs stored | MAJOR_REWORK ✓ | MAJOR_REWORK ✓ | MAJOR_REWORK ✓ |
| scorableChapterCount vs file | 10 = 10 ✓ | 10 = 10 ✓ | 10 = 10 ✓ |

- **Badge logic:** all three badges are forced by the **P1 ship rule** — 5 major
  reconciliation failures (≥ 2) → HIGH gap → MAJOR_REWORK, even though readiness
  is ≥ 50 in all three. No Stage-2 floor trips (all D ≥ 4.0); P1 (1.25) is the
  only pillar ≤ 2.0. Stored badges follow exactly from stored inputs.
- **Parse integrity (run-25 lesson):** both files read from disk are
  byte-identical to the stored memo content (G_Parallel sha `29550a47c8a9c9f4…`
  = memo rows 43 AND 44; Parallel_O sha `3cc5c0d411f3af6f…` = row 45), and both
  files contain 17 H1 chapters = the 17-chapter parse (12 scored + 5 context-only),
  with all 10 canonical scorable chapters present. No collapsed or partial parse.

## C — The 67-vs-68 spread (5.867 points)

1. **Input identity: confirmed byte-identical.** Different Memo rows (#43, #44 —
   the file was uploaded twice) but identical content hashes; framing rows #63/#64
   also byte-identical. The comparison is a true duplicate pair.
2. **P1 cache: worked exactly as designed.** #67 MISS → stored key
   `6eeaa224fc33dc45…` at 15:01:37; #68 (lookup runs after its Tier steps, ~15:09)
   **HIT** the same key. P1 findings JSON and subScores are byte-identical between
   the runs (majors = 5, P1 = 1.25 in both). No cache-key bug. (The E1-registered
   cold-race miss/miss scenario didn't arise here — the twins were staggered ~8
   minutes, not parallel-submitted.)
3. **Per-dimension delta table** (#67 − #68; readiness contribution = Δ × 2.5):

   | Dim | #67 | #68 | Δ | Readiness pts |
   |---|---|---|---|---|
   | P1 | 1.25 | 1.25 | 0 | 0 _(cache-pinned)_ |
   | P2 | 3.6342 | 3.6342 | 0 | 0 _(identical to full precision)_ |
   | P3 | 5.00 | 5.00 | 0 | 0 |
   | **P4** | 3.8730 | 2.9428 | **+0.93** | **+2.33** |
   | **P5** | 4.00 | 3.3333 | **+0.67** | **+1.67** |
   | P6 | 4.3333 | 4.3333 | 0 | 0 |
   | P7 | 2.6667 | 2.6667 | 0 | 0 |
   | **P8** | 4.00 | 3.25 | **+0.75** | **+1.88** |
   | D1–D5 | — | — | D2 −0.4, D3 +0.2 | (Stage 2 — not in readiness) |
   | **Total** | | | | **+5.87 = the full spread** ✓ |

4. **Framing context:** identical bytes → not a variance source.
5. **Vs the noise floor:** the 5.87 aggregate **exceeds the ±3 corpus readiness
   noise floor**, but decomposes into three subjective-pillar swings (0.67–0.93
   each) that are individually **within** the known per-pillar wobble (P4/P8
   observed swinging up to ~1.75 on in-set re-scores) — they just landed in the
   same direction this time. Everything deterministic or pinned (P1 via cache,
   P2/P3/P6/P7) is identical to full float precision. SRI Δ = 0.023 is within its
   ±0.035 noise band. **Conclusion: within expected noise once pillar-correlation
   is accounted for — no mechanical fault; the pair is itself the best duplicate-
   pair noise measurement to date and widens the empirical readiness noise
   estimate for single-pair comparisons to ~±6 when subjective pillars correlate.**

## D — Verdict

| Run | Complete? | Scores internally correct? | Trustworthy for the twin experiment? |
|---|---|---|---|
| #67 | **Y** — all steps, 0 retries | **Y** — exact recompute | **Y** |
| #68 | **Y** — all steps, 0 retries | **Y** — exact recompute | **Y** |
| #69 | **Y*** — all steps completed; `generate-edits` silently produced 0 rows (display-only defect, run-66 pattern) | **Y** — exact recompute | **Y** (scores unaffected by the edits defect) |

**Canonical-run recommendation:** do **not** pick one G_Parallel run as canonical —
both are internally valid, and together they are a legitimate duplicate-pair noise
measurement bracketing G_Parallel readiness at **[66.0, 71.9]** (midpoint 68.96).
For the O-vs-G comparison: #69's 73.07 sits +4.1 above the pair midpoint but only
+1.2 above the pair's own upper run — **the readiness difference between O and G
cannot be distinguished from noise**. The defensible per-dimension signal is
**P7 (Output Realism): 2.67 in both G runs (twin-stable) vs 3.67 in O** — a +1.0
swing on a dimension that did not wobble across the duplicate pair (+2.5 readiness
points). P1 is identical everywhere (5 majors → ship-rule MAJOR_REWORK on all
three), so the twins agree completely on the headline verdict.

**Re-runs needed before the twins analysis proceeds: none.** Optional, separately
scoped: (1) harden `generate-edits` against silent-empty responses (runs 66 and 69);
(2) if the #69 scorecard should display edits, regenerate them — cosmetic only.
