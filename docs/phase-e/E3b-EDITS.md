# E3b — Daikin v13 Edit Record (Run #66 persisted-findings reconciliation)

Source: `2026-02-11_Daikin_Oxi_Corporate_v12.md` → `2026-02-11_Daikin_Oxi_Corporate_v13.md`
(both in `C:\Users\cstew\Downloads`; v13 is ready for Carson to upload and score).

Basis: ScoringRun **#66** (memo 42 = v12, V3 v1.1, P1 = 1.0, MAJOR_REWORK) persisted
P1 findings F1–F14. The seven edit targets map: **E1=F2, E2=F1+F4+F5 (the three-at-once),
E3=F3 (+F9), E4=F7, E5=F6, E6=F13, E7=F8.** Edit script (kept, reproducible):
`scripts/phase-e/make-v13.ts` — 17 string replacements, each applied with an exact-match
assertion (occurrence count == 1 pre-edit), no LLM, no DB. Full stdout (assertions, audit,
diff): `scripts/phase-e/make-v13-output.txt`.

## The seven edits as applied

- **E1 (F2)** — Highlights bullet (v12 L29, the first declarative statement of ¥1B as the
  target; the L15 Overview mention is a risk-path reference, not the target statement).
  Added the instructed reconciling sentence verbatim ("The brief frames the ambition as
  ¥100M–¥1B by 2030; this memo plans against the upper bound (¥1B) as the success
  threshold, since the lower bound would not justify the program."). No other location
  re-introduces the range (grep: zero ¥100M mentions in v12) — nothing else to clean.
  **Conversion exception taken:** the same bullet's `(\~$6.7M)` → `(\~$6.7M at ¥150/$)`.
  The other conversion site (L2288, `~$6.5M USD`, COGS section) is the F12 minor and was
  NOT edited, per scope.
- **E2 (F1, F4, F5)** — canonical TAM range **"$4.85–5.1B (2024/25; sources vary)"**
  established in full in the Opportunity Validation *Market Summary* (L119) and applied at
  the Customer-Validation Claims (L573), Market Research TAM paragraph (L949, which keeps
  its existing "As established in \[CHAPTER: Opportunity Validation\]" reference), Market
  Research Claims (L1218), and the Six T TAM deep dive (L217: `($5B+)` → `(the $4.85–5.1B
  TAM)` — the last standalone $5-billion form; screener evidence showed it sourcing the
  only surviving $5B↔$5.1B candidate). Segmentation math (L962) now reads the instructed
  "using the **$5.1B upper bound of the established range**". The GVR expansion sentence
  (L369) names its base "approximately $4.85 billion in 2024 *(the lower bound of the
  established $4.85–5.1B range)*" — clears F4 without touching the cited forecast.
- **E3 (F3, F9)** — Market Summary (L119) now carries the instructed merged sentence:
  "$8.31 billion by 2033 (Grand View Research); the longer Fact.MR horizon reaches
  **~$9.6–10B by 2035**". The same canonical Fact.MR phrasing replaced every other 2035
  extension (L75, L369, L574, L949, L1218 — six sites total), which also collapses the
  $9.6B-vs-$10B same-year alternation (F9). Zero standalone "$10 billion by 2035" remain;
  zero "$9.6 billion" points remain. All GVR/Fact.MR links preserved.
- **E4 (F7)** — LTV & Payback table: Optimistic-row CAC cell now reads "$800 (optimistic
  scenario)"; the instructed note added under the table; the F&O Key Drivers CAC row
  rationale carries the same contrast; the F&O Scenario & Sensitivity "Base" line became
  "**Base scenario**". **Wording decision:** the instructed note text ended "…the
  channel-advantage *case*", but the detector's scenario exclusion
  (`SCENARIO_RE` in `lib/framing/quantities.ts:64`) matches `base case / upside / downside /
  optimistic / pessimistic / … / scenario` — "case" alone does not trigger it. Since E4's
  stated premise is "scenario labeling is the detector's own exclusion condition", the
  notes say "channel-advantage **scenario**" (same content, exclusion actually fires).
  Empirically verified below: $800↔$1,200 screener pairs went **5 (v12) → 0 (v13)**.
  The $200–$800 retail-price range (L2057) is not a CAC figure and was not touched.
- **E5 (F6)** — Unit Economics Inogen bullet: "Reports gross margins consistent with the
  targets cited in Market Pricing Dynamics" → "Reports **~44.7% gross margin, within the
  40–50% target band**". The 44.7% figure is already established at the Market Pricing
  Dynamics source site (v12 L2050, BeyondSPX/Business Wire cites kept on the edited line).
