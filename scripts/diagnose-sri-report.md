# SRI Reconciliation & Version Gate — Diagnostic Report

**Script:** `scripts/diagnose-sri.ts` (run: `npx tsx scripts/diagnose-sri.ts`, dry-run: `--dry-run[=<memoId>]`)
**Scope:** Diagnosis only. Nothing cleared, deleted, or re-scored. 21 `RedundancyAnalysis` rows, all `completed`.

---

## Section A — Claim-set reconciliation (stored data only)

For each run: `multiClusterCount = favoriteFriends.length`, `sumAssertions = Σ assertionCount`,
`singletons = uniqueClusterCount − multiClusterCount`, `reconstructedClaims = sumAssertions + singletons`,
`unaccounted = claimCount − reconstructedClaims`.

| raId | memo | claims | uniq | multi | sumAsrt | singl | recon | unaccounted | gap |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | Ecolab_Parallel_Gen | 48 | 47 | 1 | 2 | 46 | 48 | 0 | 0 |
| 2 | Zebra_Last_Gen | 39 | 39 | 0 | 0 | 39 | 39 | 0 | 0 |
| 3 | Daikin_Ox (02-11) | 17 | 17 | 0 | 0 | 17 | 17 | 0 | 0 |
| 4 | Pasha_DCnt (25-12-06) | 48 | 46 | 1 | 3 | 45 | 48 | 0 | 0 |
| 6 | Daikin_Ox (02-12) | 14 | 14 | 0 | 0 | 14 | 14 | 0 | 0 |
| **7** | **Ecolab_Parallel_Gen** | **49** | **39** | **5** | **13** | **34** | **47** | **+2** | **2** |
| 8 | Ecolab_Parallel_Gen | 49 | 45 | 3 | 7 | 42 | 49 | 0 | 0 |
| 9 | Visiomex_1st_Gen | 56 | 50 | 5 | 11 | 45 | 56 | 0 | 0 |
| **10** | **Pasha_DC_Last (01-09)** | **72** | **53** | **5** | **15** | **48** | **63** | **+9** | **9** |
| **11** | **LGIT MedTech** | **50** | **37** | **5** | **17** | **32** | **49** | **+1** | **1** |
| 12 | LG_Parallel_Gen | 56 | 51 | 5 | 10 | 46 | 56 | 0 | 0 |
| 13 | Daikin_Last_Gen | 77 | 74 | 3 | 6 | 71 | 77 | 0 | 0 |
| 14 | Pasha_DC_Last (01-09) | 57 | 47 | 10 | 20 | 37 | 57 | 0 | 0 |
| 15 | NEE NY Storage | 56 | 52 | 4 | 8 | 48 | 56 | 0 | 0 |
| 16 | samsung_Final | 72 | 64 | 4 | 12 | 60 | 72 | 0 | 0 |
| 17 | MN_4_1 | 52 | 35 | 6 | 23 | 29 | 52 | 0 | 0 |
| 18 | Zebra final | 53 | 47 | 3 | 9 | 44 | 53 | 0 | 0 |
| 19 | ecolab5 | 44 | 38 | 4 | 10 | 34 | 44 | 0 | 0 |
| 20 | ecolab3 | 49 | 32 | 7 | 24 | 25 | 49 | 0 | 0 |
| 21 | ecolab2 | 31 | 30 | 1 | 2 | 29 | 31 | 0 | 0 |
| 22 | ecolab1 | 30 | 26 | 4 | 8 | 22 | 30 | 0 | 0 |

- **Formula equality:** `unaccounted === gap` on **every** row (✓). The two derivations —
  `claimCount − (sumAssertions + singletons)` and `(claimCount − uniqueClusterCount) − Σ(assertionCount − 1)`
  — are algebraically identical and match in the data.
- **18 clean runs** (`unaccounted == 0`), **3 dirty** (raId 7, 10, 11; +2, +9, +1).
- The arithmetic identity `SRI == (claimCount − uniqueClusterCount) / claimCount` holds on all 21 rows,
  so `claimCount`/`uniqueClusterCount` are internally consistent — the gap lives in claims that were
  counted but never landed in any cluster, **not** in the SRI/count fields.
