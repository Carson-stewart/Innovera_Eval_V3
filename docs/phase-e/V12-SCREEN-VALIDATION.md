# E3 — Daikin v12 Screen Validation (token-free)

**Verdict: v12 file-validated.** All four audited conflicts are gone, nothing new was
introduced, the repetition profile is otherwise unchanged, and the "fleet of 2,500+"
watch item does NOT false-positive. Zero LLM calls, zero DB access.

Instrument: the new **conflict screener** (`scripts/conflict-screener/`, `npm run screen`),
built on the checker v1.2 stage-1 extractor (`lib/framing/quantities.ts`) — one quantity
grammar, one pairing rule set, applied cross-chapter. Run artifacts:
`scripts/conflict-screener/output/v11-vs-v12/screen-report.{md,json}`; classification
script: `scripts/conflict-screener/analyze-delta.ts`.

- Memo A (before): `C:\Users\cstew\Downloads\2026-02-11_Daikin_Oxi_Corporate_v11.md`
- Memo B (after): `C:\Users\cstew\Downloads\2026-02-11_Daikin_Oxi_Corporate_v12.md`
- Buckets: `scripts/conflict-screener/daikin-buckets.json` (the snippets-audit pipeline buckets + 5-figure anchor family)

## Token-free proof

OpenRouter key probe (free `/api/v1/auth/key` endpoint), before building/running:
**usage $433.40285082** — after the full build, calibration and both screen runs:
**unchanged**. The screener's import graph contains no `openrouter`/`prisma` import
(asserted by a unit test in `scripts/conflict-screener/__tests__/calibration.test.ts`).

## Calibration against the v11 audit baselines (acceptance bar)

