import { arithmeticMean, geometricMean, clamp } from "./helpers";
import type { DimensionResult } from "../prompts/types";

export interface DiagnosticEntry {
  type: "ERROR" | "CALIBRATION_WARNING";
  dimension: string;
  message: string;
}

const TOLERANCE = 0.01;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

/**
 * Verify scoring math for each dimension result.
 * Re-runs formulas from stored subScores and checks against stored score.
 * Also flags calibration drift.
 */
export function verifyScoring(dimensionResults: DimensionResult[]): DiagnosticEntry[] {
  const diagnostics: DiagnosticEntry[] = [];
  const resultMap = new Map<string, DimensionResult>();

  for (const dr of dimensionResults) {
    resultMap.set(dr.dimensionKey, dr);
  }

  function check(dr: DimensionResult, recomputed: number | null): void {
    const stored = dr.serverComputed;

    // Handle NOT_SCORED (null)
    if (stored === null && recomputed === null) return;

    if (stored === null || recomputed === null) {
      diagnostics.push({
        type: "ERROR",
        dimension: dr.dimensionKey,
        message: `Null/non-null mismatch: stored=${stored}, recomputed=${recomputed}`,
      });
      return;
    }

    if (!approxEqual(stored, recomputed)) {
      diagnostics.push({
        type: "ERROR",
        dimension: dr.dimensionKey,
        message: `Math verification failed: stored=${stored.toFixed(4)}, recomputed=${recomputed.toFixed(4)}, discrepancy=${Math.abs(stored - recomputed).toFixed(4)}`,
      });
    }
  }

  function checkCalibrationDrift(dr: DimensionResult): void {
    if (dr.agentSelfReported !== null && dr.serverComputed !== null) {
      const drift = Math.abs(dr.serverComputed - dr.agentSelfReported);
      if (drift >= 1.0 && !dr.calibrationDrift) {
        diagnostics.push({
          type: "CALIBRATION_WARNING",
          dimension: dr.dimensionKey,
          message: `calibrationDrift flag missing: server=${dr.serverComputed.toFixed(2)}, agent=${dr.agentSelfReported.toFixed(2)}, drift=${drift.toFixed(2)}`,
        });
      } else if (dr.calibrationDrift && drift < 1.0) {
        diagnostics.push({
          type: "ERROR",
          dimension: dr.dimensionKey,
          message: `calibrationDrift flag set but drift < 1.0: server=${dr.serverComputed.toFixed(2)}, agent=${dr.agentSelfReported.toFixed(2)}, drift=${drift.toFixed(2)}`,
        });
      } else if (dr.calibrationDrift) {
        diagnostics.push({
          type: "CALIBRATION_WARNING",
          dimension: dr.dimensionKey,
          message: `Calibration drift detected: server=${dr.serverComputed.toFixed(2)}, agent=${dr.agentSelfReported.toFixed(2)}, drift=${drift.toFixed(2)}`,
        });
      }
    }
  }

  for (const dr of dimensionResults) {
    checkCalibrationDrift(dr);

    switch (dr.dimensionKey) {
      case "P1": {
        // CI = 5 − totalPenalties + bonus, clamp [1,5]
        const { totalPenalties, bonus } = dr.subScores;
        if (totalPenalties !== undefined && bonus !== undefined) {
          const recomputed = clamp(5 - totalPenalties + bonus, 1, 5);
          check(dr, recomputed);
        }
        // Verify clamp held
        if (dr.serverComputed !== null) {
          if (dr.serverComputed < 1 - TOLERANCE || dr.serverComputed > 5 + TOLERANCE) {
            diagnostics.push({
              type: "ERROR",
              dimension: "P1",
              message: `P1 clamp violated: score=${dr.serverComputed}`,
            });
          }
        }
        break;
      }

      case "P2": {
        const { fidelityScore, gapFillingScore, executabilityScore } = dr.subScores;
        if (
          fidelityScore !== undefined &&
          gapFillingScore !== undefined &&
          executabilityScore !== undefined
        ) {
          const recomputed = geometricMean([fidelityScore, gapFillingScore, executabilityScore]);
          check(dr, recomputed);
        }
        break;
      }

      case "P3": {
        const { totalPenalties, totalBonuses } = dr.subScores;
        if (totalPenalties !== undefined && totalBonuses !== undefined) {
          const recomputed = clamp(5 + totalBonuses - totalPenalties, 1, 5);
          check(dr, recomputed);
        }
        if (dr.serverComputed !== null) {
          if (dr.serverComputed < 1 - TOLERANCE || dr.serverComputed > 5 + TOLERANCE) {
            diagnostics.push({
              type: "ERROR",
              dimension: "P3",
              message: `P3 clamp violated: score=${dr.serverComputed}`,
            });
          }
        }
        break;
      }

      case "P4": {
        const { optionsScore, scenariosScore, sensitivitiesScore, iaScore } = dr.subScores;
        if (
          optionsScore !== undefined &&
          scenariosScore !== undefined &&
          sensitivitiesScore !== undefined &&
          iaScore !== undefined
        ) {
          const recomputed = geometricMean([optionsScore, scenariosScore, sensitivitiesScore, iaScore]);
          check(dr, recomputed);
        }
        break;
      }

      case "P5": {
        const { citationDensityScore, sourceQualityScore, provenanceTaggingScore } = dr.subScores;
        if (
          citationDensityScore !== undefined &&
          sourceQualityScore !== undefined &&
          provenanceTaggingScore !== undefined
        ) {
          const recomputed = arithmeticMean([citationDensityScore, sourceQualityScore, provenanceTaggingScore]);
          check(dr, recomputed);
        }
        break;
      }

      case "P6": {
        const { identificationScore, attributionScore, sensitivityAwarenessScore } = dr.subScores;
        if (
          identificationScore !== undefined &&
          attributionScore !== undefined &&
          sensitivityAwarenessScore !== undefined
        ) {
          const recomputed = arithmeticMean([identificationScore, attributionScore, sensitivityAwarenessScore]);
          check(dr, recomputed);
        }
        break;
      }

      case "P7": {
        // P7 sparse-data — verify based on protocol
        const { claimCount, npScore, ccScore, ficScore, ori } = dr.subScores;
        if (claimCount === 0) {
          if (dr.serverComputed !== null) {
            diagnostics.push({
              type: "ERROR",
              dimension: "P7",
              message: `P7: 0 claims should yield null score but got ${dr.serverComputed}`,
            });
          }
        } else if (claimCount <= 2) {
          if (npScore !== undefined && ccScore !== undefined) {
            const recomputed = arithmeticMean([npScore, ccScore]);
            check(dr, recomputed);
          }
        } else if (claimCount <= 4) {
          if (npScore !== undefined && ccScore !== undefined && ficScore !== undefined) {
            const recomputed = (npScore + ccScore + ficScore * 0.5) / 2.5;
            check(dr, recomputed);
          }
        } else {
          if (npScore !== undefined && ccScore !== undefined && ficScore !== undefined) {
            const recomputed = arithmeticMean([npScore, ccScore, ficScore]);
            check(dr, recomputed);
          }
        }
        break;
      }

      case "P8": {
        // Verify Move 8 consumed stored CovI from P4, not re-derived
        const p4Result = resultMap.get("P4");
        if (p4Result && dr.subScores.covi_used !== undefined) {
          const storedP4Covi = p4Result.subScores.covi;
          if (storedP4Covi !== undefined && !approxEqual(dr.subScores.covi_used, storedP4Covi)) {
            diagnostics.push({
              type: "ERROR",
              dimension: "P8",
              message: `Move 8 used covi=${dr.subScores.covi_used.toFixed(4)} but P4 stored covi=${storedP4Covi.toFixed(4)}. AG-P8.1 violation.`,
            });
          }
        }

        const { specificityScore, decisionArchitectureScore, integrationScore, move8Score } =
          dr.subScores;
        if (
          specificityScore !== undefined &&
          decisionArchitectureScore !== undefined &&
          integrationScore !== undefined &&
          move8Score !== undefined
        ) {
          const recomputed = arithmeticMean([specificityScore, decisionArchitectureScore, integrationScore, move8Score]);
          check(dr, recomputed);
        }
        break;
      }

      case "D1": {
        const { verdictFirstScore, acronymDisciplineScore, numericalDensityScore, sentenceComplexityScore, execSummaryLengthScore } = dr.subScores;
        if (
          verdictFirstScore !== undefined &&
          acronymDisciplineScore !== undefined &&
          numericalDensityScore !== undefined &&
          sentenceComplexityScore !== undefined &&
          execSummaryLengthScore !== undefined
        ) {
          const recomputed = arithmeticMean([verdictFirstScore, acronymDisciplineScore, numericalDensityScore, sentenceComplexityScore, execSummaryLengthScore]);
          check(dr, recomputed);
        }
        break;
      }

      case "D2": {
        const { headerHierarchyScore, visualScaffoldingScore, chapterPrefixScore, boldDisciplineScore, crossRefsScore } = dr.subScores;
        if (
          headerHierarchyScore !== undefined &&
          visualScaffoldingScore !== undefined &&
          chapterPrefixScore !== undefined &&
          boldDisciplineScore !== undefined &&
          crossRefsScore !== undefined
        ) {
          const recomputed = arithmeticMean([headerHierarchyScore, visualScaffoldingScore, chapterPrefixScore, boldDisciplineScore, crossRefsScore]);
          check(dr, recomputed);
        }
        break;
      }

      case "D3": {
        const { voiceScore, stakeholderFramingScore, executiveTerminologyScore, hedgingDisciplineScore, salienceHierarchyScore } = dr.subScores;
        if (
          voiceScore !== undefined &&
          stakeholderFramingScore !== undefined &&
          executiveTerminologyScore !== undefined &&
          hedgingDisciplineScore !== undefined &&
          salienceHierarchyScore !== undefined
        ) {
          const recomputed = arithmeticMean([voiceScore, stakeholderFramingScore, executiveTerminologyScore, hedgingDisciplineScore, salienceHierarchyScore]);
          check(dr, recomputed);
        }
        break;
      }

      case "D4": {
        const { timedActionsScore, basisTagsScore, riskAnnotationsScore, quantificationScore, selfContainmentScore } = dr.subScores;
        if (
          timedActionsScore !== undefined &&
          basisTagsScore !== undefined &&
          riskAnnotationsScore !== undefined &&
          quantificationScore !== undefined &&
          selfContainmentScore !== undefined
        ) {
          const recomputed = arithmeticMean([timedActionsScore, basisTagsScore, riskAnnotationsScore, quantificationScore, selfContainmentScore]);
          check(dr, recomputed);
        }
        break;
      }

      case "D5": {
        const { verdictClarityScore, firstActionScore, capitalAskScore, prioritySequencingScore, thresholdLegibilityScore } = dr.subScores;
        if (
          verdictClarityScore !== undefined &&
          firstActionScore !== undefined &&
          capitalAskScore !== undefined &&
          prioritySequencingScore !== undefined &&
          thresholdLegibilityScore !== undefined
        ) {
          const recomputed = arithmeticMean([verdictClarityScore, firstActionScore, capitalAskScore, prioritySequencingScore, thresholdLegibilityScore]);
          check(dr, recomputed);
        }
        break;
      }
    }
  }

  return diagnostics;
}
