import { inngest } from "../client";
import { prisma } from "@/lib/db";
import { callModelJSON, SCORING_MODEL } from "@/lib/openrouter";
import { splitChapters } from "@/lib/ingest/splitChapters";
import { buildMemoContext, estimateTokens } from "@/lib/memoContext";
import { buildTier1Prompt } from "@/lib/prompts/tier1";
import { buildTier2Prompt } from "@/lib/prompts/tier2";
import { buildTier3P7Prompt } from "@/lib/prompts/tier3-p7";
import { runAllScoring } from "@/lib/scoring/index";
import { verifyScoring } from "@/lib/scoring/verify";
import { deriveSpecificGap, buildEditGenerationPrompt } from "@/lib/scoring/editGeneration";
// Redundancy (Phase R1) — informational only, never touches scoring tables
import { extractAllClaims } from "@/lib/redundancy/extractClaims";
import { embedTexts } from "@/lib/redundancy/embed";
import { clusterClaims, SIMILARITY_THRESHOLD } from "@/lib/redundancy/cluster";
import { computeMetrics } from "@/lib/redundancy/metrics";
import { REDUNDANCY_VERSION } from "@/lib/redundancy/version";
import {
  memoConfidence,
  decisionConfidence,
  stage2Profile,
  statusBadge,
} from "@/lib/confidence/index";
import type {
  Tier1ChapterOutput,
  Tier2SynthesisOutput,
  Tier3P7Output,
  AllClassifications,
  ApprovedRisk,
  DimensionResult,
} from "@/lib/prompts/types";

interface ScoreMemoPayload {
  memoId: number;
  framingId: number;
  typology: string;
  approvedRisks: ApprovedRisk[];
  /** Set by /api/score when the caller explicitly opted into an empty risk set.
   *  Persistence-labeling only — never read by any scoring step. */
  allowEmptyRisks?: boolean;
}

// Max scoreMemo runs allowed to execute simultaneously. This caps PARALLELISM
// only — it does not affect how any single run is computed. 2 is a safe floor
// for the local dev server; raise once batch scoring runs against a production
// build.
const SCORE_MEMO_CONCURRENCY = 2;

type GapRow = {
  dimensionKey: string;
  issue: string;
  impact: string;
  fix: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
};

// ─── Completeness metadata (measurement only — never a score input) ──────────
// The 10 canonical scorable chapters. Counted against parsed chapter titles
// after normalization; the count is persisted to ScoringRun.scorableChapterCount
// for display. Does NOT alter the parse output or what gets scored.
const SCORABLE_CHAPTER_SET = [
  "customer and demand validation",
  "product and technology",
  "market research",
  "competitor analysis",
  "gtm and partners",
  "revenue model",
  "unit economics",
  "finance and operations",
  "team and execution",
  "legal and ip",
];

function normalizeChapterTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Count how many of the 10 canonical scorable chapters appear among the parsed
 *  chapter titles (each canonical chapter counted at most once). */
function countScorableChapters(titles: string[]): number {
  const normalized = titles.map(normalizeChapterTitle);
  return SCORABLE_CHAPTER_SET.filter((target) =>
    normalized.some((t) => t.includes(target))
  ).length;
}


/**
 * Derive Gaps from traceabilityLog findings — NOT from score numbers alone.
 * Each gap issue/fix is grounded in what the engine actually found, matching
 * what the Breakdown tab surfaces.
 */
function deriveGaps(dimensionResults: DimensionResult[]): GapRow[] {
  const gaps: GapRow[] = [];
  const stage1Keys = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];

  for (const dr of dimensionResults) {
    if (!stage1Keys.includes(dr.dimensionKey)) continue;
    if (dr.serverComputed === null) continue;
    const score = dr.serverComputed;
    if (score >= 4.0) continue; // no gap for well-scoring pillars

    const specific = deriveSpecificGap(dr);
    if (!specific) continue;

    gaps.push({
      dimensionKey: dr.dimensionKey,
      issue: specific.issue,
      impact: specific.impact,
      fix: specific.fix,
      severity: specific.severity,
    });
  }

  // Sort by severity (HIGH first) then by erosion (largest first)
  return gaps.sort((a, b) => {
    const sevOrd: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const sd = (sevOrd[a.severity] ?? 9) - (sevOrd[b.severity] ?? 9);
    if (sd !== 0) return sd;
    const scoreA = dimensionResults.find((d) => d.dimensionKey === a.dimensionKey)?.serverComputed ?? 3;
    const scoreB = dimensionResults.find((d) => d.dimensionKey === b.dimensionKey)?.serverComputed ?? 3;
    return scoreA - scoreB; // lower score → more erosion → first
  });
}

