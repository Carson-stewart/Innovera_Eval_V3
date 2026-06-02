// All measurement → score threshold tables as pure functions.
// Each function takes measurement(s) and returns an integer score 1–5.

import { clamp } from "./helpers";

// ─────────────────────────────────────────────
// STAGE 1 THRESHOLDS
// ─────────────────────────────────────────────

/** P5: Citation density per 100 lines → 1–5 */
export function citationDensityScore(per100Lines: number): number {
  if (per100Lines >= 15) return 5;
  if (per100Lines >= 10) return 4;
  if (per100Lines >= 6) return 3;
  if (per100Lines >= 3) return 2;
  return 1;
}

/** P5: Source quality → 1–5
 *  Capped ≤3 if any red-flag source present.
 *  premiumCount as % of totalSources drives the upper end.
 */
export function sourceQualityScore(
  redFlagCount: number,
  totalSources: number,
  premiumCount: number
): number {
  if (totalSources === 0) return 1;
  const premiumPct = premiumCount / totalSources;
  const redFlagPct = redFlagCount / totalSources;

  let score: number;
  if (redFlagPct === 0 && premiumPct >= 0.25) {
    score = 5;
  } else if (redFlagPct === 0 && premiumPct >= 0.1) {
    score = 4;
  } else if (redFlagPct < 0.15 && premiumPct >= 0.1) {
    score = 3;
  } else if (redFlagPct < 0.30) {
    score = 2;
  } else {
    score = 1;
  }

  // Cap at 3 if any red-flag present
  if (redFlagCount > 0) {
    score = Math.min(score, 3);
  }

  return score;
}

/** P5: Provenance tagging → 1–5 */
export function provenanceTaggingScore(tagCount: number, typeCount: number): number {
  if (tagCount >= 100 && typeCount >= 4) return 5;
  if (tagCount >= 51 && typeCount >= 3) return 4;
  if (tagCount >= 25 && typeCount >= 2) return 3;
  if (tagCount >= 1) return 2;
  return 1;
}

/** P6: Assumption identification → 1–5 */
export function identificationScore(
  hasTopLevelSection: boolean,
  sectionalCount: number
): number {
  if (hasTopLevelSection && sectionalCount > 0) return 5;
  if (hasTopLevelSection) return 4;
  if (sectionalCount > 5) return 3;
  if (sectionalCount > 0) return 2;
  return 1;
}

/** P6: Attribution → 1–5 */
export function attributionScore(
  clientTagged: number,
  platformTagged: number,
  hasProvenanceTable: boolean,
  sourceTypeCount: number
): number {
  const totalTagged = clientTagged + platformTagged;
  if (totalTagged > 0 && hasProvenanceTable && sourceTypeCount >= 5) return 5;
  if (totalTagged > 0 && hasProvenanceTable) return 4;
  if (totalTagged > 0 && sourceTypeCount >= 2) return 3;
  if (totalTagged > 0) return 2;
  return 1;
}

/** P6: Sensitivity awareness → 1–5 */
export function sensitivityAwarenessScore(
  validationMethodsLinkedToActions: number
): number {
  // Score based on count of validation methods with Success/Kill linkage
  if (validationMethodsLinkedToActions >= 3) return 5;
  if (validationMethodsLinkedToActions >= 2) return 4;
  if (validationMethodsLinkedToActions >= 1) return 3;
  return 1;
}

/** P4: Options → 1–5 */
export function optionsScore(count: number, hasComparison: boolean): number {
  if (count >= 3 && hasComparison) return 5;
  if (count >= 3) return 4;
  if (count >= 2 && hasComparison) return 3;
  if (count >= 2) return 2;
  if (count >= 1) return 1;
  return 1;
}

/** P4: Scenarios → 1–5 */
export function scenariosScore(scenarioCount: number, paramsVaried: number): number {
  if (scenarioCount >= 3 && paramsVaried >= 3) return 5;
  if (scenarioCount >= 3 && paramsVaried >= 2) return 4;
  if (scenarioCount >= 2) return 3;
  if (scenarioCount >= 1) return 2;
  return 1;
}

/** P4: Sensitivities → 1–5 */
export function sensitivitiesScore(
  type: "multi" | "single" | "threshold" | "none"
): number {
  switch (type) {
    case "multi": return 5;
    case "single": return 3;
    case "threshold": return 2;
    case "none": return 1;
  }
}