- **E6 (F13)** — Capacity Math Reality-Check bullet extended with the instructed ramp
  framing. **Projection-table consistency verified, no flag needed:** at the drivers-table
  ASPs the table implies Y3 800 × $2,500 = $2.0M ✓ (matches Y3 revenue), Y4 $4.0M ⇒
  ~1,600 units, Y5 $6.75M ⇒ 2,700 units = the 2030 steady-state run-rate exactly; the
  break-even prereq ">1,500 units/yr by Q3 Y4" sits on the same ramp. The Y5 row already
  agrees with the 2,700 run-rate — table values untouched.
- **E7 (F8)** — both SAM statements already contained the identical phrase "the estimated
  $460 million Serviceable Addressable Market (SAM)"; the actual qualifier difference was
  on the 1.5% share (`\~1.5%` in Highlights vs "approximately 1.5%" in Should-We-Do-It).
  Harmonized Highlights to "approximately 1.5%". $460M family mentions unchanged (11 → 11).

## Explicitly NOT edited (per scope)

F10 ("fleet of 2,500+" — installed base, known detector false-positive candidate;
screener confirms it still pairs with nothing ≥ 2,500), F11 (CAC "significantly higher"
phrasing), F12 beyond the E1-site exception (L2288 `$6.5M` stands), F14 (margin
back-calculation note), and everything else the detector flagged outside this list.

## Verification 1 — assertions and string-count audit

All **17 exact-match assertions** passed (each old string occurred exactly once; a failed
assertion aborts without writing v13). String-count audit, v12 → v13 (all 18 checks exact):

| String | v12 | v13 |
|---|---|---|
| `$5 billion` (standalone TAM form) | 3 | **0** |
| `($5B+)` | 1 | **0** |
| `$5.1 billion` | 2 | **0** |
| `$4.85–5.1B` (canonical range) | 0 | **6** |
| `(2024/25; sources vary)` | 0 | 4 |
| `~$9.6–10B by 2035` | 0 | **6** |
| `$10 billion` | 4 | **0** |
| `$9.6 billion` | 2 | **0** |
| `approaches $10 billion` | 2 | 0 |
| `44.7%` | 1 | 2 |
| `¥100M–¥1B` | 0 | 1 |
| `at ¥150/$` | 0 | 1 |
| `channel-advantage scenario` | 0 | 2 |
| `(optimistic scenario)` | 0 | 1 |
| `**Base scenario**:` | 0 | 1 |
| `interim ramp milestone` | 0 | 1 |
| `approximately 1.5% market share` | 0 | 1 |
| `\~1.5% market share` | 1 | 0 |

## Verification 2 — screener delta v12 → v13 (token-free)

Instrument: `npm run screen` with `daikin-buckets.json`; artifacts in
`scripts/conflict-screener/output/v12-vs-v13/` (`screen-report.{md,json}`,
`analyze-delta-v13-output.txt`); classifier: `scripts/conflict-screener/analyze-delta-v13.ts`.

### The seven targets — value-level absence checks (v13)

| Target | Check | Result |
|---|---|---|
| E2/F1+F5 | $5B point mentions | 4 → **0** |
| E2/F1+F5 | $5B↔$5.1B and $5B↔range candidate pairs | **0** |
| E2/F4 | $4.85B point vs canonical range | overlapping → never a pair by construction |
| E3/F3+F9 | $10B / $9.6B point mentions | 4 → **0** / 2 → **0** |
| E3/F9 | $10B↔$9.6B pairs | **0** |
| E1/F2 | ¥1B point vs brief range | range stated on the edit line; see grammar-gap note |
| E4/F7 | $800↔$1,200 pairs | **5 → 0** (scenario exclusion now fires on every $800 CAC line) |
| E5/F6 | 44.7% | 1 → 2 — same value, repetition not conflict |
| E6/F13 | 800↔2,700 unit pairs | 2 → 2 (identical to v12 — see watch items) |
| E7/F8 | $460M family | 11 → 11, unchanged |
| (E3 carry-over) | "fleet of 2,500+" vs ≥2,500 | still **0** pairs |

### No new pairs from un-edited text

Raw delta: 645 introduced / 794 resolved at value-key level. **641 of 645 introduced are
edit-shadow re-keyings** (≥1 side is an edit-moved value — same mechanism as v11→v12).
The remaining **4** are ±1-line context-window flips with unchanged values on both sides,
every one at an edit-adjacent line: 2× vs F&O L2554 (neighbor of the E6 edit at L2553),
1× vs MR L963 (neighbor of the E2 edit at L962), 1× vs OV L119 (itself an edited line).
Resolved side: 713 edit-value, 81 context flips concentrated on the edited L119 and L2511
lines. **Zero pairs in either direction involve only un-edited text.**