- **Not a parser artifact:** the permissive parser counted every `favoriteFriends` entry (raw array length
  == parsed length on all three dirty runs), and `split-redundancy.ts` previously produced non-zero
  *recomputed* SRIs on these same runs — impossible if a strict parser had bailed.

---

## Section B — Version segmentation → **Question 1**

| Signal | Grouping | Dirty runs |
|---|---|---|
| `rubricVersion` | uniform `"V3 v1.0"` | **cannot discriminate** |
| `threshold` | 0.85 (5 runs) / 0.70 (16 runs) | 0.85: **0** · 0.70: **3** |
| `scoredAt` | 2026-06-02 (16) / 2026-06-08 (5) | 06-02: **3** · 06-08: **0** |

**Chronology (by `scoredAt`) is the discriminator — threshold is a red herring:**

- 0.85 is the **oldest** batch (raId 1–6, 06-02 14:19–14:52) and is **fully clean**.
- The dirty runs (7, 10, 11) sit in an **early window of the 06-02 0.70 batch** (14:58–15:24).
- All 11 runs scored **after** the last dirty run (raId 11 @ 15:24) are clean, including the
  entire **most-recent 06-08 batch** (raId 18–22), which also uses threshold 0.70.

> **Question 1 verdict: the mismatch is CONFINED TO OLDER RUNS.** The most recent batch reconciles
> cleanly; every run scored after the last dirty one is clean. This is **stale data**, not a recurring
> live condition.

---

## Section C — Mechanism (current live path)

**Code read (read-only):**

- `lib/redundancy/embed.ts` — the sparse-array pattern **is still present**:
  `new Array(texts.length)` (L33) filled by `allEmbeddings[i + item.index]` (L55). An item omitted from
  an API batch leaves an `undefined` hole.
- `inngest/functions/scoreMemo.ts` — the `vectors[i] ?? []` fallback **is present** (L618), so a hole
  becomes an **empty `[]` embedding** rather than a throw.
- **Decisive point — where `claimCount` comes from:** it is **not** `claims.length`. `computeMetrics`
  derives it from the clusters (`metrics.ts` L33: `Σ assertionCount`). `clusterClaims` builds its
  UnionFind over **all** claims, including empty-embedding ones; `cosineSimilarity` returns 0 for a
  zero-norm vector (`cluster.ts` L41), so an empty-embedding claim simply falls out as a **singleton** —
  still counted in **both** `claimCount` and `uniqueClusterCount`. The two fields are therefore
  consistent **by construction**, and the current code is **structurally incapable of producing
  `unaccounted > 0`**. An empty embedding degrades cluster *quality* (a missed paraphrase), not the counts.
- **Saved-list drop ruled out:** `scoreMemo.ts` L635 persists `favoriteFriends` with no intermediate
  filter/slice; the only filter (`metrics.ts` L51, `assertionCount > 1`) is the singleton exclusion the
  reconciliation already accounts for via the `singletons` term.
- **Therefore the dirty rows must come from an earlier code version** that took `claimCount` before an
  embedding-failure filter while clustering only the survivors (a pre-clustering drop).

**Live dry-run (`--dry-run`, persisted nothing):** memo #24 `ecolab1.docx`, 28 claims →
`claimCount=28, uniqueClusterCount=23, reconstructedClaims=28, unaccounted=0, emptyEmbeddings=0`.
**ASSERT `unaccounted == 0` ✓ PASS · ASSERT no empty `[]` ✓ PASS.** Row counts before/after the dry-run
were identical (21 redundancy / 22 runs) — nothing persisted.

---

## Gate verdict

✅ **Safe to clear and re-score under the current version.** The `unaccounted > 0` mismatch is confined
to three older 06-02 runs; the most recent batch reconciles cleanly; the current pipeline is structurally
incapable of producing the mismatch (counts derived from one cluster set), and the live dry-run confirmed
`unaccounted == 0` with zero empty embeddings. There is **no live bug** to fix first.

Remaining order after this gate: land the claim-caching + build-pin fix → snapshot current rows →
clear and re-score.

---

### Constraint confirmation

- Nothing under `lib/scoring/` or `lib/redundancy/` was modified (all 13 dimension scores byte-identical).
- No schema or migration changes; nothing was cleared, deleted, or re-scored.
- Stored-data and code-reading work was read-only; the optional dry-run persisted nothing (verified counts unchanged).
- `tsc --noEmit` passes clean.