/** P4: Interpretive alternatives → 1–5 */
export function interpretiveAlternativesScore(
  hasStandaloneSection: boolean,
  count: number
): number {
  if (hasStandaloneSection && count >= 2) return 5;
  if (hasStandaloneSection) return 4;
  if (count >= 2) return 3;
  if (count >= 1) return 2;
  return 1;
}

/** P7: NP claim score — proportional to classification mix
 *  in-range and not-in-library (neutral) are favorable.
 *  boundary = slight penalty, OOR = penalty, OOR-J1 = excused.
 */
export function npClaimScore(
  inRange: number,
  boundary: number,
  oorJustified: number, // J1 only (adequate justification)
  oor: number // J2, J3, or plain OOR
): number {
  const total = inRange + boundary + oorJustified + oor;
  if (total === 0) return 3; // neutral — no claims to assess
  const penalizedRatio = oor / total;
  const boundaryRatio = boundary / total;

  if (penalizedRatio === 0 && boundaryRatio <= 0.1) return 5;
  if (penalizedRatio === 0 && boundaryRatio <= 0.25) return 4;
  if (penalizedRatio <= 0.1) return 3;
  if (penalizedRatio <= 0.25) return 2;
  return 1;
}

/** P7: CC score — sum of all penalties from cc_records */
export function ccScore(totalPenalties: number): number {
  // 0 penalties → 5; scale down per penalty schedule
  if (totalPenalties === 0) return 5;
  if (totalPenalties <= 0.5) return 4;
  if (totalPenalties <= 1.0) return 3;
  if (totalPenalties <= 2.0) return 2;
  return 1;
}

/** P7: FIC score — pass/fail/na counts */
export function ficScore(passCount: number, failCount: number, _naCount: number): number {
  if (failCount === 0) return 5;
  if (failCount === 1) return 3;
  return 1;
}

/** P8: Specificity → 1–5 */
export function specificityScore(
  quantified: boolean,
  namedEntities: boolean
): number {
  if (quantified && namedEntities) return 5;
  if (quantified || namedEntities) return 3;
  return 1;
}

/** P8: Decision architecture → 1–5
 *  Based on what fraction of actions have all four elements (Gate/Kill/Timeline/Priority)
 */
export function decisionArchitectureScore(
  actionsWithAllFour: number,
  actionsWithTwo: number,
  actionsWithNone: number,
  total: number
): number {
  if (total === 0) return 1;
  if (actionsWithAllFour === total) return 5;
  if (actionsWithAllFour / total >= 0.75) return 4;
  if ((actionsWithAllFour + actionsWithTwo) / total >= 0.5) return 3;
  if (actionsWithNone < total) return 2;
  return 1;
}

/** P8: Integration — Q/A/Basis chains → 1–5 */
export function integrationScore(
  qaBasisChainsCount: number,
  quantified: boolean
): number {
  if (qaBasisChainsCount >= 3 && quantified) return 5;
  if (qaBasisChainsCount >= 3) return 4;
  if (qaBasisChainsCount >= 2) return 3;
  if (qaBasisChainsCount >= 1) return 2;
  return 1;
}

/** P8 Move 8: conviction calibrated to CovI */
export function move8Score(covi: number): number {
  if (covi > 3.5) return 5;
  if (covi >= 3.0) return 3; // midpoint of 3–4 range
  if (covi >= 2.5) return 2; // midpoint of 2–3 range
  return 1; // midpoint of 1–2 range (floor)
}

// ─────────────────────────────────────────────
// STAGE 2 THRESHOLDS
// ─────────────────────────────────────────────

/** D1: Verdict-first placement → 1–5 */
export function verdictFirstScore(
  placement: "front-loaded" | "present-not-front" | "buried" | "absent"
): number {
  switch (placement) {
    case "front-loaded": return 5;
    case "present-not-front": return 3;
    case "buried": return 2;
    case "absent": return 1;
  }
}

/** D1: Acronym discipline → 1–5 */
export function acronymDisciplineScore(
  totalAcronyms: number,
  definedCount: number
): number {
  const undefined_ = totalAcronyms - definedCount;
  if (totalAcronyms <= 2 || undefined_ === 0) return 5;
  if (undefined_ <= 3) return 4;
  if (totalAcronyms <= 11) return 3;
  if (totalAcronyms <= 14) return 2;
  return 1; // 15+ undefined
}

