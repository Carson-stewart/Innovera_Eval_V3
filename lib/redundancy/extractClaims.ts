/**
 * lib/redundancy/extractClaims.ts
 *
 * Extract atomic factual/analytical claims from memo chapters.
 * Built on top of the P7 load-bearing-claim pattern, extended to all chapter types.
 * Temperature 0 (inherited from callModelJSON default).
 */

import { callModelJSON } from "@/lib/openrouter";
import type { AtomicClaim } from "./types";

interface RawClaim {
  text: string;
  chapter: string;
}

const SYSTEM = `You are extracting atomic factual and analytical claims from a memo chapter.

An ATOMIC CLAIM is a single, specific, verifiable statement. It can be:
- A quantitative assertion ("$25M ARR within 18–24 months")
- A named finding or conclusion ("Enterprise grocery sales cycles require 9–12 months")
- A specific capability or feature claim ("Vision AI enables real-time shelf monitoring")
- A market sizing or competitive statement ("The SAM is $190–215M in US grocery")
- A strategic assertion ("Ecolab's existing retailer relationships create a structural advantage")

RULES:
1. One claim per object — do NOT combine two facts into one.
2. Keep the claim short (1–2 sentences max). Include specific numbers/names where present.
3. Exclude vague/generic statements with no specific content ("the market is growing", "this is important").
4. Include ALL significant claims — financial, strategic, technical, competitive.
5. Do NOT invent or rephrase beyond minimal cleanup. Stay close to the source text.

Return ONLY valid JSON: { "claims": [{ "text": "<claim>", "chapter": "<chapter name>" }] }`;

/**
 * Extract atomic claims from a single chapter.
 * Returns an array of claims tagged with the chapter name.
 */
export async function extractClaimsFromChapter(
  chapterName: string,
  chapterText: string
): Promise<AtomicClaim[]> {
  // Trim very large chapters to keep the prompt manageable
  const trimmed = chapterText.length > 8_000
    ? chapterText.slice(0, 8_000) + "\n\n[...chapter truncated for claim extraction...]"
    : chapterText;

  const userContent = `CHAPTER: ${chapterName}
---
${trimmed}
---
Extract all atomic claims from this chapter. Return JSON only.`;

  let raw: { claims?: RawClaim[] } = { claims: [] };
  try {
    raw = await callModelJSON<{ claims?: RawClaim[] }>({
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });
  } catch {
    return [];
  }

  return (raw.claims ?? [])
    .filter((c): c is RawClaim => typeof c?.text === "string" && c.text.trim().length > 10)
    .map((c, i) => ({
      text: c.text.trim(),
      chapter: c.chapter?.trim() || chapterName,
      index: i, // will be re-indexed globally by caller
    }));
}

/**
 * Extract claims from all chapters in a SINGLE batched LLM call.
 * Each chapter is delimited with a header so the model can tag claims by chapter.
 * This keeps the step time well under Inngest's timeout vs. N sequential calls.
 */
export async function extractAllClaims(
  chapters: Array<{ title: string; text: string }>
): Promise<AtomicClaim[]> {
  if (chapters.length === 0) return [];

  // Build one combined prompt with all chapters.
  // Cap each chapter to 4k chars; total prompt stays within context budget.
  const MAX_PER_CHAPTER = 4_000;
  const parts = chapters.map((ch) => {
    const text = ch.text.length > MAX_PER_CHAPTER
      ? ch.text.slice(0, MAX_PER_CHAPTER) + "\n[...truncated]"
      : ch.text;
    return `=== CHAPTER: ${ch.title} ===\n${text}`;
  });

  const combinedText = parts.join("\n\n");

  const userContent = `MEMO CHAPTERS:
---
${combinedText}
---
Extract all atomic claims from ALL chapters above. For each claim, set the "chapter" field to the chapter name it came from (the text after "=== CHAPTER: "). Return JSON only.`;

  let raw: { claims?: RawClaim[] } = { claims: [] };
  try {
    raw = await callModelJSON<{ claims?: RawClaim[] }>({
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });
  } catch {
    return [];
  }

  return (raw.claims ?? [])
    .filter((c): c is RawClaim => typeof c?.text === "string" && c.text.trim().length > 10)
    .map((c, i) => ({
      text: c.text.trim(),
      chapter: c.chapter?.trim() || "Unknown",
      index: i,
    }));
}