export const scoreMemo = inngest.createFunction(
  {
    id: "score-memo",
    name: "Score Memo",
    // Function-level concurrency cap: at most SCORE_MEMO_CONCURRENCY runs
    // execute at once; additional events queue and drain. Does not alter
    // per-run computation.
    concurrency: { limit: SCORE_MEMO_CONCURRENCY },
    triggers: [{ event: "memo/score.requested" }],
  },
  async ({ event, step }: { event: { data: ScoreMemoPayload }; step: {
    run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
  } }) => {
    const { memoId, framingId, typology, approvedRisks } = event.data;

    // ─── Step 1: Load inputs ─────────────────────────────────────────────────
    // IMPORTANT: This step result is cached in the Inngest run journal.
    // We throw on bad data here so the step NEVER completes with an invalid
    // memoContent — a cached empty/framing result would poison every retry.
    const { framing, framingId: resolvedFramingId, benchmarkRows, memoContent } = await step.run(
      "load-inputs",
      async () => {
        const framingRecord = await prisma.framing.findUniqueOrThrow({
          where: { id: framingId },
        });

        const benchmarkTypologyMap: Record<string, string> = {
          ONE_A: "ONE_A",
          ONE_B: "ONE_B",
          TWO_A: "TWO_A",
          TWO_B: "TWO_B",
        };

        const benchmarkTypology = benchmarkTypologyMap[typology] ?? typology;

        const benchmarks = await prisma.benchmarkEntry.findMany({
          where: {
            typology: {
              in: [benchmarkTypology as never, "CROSS" as never],
            },
          },
        });

        const memoRecord = await prisma.memo.findUniqueOrThrow({ where: { id: memoId } });
        const content = memoRecord.content ?? "";

        // ── Input-integrity guard ────────────────────────────────────────────
        // Throw before the step can cache bad data.  A memo shorter than 500
        // chars is either empty or a framing document mis-routed as the memo.
        if (content.length < 500) {
          throw new Error(
            `load-inputs: memo ${memoId} content is ${content.length} chars — ` +
            `expected a full memo (min 500 chars). Aborting so this result is ` +
            `not cached. Check that memoId and framingId were not swapped.`
          );
        }

        // Guard against memo and framing being swapped: the framing is always
        // smaller than a real memo, so if they have similar lengths, flag it.
        if (content.length <= framingRecord.content.length * 2) {
          throw new Error(
            `load-inputs: memo ${memoId} (${content.length} chars) is not ` +
            `significantly longer than framing ${framingId} ` +
            `(${framingRecord.content.length} chars). ` +
            `Possible memoId/framingId swap — aborting.`
          );
        }

        return {
          framing: framingRecord,
          framingId,
          benchmarkRows: benchmarks,
          memoContent: content,
        };
      }
    );

    // ─── Step 2: Tier 1 — per-chapter analysis ───────────────────────────────
    // Always re-split from memo.content using the canonical splitChapters so the
    // engine is never coupled to whatever chapters value was stored in the DB at
    // upload time (which may have been produced by an older splitter).
    const allChapters = splitChapters(memoContent);

    // Post-split integrity check (outside the step — runs every replay).
    // This catches any case where the cached memoContent slipped through the
    // guard above (e.g. an older cached journal entry from before this guard).
    if (allChapters.length === 0 || allChapters.every((c) => !c.text.trim())) {
      throw new Error(
        `Memo ${memoId} produced no chapter content after splitting ` +
        `(${allChapters.length} chapters, all empty). ` +
        `Delete this Inngest run and re-submit from a fresh event.`
      );
    }

    // Only scored chapters get a Tier-1 LLM step.
    // Non-scored sections (Financial Appendix, Six-T/Risk Analysis) are passed
    // to Tier 2 as full-memo context but do not generate per-chapter scores.
    const scoredChapters = allChapters.filter((c) => c.scored);

    if (scoredChapters.length === 0) {
      throw new Error(
        `Memo ${memoId} has ${allChapters.length} chapters but none are scored. ` +
        `Check splitChapters isNonScored logic.`
      );
    }

    void resolvedFramingId; // carried through for future traceability

    const tier1Results: Tier1ChapterOutput[] = [];

    for (let i = 0; i < scoredChapters.length; i++) {
      const chapter = scoredChapters[i];
      const chapterResult = await step.run(
        // Use stable index over scored chapters — step IDs must not shift if
        // non-scored chapter count changes.
        `tier1-chapter-${i}`,
        async () => {
          const isExecSummary =
            chapter.title.toLowerCase().includes("executive summary") ||
            chapter.title.toLowerCase().includes("exec summary");

          const prompt = buildTier1Prompt({
            framingContent: framing.content,
            chapterText: chapter.text,
            chapterIndex: i,
            isExecSummary,
          });

          return await callModelJSON<Tier1ChapterOutput>({
            system: prompt.system,
            messages: prompt.messages,
          });
        }
      );

      tier1Results.push(chapterResult);
    }

    // ─── Step 3: Tier 2 — synthesis ─────────────────────────────────────────
    const tier2Result = await step.run("tier2-synthesis", async () => {
      // Tier-2 also embeds the tier1Results JSON, so reserve tokens for it.
      const tier1JsonTokens = estimateTokens(JSON.stringify(tier1Results));
      const tier2Ctx = buildMemoContext(
        framing.content,
        memoContent,
        allChapters,
        tier1JsonTokens
      );
      const prompt = buildTier2Prompt({
        framingContent: framing.content,
        tier1Results,
        fullMemoContent: tier2Ctx.content,
        typology,
      });

      return await callModelJSON<Tier2SynthesisOutput>({
        system: prompt.system,
        messages: prompt.messages,
      });
    });

    // ─── Step 4: Tier 3 — P7 Output Realism ─────────────────────────────────
    const tier3P7Result = await step.run("tier3-p7", async () => {
      const tier3Ctx = buildMemoContext(framing.content, memoContent, allChapters);
      const prompt = buildTier3P7Prompt({
        framingContent: framing.content,
        fullMemoContent: tier3Ctx.content,
        benchmarkRows: benchmarkRows.map((r) => ({
          id: r.id,
          typology: String(r.typology),
          metric: r.metric,
          plausibleRange: r.plausibleRange,
          boundaryRange: r.boundaryRange,
          outOfRange: r.outOfRange,
          sources: r.sources,
        })),
        typology,
      });

      return await callModelJSON<Tier3P7Output>({
        system: prompt.system,
        messages: prompt.messages,
      });
    });

    // ─── Step 5: Server scoring ──────────────────────────────────────────────
    const dimensionResults = await step.run("server-scoring", async () => {
      const allClassifications: AllClassifications = {
        tier1Chapters: tier1Results,
        tier2: tier2Result,
        tier3P7: tier3P7Result,
      };

      return runAllScoring(allClassifications);
    });

    // ─── Step 6: Confidence & status ─────────────────────────────────────────
    const confidenceData = await step.run("confidence-status", async () => {
      const stage1Results = dimensionResults.filter((dr: DimensionResult) =>
        ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"].includes(dr.dimensionKey)
      );
      const stage2Results = dimensionResults.filter((dr: DimensionResult) =>
        ["D1", "D2", "D3", "D4", "D5"].includes(dr.dimensionKey)
      );

      const stage1Scores = stage1Results.map((dr: DimensionResult) => dr.serverComputed ?? 1);
      const stage2Scores = stage2Results.map((dr: DimensionResult) => dr.serverComputed ?? 1);

      const memoConf = memoConfidence(stage1Scores);
      const decisionConf = decisionConfidence(memoConf, 1.0);
      const s2Profile = stage2Profile(stage2Scores);

      const gaps = deriveGaps(dimensionResults);
      const edits: GapRow[] = []; // edits generated in a separate LLM step below
      const badge = statusBadge(
        memoConf,
        gaps.map((g: GapRow) => ({ severity: g.severity }))
      );

      const stage1Avg =
        stage1Scores.reduce((a: number, b: number) => a + b, 0) / stage1Scores.length;
      const stage2Avg =
        stage2Scores.length > 0
          ? stage2Scores.reduce((a: number, b: number) => a + b, 0) / stage2Scores.length
          : 0;

      const diagnostics = verifyScoring(dimensionResults);

      return {
        memoConf,
        decisionConf,
        s2Profile,
        badge,
        stage1Avg,
        stage2Avg,
        gaps,
        edits,
        diagnostics,
      };
    });

    // ─── Step 7: Generate concrete Edits (LLM, temp 0) ───────────────────────
    // Reads final scores + traceabilityLogs + memo content.
    // Writes ONLY Edit rows — never alters any DimensionScore (AG-C5).
    const generatedEdits = await step.run("generate-edits", async () => {
      const PILLAR_NAMES: Record<string, string> = {
        P1: "Coherence", P2: "Problem Formulation", P3: "Structural Accuracy",
        P4: "Coverage", P5: "Evidence Quality", P6: "Assumption Quality",
        P7: "Output Realism", P8: "Solution Quality",
      };
      const EDIT_THRESHOLD = 4.0;
      const stage1Keys = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const lowScoring = dimensionResults.filter(
        (dr) =>
          stage1Keys.includes(dr.dimensionKey) &&
          dr.serverComputed !== null &&
          dr.serverComputed < EDIT_THRESHOLD
      );

      if (lowScoring.length === 0) return [];

      // Use scored chapters only for prompt (keeps the prompt manageable)
      const memoCtx = buildMemoContext(
        "",           // no framing needed for edits
        memoContent,
        allChapters,
        0
      );
      const prompt = buildEditGenerationPrompt(lowScoring, memoCtx.content, PILLAR_NAMES);

      let raw: { edits?: unknown[] } = { edits: [] };
      try {
        raw = await callModelJSON<{ edits?: unknown[] }>({
          system: prompt.system,
          messages: prompt.messages,
        });
      } catch {
        // Edit generation failure is non-fatal — return empty (gaps still exist)
        return [];
      }

      const editRows: GapRow[] = (raw.edits ?? [])
        .filter((e): e is Record<string, unknown> => e != null && typeof e === "object")
        .map((e) => ({
          dimensionKey: String(e.dimensionKey ?? "P1"),
          issue: String(e.issue ?? ""),
          impact: String(e.impact ?? ""),
          fix: String(e.fix ?? ""),
          severity: (["HIGH", "MEDIUM", "LOW"].includes(String(e.severity))
            ? e.severity
            : "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
        }))
        .filter((e) => e.issue && e.fix); // drop empty entries

      return editRows;
    });

    // ─── Step 8: Check critical-risk coverage (informational, temp 0) ───────────
    // For each approved CRITICAL risk, classify whether the memo addresses it.
    // Writes ONLY to ConfirmedRisk.addressedStatus + addressedNote — never
    // touches any DimensionScore or confidence value (AG-C5).
    // This is the v1.5 bridge: the same signal the future suppressor will consume,
    // surfaced now as read-only information for the scorer.
    type AddressedResult = { statement: string; status: string; note: string };
    const criticalRiskChecks = await step.run("check-critical-risks", async () => {
      const criticalApproved = approvedRisks.filter(
        (r) => r.approved && r.severity === "CRITICAL"
      );
      if (criticalApproved.length === 0) return [] as AddressedResult[];

      const memoCtx = buildMemoContext("", memoContent, allChapters, 0);
      const results: AddressedResult[] = [];

      for (const risk of criticalApproved) {
        const system = `You are assessing whether a decision memo addresses a specific critical risk.
Your classification must follow these mechanical definitions:
- ADDRESSED: The memo contains an explicit mitigation, contingency, action plan, or analysis that directly engages with this risk's subject matter. The risk's core concern is acknowledged and a concrete response is stated (e.g. a named action, a kill condition tied to this risk, an analysis of the risk's likelihood/impact).
- PARTIAL: The memo acknowledges the risk area or has some related analysis, but the response is incomplete, vague, or only tangentially addresses the concern without a concrete mitigation.
- NOT_ADDRESSED: The memo does not meaningfully engage with this risk — it is absent from the analysis, or merely listed without any mitigation, action, or substantive analysis.

Return ONLY valid JSON: { "status": "ADDRESSED" | "PARTIAL" | "NOT_ADDRESSED", "note": "<one sentence: cite where in the memo this risk is addressed, or explain why it is not>" }`;

        const userContent = `CRITICAL RISK: "${risk.statement}"

MEMO CONTENT:
---
${memoCtx.content.slice(0, 60_000)}
---

Classify how well this memo addresses the critical risk above. Return the JSON object only.`;

        let result: AddressedResult = {
          statement: risk.statement,
          status: "NOT_ADDRESSED",
          note: "Classification could not be completed.",
        };

        try {
          const raw = await callModelJSON<{ status: string; note: string }>({
            system,
            messages: [{ role: "user", content: userContent }],
          });
          result = {
            statement: risk.statement,
            status: ["ADDRESSED", "PARTIAL", "NOT_ADDRESSED"].includes(raw.status)
              ? raw.status
              : "NOT_ADDRESSED",
            note: String(raw.note ?? "").slice(0, 500),
          };
        } catch {
          // Non-fatal — leave as NOT_ADDRESSED with generic note
        }

        results.push(result);
      }

      return results;
    });

    // ─── Step 9: Persist ──────────────────────────────────────────────────────
    const scoringRunId = await step.run("persist", async () => {
      const {
        memoConf,
        decisionConf,
        badge,
        stage1Avg,
        stage2Avg,
        gaps,
        edits: _unusedEdits, // edits now come from generatedEdits
        diagnostics,
      } = confidenceData;

      const result = await prisma.$transaction(async (tx) => {
        const scoringRun = await tx.scoringRun.create({
          data: {
            memoId,
            framingId, // durable link to the framing that produced this run (from event.data)
            rubricVersion: "V3 v1.0",
            scoringModel: SCORING_MODEL,
            redundancyVersion: REDUNDANCY_VERSION,
            memoConfidence: memoConf,
            decisionConfidence: decisionConf,
            riskMultiplier: 1.0,
            statusBadge: badge as "READY_TO_SHIP" | "NEEDS_WORK" | "MAJOR_REWORK",
            stage1Avg,
            stage2Avg,
            // Completeness metadata — measured from the parsed chapter titles
            // (allChapters is in scope from Step 2). Display only.
            scorableChapterCount: countScorableChapters(allChapters.map((c) => c.title)),
            // Self-labeling for Risk-Gate-bypassed runs (empty approvedRisks): zero
            // ConfirmedRisk rows on such runs mean "risk data missing", not "no risks
            // found" — stamp that at creation. Metadata only; no score input.
            ...(approvedRisks.length === 0 && { dataNote: "risk gate bypassed" }),
          },
        });

        for (const dr of dimensionResults) {
          await tx.dimensionScore.create({
            data: {
              scoringRunId: scoringRun.id,
              dimensionKey: dr.dimensionKey as never,
              // null = NOT_SCORED, persisted as null (the old ?? -1 sentinel
              // leaked an out-of-range value into stored scores — see run 26 P7)
              score: dr.score,
              subScores: dr.subScores as never,
              traceabilityLog: dr.traceabilityLog as never,
              serverComputed: dr.serverComputed,
              agentSelfReported: dr.agentSelfReported,
              calibrationDrift: dr.calibrationDrift,
            },
          });
        }

        for (const risk of approvedRisks) {
          // Look up the addressed-check result for this risk (CRITICAL only)
          const addressedResult = criticalRiskChecks.find(
            (c) => c.statement === risk.statement
          );
          await tx.confirmedRisk.create({
            data: {
              scoringRunId: scoringRun.id,
              statement: risk.statement,
              classification: risk.classification as never,
              source: risk.source as never,
              severity: risk.severity as never,
              approved: risk.approved,
              // Only set for CRITICAL risks; null for all others
              addressedStatus: addressedResult?.status ?? null,
              addressedNote: addressedResult?.note ?? null,
            },
          });
        }

        for (const gap of gaps) {
          await tx.gap.create({
            data: {
              scoringRunId: scoringRun.id,
              dimensionKey: gap.dimensionKey as never,
              issue: gap.issue,
              impact: gap.impact,
              fix: gap.fix,
              severity: gap.severity as never,
            },
          });
        }

        // Edits come from the separate generate-edits step (not confidenceData.edits)
        for (const edit of generatedEdits) {
          await tx.edit.create({
            data: {
              scoringRunId: scoringRun.id,
              dimensionKey: edit.dimensionKey as never,
              issue: edit.issue,
              impact: edit.impact,
              fix: edit.fix,
              severity: edit.severity as never,
            },
          });
        }

        for (const diag of diagnostics) {
          await tx.diagnostic.create({
            data: {
              scoringRunId: scoringRun.id,
              type: diag.type as "ERROR" | "CALIBRATION_WARNING",
              message: `[${diag.dimension}] ${diag.message}`,
            },
          });
        }

        for (const dr of dimensionResults) {
          if (
            dr.calibrationDrift &&
            dr.serverComputed !== null &&
            dr.agentSelfReported !== null
          ) {
            const drift = Math.abs(dr.serverComputed - dr.agentSelfReported);
            const alreadyAdded = diagnostics.some(
              (d) =>
                d.type === "CALIBRATION_WARNING" &&
                d.dimension === dr.dimensionKey
            );
            if (!alreadyAdded) {
              await tx.diagnostic.create({
                data: {
                  scoringRunId: scoringRun.id,
                  type: "CALIBRATION_WARNING",
                  message: `[${dr.dimensionKey}] Calibration drift: server=${dr.serverComputed.toFixed(2)}, agent=${dr.agentSelfReported.toFixed(2)}, drift=${drift.toFixed(2)}`,
                },
              });
            }
          }
        }

        return scoringRun.id;
      });

      return result;
    });

    // ─── Step 10: Redundancy analysis (Phase R1 — informational, non-blocking) ─
    // Runs AFTER persist so a failure here NEVER affects scoring output.
    // Writes ONLY to RedundancyAnalysis — no DimensionScore or confidence touched.
    await step.run("redundancy-analysis", async () => {
      try {
        // Use scored chapters only (same set the scoring engine uses for Tier-1)
        const scoredChapters = allChapters.filter((c) => c.scored);
        if (scoredChapters.length === 0) {
          await prisma.redundancyAnalysis.create({
            data: {
              scoringRunId,
              sri: 0,
              claimCount: 0,
              uniqueClusterCount: 0,
              threshold: SIMILARITY_THRESHOLD,
              favoriteFriends: [],
              analysisStatus: "skipped",
              errorMessage: "No scored chapters found",
            },
          });
          return;
        }

        // 1. Extract atomic claims from each scored chapter
        const claims = await extractAllClaims(
          scoredChapters.map((c) => ({ title: c.title, text: c.text }))
        );

        if (claims.length === 0) {
          await prisma.redundancyAnalysis.create({
            data: {
              scoringRunId,
              sri: 0,
              claimCount: 0,
              uniqueClusterCount: 0,
              threshold: SIMILARITY_THRESHOLD,
              favoriteFriends: [],
              analysisStatus: "skipped",
              errorMessage: "No claims extracted",
            },
          });
          return;
        }

        // 2. Embed all claims in one batched call
        const vectors = await embedTexts(claims.map((c) => c.text));
        const claimsWithEmbeddings = claims.map((c, i) => ({
          ...c,
          embedding: vectors[i] ?? [],
        }));

        // 3. Cluster by cosine similarity
        const clusters = clusterClaims(claimsWithEmbeddings, SIMILARITY_THRESHOLD);

        // 4. Compute SRI + favorite friends (pure server-side math)
        const metrics = computeMetrics(clusters, SIMILARITY_THRESHOLD);

        // 5. Persist — redundancy-scoped table only
        await prisma.redundancyAnalysis.create({
          data: {
            scoringRunId,
            sri: metrics.sri,
            claimCount: metrics.claimCount,
            uniqueClusterCount: metrics.uniqueClusterCount,
            threshold: metrics.threshold,
            favoriteFriends: metrics.favoriteFriends as never,
            perChapterGain: metrics.perChapterGain as never,
            analysisStatus: "completed",
          },
        });
      } catch (err) {
        // Log the FULL error (Prisma code/meta included) and re-throw.
        // A swallowed error here means Inngest marks the step green with no
        // record — exactly the silent-failure mode we are eliminating.
        const e = err as { name?: string; code?: string; message?: string; meta?: unknown; stack?: string };
        console.error("[redundancy] step failed:", {
          name: e?.name,
          code: e?.code,        // Prisma error code, if any
          message: e?.message,
          meta: e?.meta,        // Prisma: table/column/constraint detail
          stack: e?.stack?.slice(0, 1200),
        });
        throw err;              // surface to Inngest — do NOT swallow
      }
    });

    return {
      scoringRunId,
      memoConf: confidenceData.memoConf,
      decisionConf: confidenceData.decisionConf,
      badge: confidenceData.badge,
      stage1Avg: confidenceData.stage1Avg,
      stage2Avg: confidenceData.stage2Avg,
      diagnosticsCount: confidenceData.diagnostics.length,
    };
  }
);