### Repetition profile — expected vs actual (E2/E7 shift registration)

- Anchor-family buckets: RULES-ON **4.75 → 4.75 (identical)**; RULES-OFF 9.50 → 10.00 and
  SUMMARIES-EXEMPT 12 → 14. Both increases are the designed E1/E4 restatements landing in
  anchor families: ¥1B +2 (both inside E1's reconciling sentence, Executive Summary) and
  $1,200 +2 (the two E4 benchmark notes). Expected and logged — not drift.
- All-figure rates move ≤ 1.5/chapter except summaries (+4.0/ch), which is E1's sentence
  adding ¥100M/¥1B/¥150 figures to the Executive Summary — edit-site only.
- Tags: 111 → 111, WITH-FIGURE share identical (20/111 — the F4-corrected baseline).
- Figure deltas: 16 families changed, **every one an edit-target value** (the
  `analyze-delta-v13` output lists all 16 with before/after).

### Watch items (calibration track)

1. **JPY range grammar gap.** `¥100M–¥1B` does not parse as a range — `MONEY_RE`'s range
   arm (`lib/framing/quantities.ts:110`) only admits `$` as the second currency symbol —
   so E1's sentence lands as two JPY points (¥100M, ¥1B). Consequence: money:JPY candidate
   entries rise 32 → 59, all anchored on the E1 line (¥100M and ¥150 pairing with disjoint
   JPY values cross-chapter). Detector-level the sentence is an explicit reconciliation;
   screener-level this is mechanical noise at one edit site. Fixing the grammar means
   touching shared checker stage-1 — out of scope here, recorded for the calibration track.
2. **800↔2,700 unit pairs persist (2, exactly as in v12).** E6 is prose reconciliation;
   the values legitimately coexist (Y3 milestone vs 2030 run-rate). Whether the detector
   honors the ramp framing is part of the registered prediction below.
3. **$4.85B↔$5.1B pair persists (1, exactly as in v12)** — L369's GVR base vs L962's
   upper-bound naming. In v13 both are explicitly named as bounds of the same established
   range; a value-level screener cannot see that. Detector-level this should now read as
   one range, not two estimates.

## Registered prediction (for Carson's v13 scoring run)

Majors **≤ 1** if the detector accepts the scenario/canonical/source-labeled phrasings —
at ≤1: P1 = 3.0, readiness ≈ 80, badge **READY_TO_SHIP** (the corpus's first valid
positive). Majors **2–3** if range-vs-point strictness persists despite E2 — which would
be the definitive calibration-track evidence. No scoring run was performed in this task.

## Full diff (every changed line, 1-based v12 line numbers)

```diff
--- v12
+++ v13
@@ -29 @@
-- The venture targets ¥1 billion (\~$6.7M) in annual revenue by 2030, requiring \~1.5% market share of the estimated $460 million Serviceable Addressable Market (SAM).
+- The venture targets ¥1 billion (\~$6.7M at ¥150/$) in annual revenue by 2030, requiring approximately 1.5% market share of the estimated $460 million Serviceable Addressable Market (SAM). The brief frames the ambition as ¥100M–¥1B by 2030; this memo plans against the upper bound (¥1B) as the success threshold, since the lower bound would not justify the program.
@@ -75 @@
-… (Grand View Research; the same forecast extended to 2035 approaches $10 billion per Fact.MR), demand is driven 85% …
+… (Grand View Research; the longer Fact.MR horizon reaches ~$9.6–10B by 2035), demand is driven 85% …
@@ -119 @@
-The global oxygen concentrator market is valued at approximately $5 billion (2025) and projected to reach $8.31 billion by 2033 (Grand View Research; extended to 2035, the same forecast approaches $10 billion per Fact.MR), though 85% …
+The global oxygen concentrator market is valued at $4.85–5.1B (2024/25; sources vary) and projected to reach $8.31 billion by 2033 (Grand View Research); the longer Fact.MR horizon reaches ~$9.6–10B by 2035, though 85% …
@@ -217 @@
-… The root cause is a reliance on broad "Wellness Economy" data ($5B+) rather than the specific Serviceable Addressable Market (SAM) …
+… The root cause is a reliance on broad "Wellness Economy" data (the $4.85–5.1B TAM) rather than the specific Serviceable Addressable Market (SAM) …
@@ -369 @@
-… projected to expand from approximately $4.85 billion in 2024 to $8.31 billion by 2033, with a CAGR of 6.4% <GVR links>. On the longer Fact.MR horizon, the same growth trajectory reaches roughly $9.6 billion by 2035 <Fact.MR link>.
+… projected to expand from approximately $4.85 billion in 2024 (the lower bound of the established $4.85–5.1B range) to $8.31 billion by 2033, with a CAGR of 6.4% <GVR links>. On the longer Fact.MR horizon, the same growth trajectory reaches ~$9.6–10B by 2035 <Fact.MR link>.
@@ -573 @@
-*   The global oxygen concentrator market is valued at approximately $4.85 billion to $5.1 billion in 2024/2025.
+*   The global oxygen concentrator market is valued at $4.85–5.1B (2024/25; sources vary).
@@ -574 @@
-*   The market is projected to reach $8.31 billion by 2033 (extending to ~$9.6 billion by 2035 per Fact.MR), growing at a CAGR of approximately 6.4%.
+*   The market is projected to reach $8.31 billion by 2033 (the longer Fact.MR horizon reaches ~$9.6–10B by 2035), growing at a CAGR of approximately 6.4%.
@@ -949 @@
-… As established in \[CHAPTER: Opportunity Validation\], this market is valued at approximately $5 billion (2025) with a projected growth trajectory reaching $8.31 billion by 2033 (Grand View Research; approaching $10 billion by 2035 on the extended Fact.MR horizon).
+… As established in \[CHAPTER: Opportunity Validation\], this market is valued at $4.85–5.1B (2024/25; sources vary), with a projected growth trajectory reaching $8.31 billion by 2033 (Grand View Research); the longer Fact.MR horizon reaches ~$9.6–10B by 2035.
@@ -962 @@
-- **Calculation Logic**: Applying the segmentation ratios to the $5.1 billion baseline \[CHAPTER: Opportunity Validation\]:
+- **Calculation Logic**: Applying the segmentation ratios using the $5.1B upper bound of the established range \[CHAPTER: Opportunity Validation\]:
@@ -1218 @@
-- The global oxygen concentrator market is valued at approximately $5 billion in 2025, projected to reach $8.31 billion by 2033 (approaching $10 billion by 2035 on the extended Fact.MR horizon).
+- The global oxygen concentrator market is valued at $4.85–5.1B (2024/25; sources vary), projected to reach $8.31 billion by 2033 (Grand View Research); the longer Fact.MR horizon reaches ~$9.6–10B by 2035.
@@ -2111 @@
-*   **Inogen (Medical Benchmark)**: Reports gross margins consistent with the targets cited in Market Pricing Dynamics <links>. Notably, these margins compressed by 182 basis points …
+*   **Inogen (Medical Benchmark)**: Reports ~44.7% gross margin, within the 40–50% target band <links>. Notably, these margins compressed by 182 basis points …
@@ -2412 @@
-| Optimistic | $3,500 | 50% | $1,750 | $800 | Immediate | 2.2x | ✅ Viable |
+| Optimistic | $3,500 | 50% | $1,750 | $800 (optimistic scenario) | Immediate | 2.2x | ✅ Viable |
@@ +2416 (insert) @@
+*Note: benchmark blended CAC ~$1,200 (Inogen 2024); $800 represents the channel-advantage scenario.*
@@ -2511 @@
-| CAC | N/A | $1,500 | $800 | **Analyst** | 2 | Base | High initial friction; assumes HVAC channel efficiency kicks in Y3. |
+| CAC | N/A | $1,500 | $800 | **Analyst** | 2 | Base | High initial friction; assumes HVAC channel efficiency kicks in Y3 — benchmark blended CAC ~$1,200 (Inogen 2024); $800 represents the channel-advantage scenario. |
@@ -2553 @@
-- **Reality Check**: To hit Y3 target (800 units), Daikin needs ~2 dedicated sellers or significant channel activation.
+- **Reality Check**: To hit Y3 target (800 units), Daikin needs ~2 dedicated sellers or significant channel activation. The Y3 target of 800 units is an interim ramp milestone; the ~2,700 units/year run-rate is the 2030 steady-state requirement.
@@ -2559 @@
-- **Base**: Revenue $2.0M. GM 40%. CAC $800. (Assumes successful pilot, moderate adoption).
+- **Base scenario**: Revenue $2.0M. GM 40%. CAC $800. (Assumes successful pilot, moderate adoption).
```

(Three long lines abbreviated with `…` for readability here only — the verbatim full-line
diff is in `scripts/phase-e/make-v13-output.txt`, and every replacement was exact-match
asserted, so the abbreviations cannot hide an unintended change.)
