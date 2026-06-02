/**
 * lib/framing/types.ts
 *
 * Shared types for the Decision Framing Sanity Checker module.
 * Used by prompt builders, the Inngest pipeline, and the API layer.
 */

// ---------------------------------------------------------------------------
// Core check result — the atomic unit returned by every category pass
// ---------------------------------------------------------------------------

export type CheckStatus = "PASS" | "FAIL" | "NA" | "ADVISORY";

export interface FramingCheckResult {
  /** e.g. "A1", "B3", "C10", "D15" */
  checkId: string;
  /** evaluator identifier — "primary" in v1.0, multi-evaluator later */
  evaluator: string;
  status: CheckStatus;
  /** 0–1 model confidence in this classification */
  confidence: number;
  /** quoted text from the framing that this finding references, or null if the issue is absence */
  location: string | null;
  /** plain-language description of the issue found (null when status is PASS or NA) */
  issue: string | null;
  /** downstream impact statement (null when status is PASS or NA) */
  impact: string | null;
  /** concrete suggested rewrite — must NOT prescribe analytical methodology (null when no fix needed) */
  rewrite: string | null;
}

// ---------------------------------------------------------------------------
// Pass 0 — structure detection and typology inference
// ---------------------------------------------------------------------------

export interface FramingSection {
  /** canonical section name */
  name: string;
  /** extracted text content, or empty string if not found */
  text: string;
  /** whether this section was found in the document */
  found: boolean;
}

export interface Pass0Output {
  sections: FramingSection[];
  /** one of: "1A" | "1B" | "2A" | "2B" | null */
  typology: "1A" | "1B" | "2A" | "2B" | null;
  typologyConfidence: "high" | "medium" | "low";
  /** quoted signals from the framing that drove the typology inference */
  typologySignals: string[];
}

// ---------------------------------------------------------------------------
// Category pass output
// ---------------------------------------------------------------------------

export interface CategoryOutput {
  category: "A" | "B" | "C" | "D";
  results: FramingCheckResult[];
}

// ---------------------------------------------------------------------------
// Full run input / output
// ---------------------------------------------------------------------------

export interface SanityRunInput {
  framingId: string;
  framingText: string;
  /** pre-computed from Pass 0 */
  sections: FramingSection[];
  /** pre-computed from Pass 0 */
  typology: "1A" | "1B" | "2A" | "2B" | null;
}

export interface SanityRunOutput {
  framingId: string;
  pass0: Pass0Output;
  catA: CategoryOutput;
  catB: CategoryOutput;
  catC: CategoryOutput;
  catD: CategoryOutput;
  /** ISO timestamp */
  scoredAt: string;
}

// ---------------------------------------------------------------------------
// Prompt payload — the shape callModelJSON consumes
// ---------------------------------------------------------------------------

export interface PromptMessage {
  role: "system" | "user";
  content: string;
}

export interface PromptPayload {
  messages: PromptMessage[];
  /** expected JSON schema description (informational, not enforced by callModelJSON) */
  responseSchema: string;
}
