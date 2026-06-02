import { arithmeticMean } from "../helpers";
import { npClaimScore, ccScore, ficScore } from "../thresholds";
import type { DimensionResult, Tier3P7Output, NpClaim, CcRecord } from "../../prompts/types";

export interface P7Input {
  tier3P7: Tier3P7Output;
  agentSelfReported: number | null;
}

/** Sentinel score value for NOT_SCORED (sparse-data: 0 claims) */
export const P7_NOT_SCORED = null;

function classifyNpClaims(npClaims: NpClaim[]): {
  inRange: number;
  boundary: number;
  oorJustified: number;
  oor: number;
} {
  let inRange = 0;
  let boundary = 0;
  let oorJustified = 0;
  let oor = 0;

  for (const claim of npClaims) {
    switch (claim.classification) {
      case "in-range":
      case "not-in-library":
        inRange++;
        break;
      case "boundary":
        boundary++;
        break;
      case "oor-justified-j1":
        oorJustified++;
        break;
      case "oor-justified-j2":
      case "oor-justified-j3":
      case "out-of-range":
        oor++;
        break;
    }
  }

  return { inRange, boundary, oorJustified, oor };
}

function computeNpScore(npClaims: NpClaim[]): number {
  const { inRange, boundary, oorJustified, oor } = classifyNpClaims(npClaims);
  return npClaimScore(inRange, boundary, oorJustified, oor);
}

function computeCcScore(ccRecords: CcRecord[]): number {
  const totalPenalties = ccRecords.reduce((sum, r) => sum + Math.abs(r.penalty), 0);
  return ccScore(totalPenalties);
}

function computeFicScore(
  ficTests: Tier3P7Output["fic_tests"]
): number {
  let passCount = 0;
  let failCount = 0;
  let naCount = 0;

  const tests = Object.values(ficTests);
  for (const result of tests) {
    if (result === "PASS") passCount++;
    else if (result === "FAIL") failCount++;
    else naCount++;
  }

  return ficScore(passCount, failCount, naCount);
}

/**
 * P7 — Output Realism
 *
 * Sparse-data protocol FIRST:
 * - 0 claims → NOT_SCORED (score = null)
 * - 1-2 → minimal: ORI = mean(NP, CC)
 * - 3-4 → partial: ORI = (NP + CC + FIC×0.5) / 2.5
 * - 5+ → full: ORI = mean(NP, CC, FIC)
 */
export function computeP7(input: P7Input): DimensionResult {
  const { tier3P7 } = input;
  const claimCount = tier3P7.claim_count;

  // Sparse-data protocol
  let ori: number | null;
  let protocol: "not-scored" | "minimal" | "partial" | "full";
  let npSc: number | null = null;
  let ccSc: number | null = null;
  let ficSc: number | null = null;

  if (claimCount === 0) {
    protocol = "not-scored";
    ori = null;
  } else if (claimCount <= 2) {
    protocol = "minimal";
    npSc = computeNpScore(tier3P7.np_claims);
    ccSc = computeCcScore(tier3P7.cc_records);
    ori = arithmeticMean([npSc, ccSc]);
    ficSc = computeFicScore(tier3P7.fic_tests);
  } else if (claimCount <= 4) {
    protocol = "partial";
    npSc = computeNpScore(tier3P7.np_claims);
    ccSc = computeCcScore(tier3P7.cc_records);
    ficSc = computeFicScore(tier3P7.fic_tests);
    ori = (npSc + ccSc + ficSc * 0.5) / 2.5;
  } else {
    protocol = "full";
    npSc = computeNpScore(tier3P7.np_claims);
    ccSc = computeCcScore(tier3P7.cc_records);
    ficSc = computeFicScore(tier3P7.fic_tests);
    ori = arithmeticMean([npSc, ccSc, ficSc]);
  }

  const subScores: Record<string, number> = {
    claimCount,
    ...(npSc !== null && { npScore: npSc }),
    ...(ccSc !== null && { ccScore: ccSc }),
    ...(ficSc !== null && { ficScore: ficSc }),
    ...(ori !== null && { ori }),
  };

  const calibrationDrift =
    ori !== null &&
    input.agentSelfReported != null &&
    Math.abs(ori - input.agentSelfReported) >= 1.0;

  // NP detail
  const { inRange, boundary, oorJustified, oor } = classifyNpClaims(tier3P7.np_claims);
  const totalCcPenalties = tier3P7.cc_records.reduce(
    (sum, r) => sum + Math.abs(r.penalty),
    0
  );

  return {
    dimensionKey: "P7",
    score: ori,
    subScores,
    traceabilityLog: {
      formula: protocol === "not-scored"
        ? "NOT SCORED — 0 financial claims"
        : protocol === "minimal"
        ? "ORI = mean(NP, CC)"
        : protocol === "partial"
        ? "ORI = (NP + CC + FIC×0.5) / 2.5"
        : "ORI = mean(NP, CC, FIC)",
      sparse_data_protocol: protocol,
      claim_count: claimCount,
      np_claims_count: tier3P7.np_claims.length,
      np_in_range: inRange,
      np_boundary: boundary,
      np_oor_justified: oorJustified,
      np_oor: oor,
      np_score: npSc,
      cc_records_count: tier3P7.cc_records.length,
      cc_total_penalties: totalCcPenalties,
      cc_score: ccSc,
      fic_tests: tier3P7.fic_tests,
      fic_test_reasons: tier3P7.fic_test_reasons ?? null,
      fic_score: ficSc,
      ori,
    },
    serverComputed: ori,
    agentSelfReported: input.agentSelfReported,
    calibrationDrift,
  };
}