/** D1: Numerical density (per 100 words) → 1–5 */
export function numericalDensityScore(per100Words: number): number {
  if (per100Words >= 2.5) return 5;
  if (per100Words >= 2.0) return 4;
  if (per100Words >= 1.5) return 3;
  if (per100Words >= 1.0) return 2;
  return 1;
}

/** D1: Sentence complexity (avg words per sentence) → 1–5 */
export function sentenceComplexityScore(avgWords: number): number {
  if (avgWords >= 12 && avgWords <= 22) return 5;
  if (avgWords >= 10 && avgWords <= 25) return 4;
  if (avgWords >= 26 && avgWords <= 30) return 3;
  if (avgWords >= 8 && avgWords <= 10) return 3;
  if (avgWords > 30 && avgWords <= 35) return 2;
  if (avgWords >= 6 && avgWords < 8) return 2;
  return 1; // > 35 or < 6
}

/** D1: Exec summary length (words) → 1–5 */
export function execSummaryLengthScore(wordCount: number): number {
  if (wordCount >= 800 && wordCount <= 1500) return 5;
  if (wordCount >= 600 && wordCount < 800) return 4;
  if (wordCount > 1500 && wordCount <= 1800) return 4;
  if ((wordCount >= 400 && wordCount < 600) || (wordCount > 1800 && wordCount <= 2200)) return 3;
  if ((wordCount >= 200 && wordCount < 400) || (wordCount > 2200 && wordCount <= 2500)) return 2;
  return 1; // > 2500 or < 200
}

/** D2: Header hierarchy (H4 count) → 1–5 */
export function headerHierarchyScore(h4Count: number): number {
  if (h4Count < 10) return 5;
  if (h4Count <= 19) return 4;
  if (h4Count <= 40) return 3;
  if (h4Count <= 60) return 2;
  return 1;
}

/** D2: Visual scaffolding → 1–5 */
export function visualScaffoldingScore(
  tableCount: number,
  hasKeyTakeaways: boolean,
  hasFramingProse: boolean
): number {
  if (tableCount >= 50 && hasKeyTakeaways && hasFramingProse) return 5;
  if (tableCount >= 30 && hasKeyTakeaways) return 4;
  if (tableCount >= 15) return 3;
  if (tableCount >= 5) return 2;
  return 1;
}

/** D2: Chapter prefix → 1–5 */
export function chapterPrefixScore(
  prefixType: "exec-summary" | "mixed" | "overview" | "none"
): number {
  switch (prefixType) {
    case "exec-summary": return 5;
    case "mixed": return 3;
    case "overview": return 2;
    case "none": return 1;
  }
}

/** D2: Bold discipline (per 1000 lines) → 1–5 */
export function boldDisciplineScore(per1000Lines: number): number {
  if (per1000Lines < 80) return 5;
  if (per1000Lines < 150) return 4;
  if (per1000Lines <= 250) return 3;
  if (per1000Lines <= 400) return 2;
  return 1;
}

/** D2: Cross-references → 1–5 */
export function crossRefsScore(dangle: number, total: number): number {
  if (total === 0) return 5;
  if (dangle === 0) return 5;
  const ratio = dangle / total;
  if (ratio < 0.1) return 4;
  if (ratio < 0.25) return 3;
  if (ratio < 0.5) return 2;
  return 1;
}

/** D3: Voice → 1–5 */
export function voiceScore(
  type: "exec" | "mostly-exec" | "mixed" | "operator-leaning" | "operator"
): number {
  switch (type) {
    case "exec": return 5;
    case "mostly-exec": return 4;
    case "mixed": return 3;
    case "operator-leaning": return 2;
    case "operator": return 1;
  }
}

/** D3: Stakeholder framing → 1–5 */
export function stakeholderFramingScore(
  hasDecisionH2: boolean,
  hasCoreDecisionLabel: boolean
): number {
  if (hasDecisionH2 && hasCoreDecisionLabel) return 5;
  if (hasDecisionH2 || hasCoreDecisionLabel) return 3;
  return 1;
}

