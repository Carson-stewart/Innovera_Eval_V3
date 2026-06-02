import { computeP1 } from "./stage1/p1";
import { computeP2 } from "./stage1/p2";
import { computeP3 } from "./stage1/p3";
import { computeP4 } from "./stage1/p4";
import { computeP5 } from "./stage1/p5";
import { computeP6 } from "./stage1/p6";
import { computeP7 } from "./stage1/p7";
import { computeP8 } from "./stage1/p8";
import { computeD1 } from "./stage2/d1";
import { computeD2 } from "./stage2/d2";
import { computeD3 } from "./stage2/d3";
import { computeD4 } from "./stage2/d4";
import { computeD5 } from "./stage2/d5";
import type { AllClassifications, DimensionResult } from "../prompts/types";

/**
 * Run all 13 dimension scoring functions in the correct order.
 * P4 runs before P8 so CovI is available for Move 8 (one-directional dependency per spec).
 *
 * Returns an array of 13 DimensionResult objects.
 */
export function runAllScoring(
  classifications: AllClassifications,
  agentSelfReportedScores?: Partial<Record<string, number>>
): DimensionResult[] {
  const asr = agentSelfReportedScores ?? {};

  const { tier1Chapters, tier2, tier3P7 } = classifications;

  // Aggregate agent self-reported scores from tier1 and tier2
  // (merged from all chapter agent_self_reported_scores)
  const mergedAsr: Record<string, number> = { ...asr } as Record<string, number>;
  for (const chapter of tier1Chapters) {
    for (const [k, v] of Object.entries(chapter.agent_self_reported_scores)) {
      if (!(k in mergedAsr) && typeof v === "number") mergedAsr[k] = v;
    }
  }
  for (const [k, v] of Object.entries(tier2.agent_self_reported_scores)) {
    if (!(k in mergedAsr) && typeof v === "number") mergedAsr[k] = v;
  }

  // Run P1–P6 (no cross-dependencies among these)
  const p1 = computeP1({
    tier1Chapters,
    tier2,
    agentSelfReported: mergedAsr["P1"] ?? null,
  });

  const p2 = computeP2({
    tier2,
    agentSelfReported: mergedAsr["P2"] ?? null,
  });

  const p3 = computeP3({
    tier2,
    agentSelfReported: mergedAsr["P3"] ?? null,
  });

  // P4 MUST run before P8 to produce CovI
  const p4 = computeP4({
    tier2,
    agentSelfReported: mergedAsr["P4"] ?? null,
  });

  const p5 = computeP5({
    tier1Chapters,
    agentSelfReported: mergedAsr["P5"] ?? null,
  });

  const p6 = computeP6({
    tier2,
    agentSelfReported: mergedAsr["P6"] ?? null,
  });

  const p7 = computeP7({
    tier3P7,
    agentSelfReported: mergedAsr["P7"] ?? null,
  });

  // P8 consumes CovI from P4 (AG-P8.1)
  const p8 = computeP8({
    tier2,
    covi: p4.covi,
    agentSelfReported: mergedAsr["P8"] ?? null,
  });

  // Stage 2 dimensions
  // D1: needs verdictPlacement — derive from d3 salience_placement or d5 verdict_clarity
  // We map salience_placement to verdictPlacement classification
  const saliencePlacement = tier2.d3.salience_placement;
  const verdictPlacement = (() => {
    if (
      saliencePlacement === "verdict-first-quantified" ||
      saliencePlacement === "verdict-first"
    )
      return "front-loaded" as const;
    if (saliencePlacement === "suboptimal") return "present-not-front" as const;
    if (saliencePlacement === "near-end") return "buried" as const;
    return "absent" as const;
  })();

  const d1 = computeD1({
    tier1Chapters,
    verdictPlacement,
    agentSelfReported: mergedAsr["D1"] ?? null,
  });

  // D2: chapterPrefixType derived from tier1 chapters (look for exec summary prefix)
  const hasExecSummaryPrefix = tier1Chapters.some(
    (c) =>
      c.chapter_prefix.toLowerCase().includes("executive summary")
  );
  const hasOverviewPrefix = tier1Chapters.some(
    (c) =>
      c.chapter_prefix.toLowerCase() === "overview" ||
      c.chapter_prefix.toLowerCase().startsWith("overview")
  );
  const chapterPrefixType = hasExecSummaryPrefix
    ? ("exec-summary" as const)
    : hasOverviewPrefix && hasExecSummaryPrefix
    ? ("mixed" as const)
    : hasOverviewPrefix
    ? ("overview" as const)
    : ("none" as const);

  const d2 = computeD2({
    tier1Chapters,
    chapterPrefixType,
    agentSelfReported: mergedAsr["D2"] ?? null,
  });

  const d3 = computeD3({
    tier2,
    agentSelfReported: mergedAsr["D3"] ?? null,
  });

  const d4 = computeD4({
    tier2,
    agentSelfReported: mergedAsr["D4"] ?? null,
  });

  const d5 = computeD5({
    tier2,
    agentSelfReported: mergedAsr["D5"] ?? null,
  });

  return [p1, p2, p3, p4, p5, p6, p7, p8, d1, d2, d3, d4, d5];
}