| # | Baseline (audit) | Screener (v11) | Status |
|---|---|---|---|
| 1 | ¥1bn family ≈ 26 across ≥ 10 chapters | 27 across 12 chapters | PASS (±10%) |
| 1 | $2,500 ≈ 20 | 22 (20 distinct statements) | PASS (±10% edge) |
| 1 | $1,200 ≈ 12 | **14** | **REPORTED DISCREPANCY D1** |
| 1 | $460M ≈ 8 | **11** | **REPORTED DISCREPANCY D2** |
| 2 | units-to-target candidate set (2,500 / ~2,700 / 3,000–4,000 across Revenue Model / Finance & Operations / Unit Economics) | all three pairs emitted | PASS |
| 2 | 6.4% vs 7.6% CAGR pair | emitted (Market Research ↔ Revenue Model) | PASS |
| 3 | ~111 tags | 111 exactly | PASS |
| 3 | WITH-FIGURE share ≈ 100% | **20/111 (18%)** | **REPORTED DISCREPANCY D3** |
| 4 | RULES-ON ≈ 4.4 / RULES-OFF ≈ 8.8 per chapter | 4.75 / 9.50 (summaries: 12 — audit's 12 exactly) | PASS (±10%) |

Per the build spec, out-of-tolerance results are **reported with examples, not
tolerance-loosened** (each is pinned exactly in the calibration test):

- **D1 — $1,200 = 14, audit ≈ 12.** 13 literal `$1,200` tokens plus one normalized
  variant `$1.2k` (v11 L2525, a unit-cost figure). The literal set also contains the
  Herman Miller Aeron chair benchmark (v11 L2077) — a same-value figure that is not
  the CAC anchor. Value normalization cannot distinguish concept identity; that stays
  with the stage-2 adjudicator.
- **D2 — $460M = 11, audit ≈ 8.** The audit counted the spelled-out `$460 million`
  (exactly 8); the extractor also catches the `$460M` short form (exactly 3). 8 + 3 = 11.
  Audit replication asserted on the literal forms.
- **D3 — WITH-FIGURE 20/111, registered baseline "≈100%".** The registered baseline
  assumed all 111 tags are figure references. Empirically, most v11 tags are
  **qualitative** cross-references with no figure in the sentence at all (e.g. GTM:
  "the risks flagged in \[CHAPTER: Legal and IP\]"; Six T: "\[Design Deficit\]: …
  \[CHAPTER: product-and-technology\]"). The audit's 0%-substitution claim survives in
  refined form — no tag ever *substitutes* for a figure — but the measurable baseline
  for the prompt team's F4 prediction is **20/111 WITH-FIGURE**: after F4, tags should
  replace figures, so the WITH-FIGURE share of figure-referencing tags should drop and
  WITHOUT-FIGURE tags should rise *while figure repetition falls*. Score F4 against
  20/111, not "100%".

Two stage-1 grammar gaps were fixed (additively, checker suite green at 15/15) during
calibration: count ranges ("3,000–4,000 units" = ONE value), open floors ("2,500+
units" = floor, conflicts with nothing ≥ 2,500), and a price-as-count false positive
("~$2,500 units", "$2,500 unit price" no longer extract as counts).

## Delta findings (v11 → v12)

### 1. The four audited conflicts are gone

| Conflict (v11) | v12 evidence |
|---|---|
| Units-to-target: 2,500 (RM) vs ~2,700 (F&O) vs 3,000–4,000 (UE) | all three cross-chapter pairs **absent**; `2,500 units` mentions 3 → **0**, `3,000–4,000 units` 1 → **0**, `2,700 units` 2 → **6** (exactly E3's string-count verification) |
| CAGR: 6.4% vs 7.6% | pair **absent**; `7.6%` mentions 1 → **0** |
| TAM: ~$10B-by-2035 vs $8.31B-by-2033 | (was never a stage-1 pair — time-distinguished values are checker non-candidates by design) `$8.31 billion` 4 → 9, the split "$8.3 billion [to $9.6B]" form 1 → 0 — the unified-forecast edit signature |
| Margin story: 50% GM ($1,250 GP) "payback immediate" vs 45% base case | `45%` +1, `$1,125` +1; the rewritten CAC prose now carries explicit "base-case/upside" labels, so its quantities are **scenario-labeled non-candidates** under checker rules (6 v11 pairs touching that line correctly dissolved) |

### 2. No new conflict candidates introduced by the edits

343 pairs "introduced" / 253 "resolved" at raw value-level identity — **all of it
traces to the four edit sites**:

- **341 of 343 introduced** are *edit-shadow re-keyings*: a pair like "400 units (F&O)
  vs 2,500 units (RM)" becomes "400 units vs **2,700** units" when RM's value was
  unified — same counterpart, updated value, not a new disagreement. Same mechanism
  for every pair touching $8.31B/$8.3B/6.4%/45%/$1,125.
- **The remaining 2** are context-window flips *on edited lines*: (a) Exec Summary L75
  — Edit 3 reworded that exact line, changing its shared-noun set; (b) UE L2394 —
  adjacent to Edit 4's L2393, its ±1-line context absorbed the new word "base". Both
  involve unchanged values on both sides.
- **10 of 253 resolved** are the same mechanism in reverse (6 of them the deliberate
  scenario-labeling of Edit 4's line; 4 are ±1-line context flips at the L949/L1218
  TAM edit sites).

**Zero pairs in either direction involve only un-edited text.**

### 3. Watch item: "a fleet of 2,500+ units" — explicitly checked, no false positive

The figure survives in v12 (1× Revenue Model, the Cost Structure service-risk
sentence, untouched per E3). The extractor models it as an **open floor**
(lo = 2,500, hi = ∞), and an open floor is never disjoint from any value at or above
it — so it pairs with **nothing ≥ 2,500**: not with the 2,700 annual figure, not with
anything else. Verified in both v11 and v12 candidate sets (0 such pairs). The scorer
*reading prose* may still conflate the installed-fleet concept with the annual
units-to-target figure — that risk is unchanged — but the screener will not feed it
as a candidate.

### 4. Repetition profile otherwise unchanged

- Anchor-family bucket rates **identical**: RULES-ON 4.75 → 4.75, RULES-OFF 9.50 → 9.50,
  summaries 12 → 12. All-figure rates move ≤ 0.5/chapter. The fixes targeted drift,
  not volume — confirmed.
- Tags: 111 → 111, WITH-FIGURE share identical (20/111).
- Only 9 figure families changed mentions, every one an edit target. One deliberate
  increase: `$8.31 billion` +5 — Edit 3 restates the unified 2033 forecast at each
  former $10B site. That is the designed trade (one consistent anchor restated vs two
  competing forecasts); flagging it here so the repetition uptick is not read as drift.

## Status

- v12 file validation: **complete, token-free**. v12 remains ready for Carson's
  3× upload-and-score (still blocked on the OpenRouter monthly limit, per E1).
- The screener + `daikin-buckets.json` are the standing instrument for scoring the
  prompt team's regenerated memos against the audit's registered predictions
  (F1: RULES-OFF rate 8.8 → ~4.4; F1+F2: units-to-target class absent;
  F4: tag-substitution vs the corrected 20/111 baseline).