/** D3: Executive terminology → 1–5 */
export function executiveTerminologyScore(matchedCount: number): number {
  if (matchedCount >= 13) return 5;
  if (matchedCount >= 9) return 4;
  if (matchedCount >= 4) return 3;
  if (matchedCount >= 2) return 2;
  return 1;
}

/** D3: Hedging discipline (hedge:strong ratio) → 1–5 */
export function hedgingDisciplineScore(ratio: number): number {
  if (ratio < 0.2) return 5;
  if (ratio < 0.3) return 4;
  if (ratio < 0.5) return 3;
  if (ratio < 0.6) return 2;
  return 1;
}

/** D3: Salience hierarchy → 1–5 */
export function salienceHierarchyScore(
  placement:
    | "verdict-first-quantified"
    | "verdict-first"
    | "suboptimal"
    | "near-end"
    | "buried"
): number {
  switch (placement) {
    case "verdict-first-quantified": return 5;
    case "verdict-first": return 4;
    case "suboptimal": return 3;
    case "near-end": return 2;
    case "buried": return 1;
  }
}

/** D4: Timed actions → 1–5 */
export function timedActionsScore(count: number): number {
  if (count >= 30) return 5;
  if (count >= 20) return 4;
  if (count >= 10) return 3;
  if (count >= 5) return 2;
  return 1;
}

/** D4: Basis tags → 1–5 */
export function basisTagsScore(count: number): number {
  if (count >= 4) return 5;
  if (count >= 3) return 4;
  if (count >= 2) return 3;
  if (count >= 1) return 2;
  return 1;
}

/** D4: Risk annotations → 1–5 */
export function riskAnnotationsScore(count: number, isStructured: boolean): number {
  if (count >= 25 && isStructured) return 5;
  if (count >= 15 && isStructured) return 4;
  if (count >= 8) return 3;
  if (count >= 1) return 2;
  return 1;
}

/** D4: Quantification completeness (ratio of numbers with units) → 1–5 */
export function quantificationScore(ratio: number): number {
  if (ratio > 0.9) return 5;
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.7) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}

/** D4: Self-containment (cross-ref dependencies in Exec Summary) → 1–5 */
export function selfContainmentScore(crossRefDependencies: number): number {
  if (crossRefDependencies === 0) return 5;
  if (crossRefDependencies === 1) return 4;
  if (crossRefDependencies <= 3) return 3;
  if (crossRefDependencies <= 5) return 2;
  return 1;
}

/** D5: Verdict clarity → 1–5 */
export function verdictClarityScore(
  type: "clear" | "conditional-no-criteria" | "implied" | "unclear" | "ambiguous"
): number {
  switch (type) {
    case "clear": return 5;
    case "conditional-no-criteria": return 3;
    case "implied": return 3;
    case "unclear": return 2;
    case "ambiguous": return 1;
  }
}

/** D5: First action specificity → 1–5 */
export function firstActionScore(
  hasTimeframe: boolean,
  hasSuccessKill: boolean,
  hasPriority: boolean
): number {
  const count = [hasTimeframe, hasSuccessKill, hasPriority].filter(Boolean).length;
  if (count === 3) return 5;
  if (count === 2) return 4;
  if (count === 1) return 2;
  return 1;
}

/** D5: Capital ask → 1–5 */
export function capitalAskScore(
  type: "quantified-ranged" | "quantified" | "present" | "vague" | "absent"
): number {
  switch (type) {
    case "quantified-ranged": return 5;
    case "quantified": return 4;
    case "present": return 3;
    case "vague": return 2;
    case "absent": return 1;
  }
}

/** D5: Priority sequencing → 1–5 */
export function prioritySequencingScore(
  type: "tagged" | "structured" | "partial" | "mentioned" | "none"
): number {
  switch (type) {
    case "tagged": return 5;
    case "structured": return 4;
    case "partial": return 3;
    case "mentioned": return 2;
    case "none": return 1;
  }
}

/** D5: Decision threshold legibility → 1–5 */
export function thresholdLegibilityScore(
  hasThreshold: boolean,
  hasDefault: boolean,
  hasCostOfDelay: boolean
): number {
  const count = [hasThreshold, hasDefault, hasCostOfDelay].filter(Boolean).length;
  if (count === 3) return 5;
  if (count === 2) return 4;
  if (count === 1) return 2;
  return 1;
}
