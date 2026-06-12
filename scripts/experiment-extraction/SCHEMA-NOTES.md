# Schema Discovery Notes — Experiment Dataset Extraction (Phase 1)

Source of truth: `prisma/schema.prisma` (read 2026-06-11, not modified). Verified against
live data with read-only probes (43 ScoringRun rows, 40 Memo rows, 42 RedundancyAnalysis
rows, 54 Framing rows).

## Model → dataset field mapping

### Scoring runs — `ScoringRun`
| Dataset field | Schema field | Notes |
|---|---|---|
| `runId` | `ScoringRun.id` (Int) | |
| `runTimestamp` | `ScoringRun.scoredAt` (DateTime) | |
| status | `ScoringRun.statusBadge` (enum READY_TO_SHIP / NEEDS_WORK / MAJOR_REWORK) | |
| `memoReadiness` | `ScoringRun.memoConfidence` (Float) | Older "Confidence" naming retained internally; rename was display-layer only. |
| `decisionReadiness` | `ScoringRun.decisionConfidence` (Float) | Equal to memoConfidence in v1.0 (riskMultiplier held at 1.0). |
| `modelId` | `ScoringRun.scoringModel` (String?) | Nullable; only populated on runs after the 2026-06-10 provenance change (21 of 43 runs). |
| `temperature` | **NOT PERSISTED** | No temperature column anywhere. Column is null for all runs. **GAP.** |
| — | `ScoringRun.redundancyVersion` (String?) | Provenance stamp: `0.85-legacy` / `0.70-preclusterdrop` / `0.70-reconciled` / null. Included as extra column — it is the project's own taxonomy for SRI comparability. |
| — | `ScoringRun.includeInAnalysis` (Boolean?), `dataNote` (String?) | Curation labels from the 2026-06-10 stabilization; included as extra columns. |
| framing link | `ScoringRun.framingId` (Int?) | **Only populated on runs created after commit b25218f (2026-06-10).** Earlier runs had an ephemeral framing link that is not recoverable — `framingDocPresent=false` for them means "no durable link", not "no framing was used". **GAP** (recorded in summary). |

### Memo identity — `Memo`
| Dataset field | Schema field | Notes |
|---|---|---|
| `memoName` | `Memo.name` (String) | Uploaded filename (e.g. `Zebrav3.docx`); a few names lack extensions (e.g. `Daikin_Last_Gen_docx_refix`). |
| `memoIdentity` | derived: `Memo.name` trimmed + lowercased | Reruns of the same memo were uploaded as separate Memo rows with identical names (e.g. `Ecolab_Parallel_Gen.md` exists as 5 Memo rows). Filename is the only dedup key available. No content-hash dedup attempted (out of scope; would be interpretation). |
| `typology` | `Memo.typology` (enum ONE_A / ONE_B / TWO_A / TWO_B) | **Schema has NO 2C value** (task mentioned 1A/1B/2A/2B/2C). Mapped to display form 1A/1B/2A/2B. **GAP: 2C does not exist.** |
| `inputFileType` | derived from `Memo.name` extension | `docx` / `md` / `pdf` / `unknown` (no extension). The DB does not store a file-type field; raw upload files are not persisted — only parsed `content` (String?) and `chapters` (Json). |
| `chapterCount` | `Memo.chapters` (Json array) length | Array of `{title, text, scored}`. Note: pre-docx-fix parses collapse a whole docx into 1 chapter. |

### Dimension scores — `DimensionScore`
13 rows per run; `dimensionKey` enum is exactly `P1…P8, D1…D5`. Dataset uses
`DimensionScore.score` (Float). Also available but not extracted as columns:
`serverComputed`, `agentSelfReported`, `calibrationDrift`, `subScores`, `traceabilityLog`.

### Risks — `ConfirmedRisk`
Per-run rows with `severity` (CRITICAL / HIGH / MEDIUM), `approved` (Boolean),
`classification`, `source`, `addressedStatus`. Dataset columns:
`criticalRiskCount` (severity=CRITICAL, all rows), `highRiskCount`, `mediumRiskCount`,
plus `approvedCriticalCount` for clarity. Risk Gate stores top-5 per run.

### Redundancy — `RedundancyAnalysis` (1:1 with ScoringRun, 42 of 43 runs have one)
| Dataset field | Schema field | Notes |
|---|---|---|
| `sriStored` | `sri` (Float) | |
| `claimCount` | `claimCount` (Int) | Total atomic claims extracted. |
| — | `uniqueClusterCount` (Int) | Included as extra column; needed to compute clustered claims. |
| — | `threshold` (Float) | Cosine threshold actually used by that run (0.85 or 0.70). Ground truth for the threshold-fix era flag. |
| `favoriteFriendsCount` | `favoriteFriends` (Json) array length | `FavoriteFriend[]`: `{rank, label, assertionCount, chapterSpread, chapters, instances:[{chapter,text}]}`. **Only repeated clusters (assertionCount > 1) are stored. Singleton clusters are NOT persisted** (no text, no IDs). |
| `clusteredClaimCount` | **derived**: `sum(favoriteFriends[].assertionCount) + (uniqueClusterCount − favoriteFriends.length)` | Each non-stored cluster is a singleton contributing exactly 1 claim. This reconstructs the total claims present in cluster data. |
| `claimCountMismatch` | derived: `claimCount != clusteredClaimCount` | Flags the known favorites-gap / pre-clustering claim-drop issue. |
| claim records | **NOT PERSISTED** | There is no Claim table. Individual claims exist only inside `favoriteFriends[].instances` (repeated clusters only). **GAP**: singleton claim text is unrecoverable from the DB. |
| embeddings | **NOT PERSISTED** | Embeddings are computed in-memory during scoring (`lib/redundancy/embed.ts`) and discarded. No embedding column or flag exists. `hasEmbedding` is `null` (unknown) for every claim in `claims.json`. **GAP.** |
| cluster assignments | partially persisted | Only via `favoriteFriends` membership. `clusterId` in `claims.json` is a synthetic ID (`run{runId}-cl{rank}`), not a DB key. |
| — | `analysisStatus`, `errorMessage` | Included as extra columns (`completed` for all 42 existing rows). |

### Framing documents — `Framing`
`Framing.content` (String) is **already-parsed text** for all source types
(DOCX / WIZARD / CHAT) — raw .docx bytes are not stored, so no mammoth extraction is
needed in Step 4; the stored text is exported directly. `Framing.name`, `sourceType`,
`typology?` available. Linked to runs only via `ScoringRun.framingId` (8 of 43 runs).

## Expected-but-missing data (gaps)
1. **Temperature** — not persisted per run → column null for all 43 runs.
2. **Per-claim records / embeddings** — no Claim table, no embedding storage; only repeated-cluster instances inside `favoriteFriends` JSON. `hasEmbedding` = null everywhere; singleton claims absent from `claims.json`.
3. **Typology 2C** — enum has only ONE_A / ONE_B / TWO_A / TWO_B.
4. **Input file type / raw upload file** — not stored; derived from filename extension.
5. **Framing link on pre-2026-06-10 runs** — `framingId` null even where a framing was actually used (link was ephemeral; commit b25218f made it durable for new runs only).
6. **`scoringModel` null on 22 of 43 runs** — provenance column added 2026-06-10, backfilled only on new runs.
7. **1 run with no RedundancyAnalysis row** — redundancy fields null for it; listed in summary gaps.
