# Fix Timeline — Git History Findings (Phase 1, Step 1)

**⚠️ FLAGGED FOR CARSON'S REVIEW — none of the four fixes can be dated from git.**

The repository history was squashed: commit `0164163` ("Baseline: full V3 working tree",
2026-06-02 19:04:57 +0200 / 17:04:57 UTC) is the first commit containing any application
code (the two 2026-05-29 "first commit" commits contain only README.md). All four fixes
are **already present in that baseline**, verified by inspecting the baseline tree:

| Fix | Evidence in baseline `0164163` | Datable from git? |
|---|---|---|
| 1. Temperature 1.0 → 0 | `lib/openrouter.ts` already has `temperature: params.temperature ?? 0` with "Default 0" comment | **No** — predates history |
| 2. Similarity threshold 0.85 → 0.70 | `lib/redundancy/cluster.ts` already has `SIMILARITY_THRESHOLD = 0.70` | **No** — but per-run ground truth exists (see below) |
| 3. Cluster cap (top-5) removal | `lib/redundancy/metrics.ts` already carries the "intentionally UNCAPPED" note; no `slice(0, 5)` | **No** — predates history |
| 4. Docx parse: `extractRawText` → `convertToHtml` + h1–h6 markdown | `lib/ingest/parseFile.ts` already uses `mammoth.convertToHtml` with the fix comment | **No** — predates history |

This is independently confirmed by the project's own `lib/redundancy/version.ts`
(added in `0a679c3`, 2026-06-10), which states the version boundaries are "grounded in
the stored per-run `threshold` field … NOT git history, which was squashed into the
single 2026-06-02 'Baseline: full V3 working tree' commit and so cannot date these changes."

## Full commit list (entire history)

| Hash | Datetime (UTC) | Message |
|---|---|---|
| `d9df6a9` | 2026-05-29 12:54:34 | first commit (README only) |
| `56502c2` | 2026-05-29 12:56:07 | first commit (README only) |
| `50ba309` | 2026-05-29 13:00:15 | Merge (README only) |
| `0164163` | 2026-06-02 17:04:57 | Baseline: full V3 working tree — **all four fixes already in place** |
| `5ce1c66` | 2026-06-02 17:11:15 | Stop tracking _dev.log |
| `0a679c3` | 2026-06-10 09:40:55 | Harden embedding failure path, run provenance + analysis-set labeling |
| `b25218f` | 2026-06-10 14:27:09 | Inngest concurrency cap; framing-only risk identification + durable framing link |

Note: runs scored on 2026-06-02 *before* 17:04 UTC (e.g. run 25 at 14:41 UTC) ran against
the uncommitted working tree, so even the baseline commit time is not a valid code-in-use
boundary for that day.

## How the dataset's fix-era flags were therefore populated

Per the task instruction ("flag for Carson's review rather than picking one silently")
and the gap rule ("leave the corresponding dataset column null — do not improvise"):

| Flag | Population rule | Basis |
|---|---|---|
| `postTempFix` | **null for all runs** | Undatable; temperature also not persisted per run. |
| `postThresholdFix` | `RedundancyAnalysis.threshold == 0.70` → true; `0.85` → false; no redundancy row → null | **Data-derived, not date-derived** — the stored per-run threshold is ground truth for which code the run actually executed (stronger than any commit date). 5 runs false, 37 true, 1 null. |
| `postCapRemoval` | **null for all runs** | Undatable. `favoriteFriendsCount > 5` would prove post-removal for a given run, but ≤ 5 proves nothing; no per-run marker exists. |
| `postDocxFix` | **null for all runs** | Undatable. Observational evidence Carson may use: docx memos parsed pre-fix collapse to `chapterCount = 1` (e.g. the anchor run 25, Daikin docx, 1 chapter), and memo "Daikin_Last_Gen_docx_refix" (run 34, scored 2026-06-02 15:43 UTC, 15 chapters) suggests the fix landed midday 2026-06-02. The 2026-06-10 memory note records a conservative boundary of "June-2 vs June-8 docx runs". Not encoded into the flag — review needed. |

If Carson can supply external dates (chat logs, session notes) for fixes 1, 3, 4, the
flags can be recomputed from `runs.json` without touching the database.
