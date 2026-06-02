/**
 * Token-budget guard and tiered memo-content builder for whole-memo LLM calls.
 *
 * All three whole-memo call sites (risk generation, Tier-2 synthesis, Tier-3 P7)
 * use this helper so the same budget logic is applied consistently.
 *
 * Tiers:
 *   "full"        — framing + full memo fit within budget → send everything
 *   "scored-only" — full memo overflows → send framing + scored chapters only
 *   "trimmed"     — scored chapters still overflow → further trim, surfacing a note
 */

import type { Chapter } from "@/lib/ingest/splitChapters";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Hard token limit for the current model (claude-sonnet-4-5 on OpenRouter). */
export const MODEL_TOKEN_LIMIT = 200_000;

/**
 * Baseline reserved tokens: system prompt text + JSON schema description in the
 * user turn + expected response.  Call sites that include additional large content
 * (e.g. Tier-2 also sends tier1Results JSON) should pass extraReserved.
 */
const BASELINE_RESERVED = 10_000;

/**
 * Safety factor applied to the available-token budget before committing content.
 * Accounts for the gap between our estimated chars/token ratio and the actual
 * BPE tokenizer (which can tokenize as low as 3.0 chars/token for documents with
 * lots of numbers, markdown, or repeated terms).  0.82 ≈ 3.8/4.6 — equivalent to
 * assuming worst-case 4.6 tokens per 3.8 chars on the dense sections.
 */
const BUDGET_SAFETY_FACTOR = 0.82;

/**
 * Conservative chars-per-token used when converting a token budget back to a
 * character count for truncation.  Lower than the estimation ratio so we never
 * accidentally emit more tokens than the model accepts.
 */
const CHARS_PER_TOKEN_SAFE = 2.8;

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoContentTier = "full" | "scored-only" | "trimmed";

export interface MemoContext {
  /** The memo text to embed in the prompt (may be a reduced representation). */
  content: string;
  /** Which reduction tier was applied. */
  tier: MemoContentTier;
  /** Human-readable note to surface when tier !== "full". null when full. */
  trimNote: string | null;
}

// ─── Token estimation ─────────────────────────────────────────────────────────

/**
 * Rough token estimate: Claude's BPE tokenizer averages ~4 chars/token for
 * mixed English prose + code.  We use 3.8 to be slightly conservative.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.8);
}

// ─── Main helper ──────────────────────────────────────────────────────────────

/**
 * Build the memo content to include in a whole-memo LLM prompt.
 *
 * @param framingContent   The framing document text (always sent first — budget
 *                         is reserved for it before anything else).
 * @param fullMemoContent  The full raw memo text.
 * @param chapters         Optional pre-split chapters; enables scored-only tier.
 * @param extraReserved    Additional tokens to reserve (e.g. tier1Results JSON).
 */
export function buildMemoContext(
  framingContent: string,
  fullMemoContent: string,
  chapters?: Chapter[],
  extraReserved = 0
): MemoContext {
  const reserved = BASELINE_RESERVED + extraReserved;
  const framingTokens = estimateTokens(framingContent);
  // Apply safety factor to leave headroom for tokenizer variance
  const available = Math.floor(
    (MODEL_TOKEN_LIMIT - reserved - framingTokens) * BUDGET_SAFETY_FACTOR
  );

  if (available <= 0) {
    throw new Error(
      `Framing document alone (~${framingTokens} tokens) exceeds the model's context budget. Cannot proceed.`
    );
  }

  const fullTokens = estimateTokens(fullMemoContent);

  // ── Tier 1: full memo fits ─────────────────────────────────────────────────
  if (fullTokens <= available) {
    return { content: fullMemoContent, tier: "full", trimNote: null };
  }

  // ── Tier 2: scored chapters only ──────────────────────────────────────────
  if (chapters && chapters.length > 0) {
    const scored = chapters.filter((c) => c.scored);
    const scoredContent = scored.map((c) => c.text).join("\n\n");
    const scoredTokens = estimateTokens(scoredContent);

    if (scoredTokens <= available) {
      return {
        content: scoredContent,
        tier: "scored-only",
        trimNote:
          "Non-scored context sections (Financial Appendix, Six-T/Risk Analysis, Business Models, Global Project Context, Olsenator Input) were omitted to fit within the model's 200k context window.",
      };
    }

    // ── Tier 3: trim the scored chapters ────────────────────────────────────
    // Pack chapters smallest-first so we preserve as many complete chapters as
    // possible, then partially truncate the largest one that doesn't fit whole.
    // Use CHARS_PER_TOKEN_SAFE (< estimation ratio) so we never over-emit tokens.
    const bySize = [...scored].sort((a, b) => a.text.length - b.text.length);
    let remaining = available;
    const kept: string[] = [];

    for (const ch of bySize) {
      const tokens = estimateTokens(ch.text);
      if (tokens <= remaining) {
        kept.push(ch.text);
        remaining -= tokens;
      } else {
        // Partial — truncate conservatively using CHARS_PER_TOKEN_SAFE
        const maxChars = Math.floor(remaining * CHARS_PER_TOKEN_SAFE);
        if (maxChars > 800) {
          kept.push(
            ch.text.slice(0, maxChars) +
              "\n\n[… chapter truncated: memo exceeds model context window …]"
          );
        }
        break;
      }
    }

    return {
      content: kept.join("\n\n"),
      tier: "trimmed",
      trimNote:
        "This memo is very large. Non-scored sections and portions of large chapters were omitted to fit within the model's 200k context window. Analysis covers the highest-signal scored sections; results may be less comprehensive than on a standard-sized memo.",
    };
  }

  // ── Tier 3 (no chapters): raw truncation ──────────────────────────────────
  const maxChars = Math.floor(available * CHARS_PER_TOKEN_SAFE);
  return {
    content:
      fullMemoContent.slice(0, maxChars) +
      "\n\n[… truncated: memo exceeds model context window …]",
    tier: "trimmed",
    trimNote:
      "Memo was truncated to fit within the model's 200k context window.",
  };
}
