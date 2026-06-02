import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { callModelJSON, SCORING_MODEL } from "@/lib/openrouter";
import { buildMemoContext } from "@/lib/memoContext";
import { splitChapters } from "@/lib/ingest/splitChapters";

interface GenerateBody {
  framingId: number;
  memoId: number;
  typology: string;
}

interface RiskItem {
  statement: string;
  classification: "BULL" | "BEAR" | "BILATERAL";
  source: "TYPOLOGY" | "FRAMING" | "EMPIRICAL" | "LLM_INFERENCE";
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  whyNotARisk: string;
}

const TYPOLOGY_LABELS: Record<string, string> = {
  ONE_A: "1A — External Investment",
  ONE_B: "1B — Internal Initiative",
  TWO_A: "2A — New Market Entry",
  TWO_B: "2B — New Product Launch",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { framingId, memoId, typology } = body;

  if (
    typeof framingId !== "number" ||
    typeof memoId !== "number" ||
    typeof typology !== "string"
  ) {
    return NextResponse.json(
      { error: "framingId, memoId, typology are required" },
      { status: 400 }
    );
  }

  const [framing, memo] = await Promise.all([
    prisma.framing.findUniqueOrThrow({ where: { id: framingId } }),
    prisma.memo.findUniqueOrThrow({ where: { id: memoId } }),
  ]);

  const typologyLabel = TYPOLOGY_LABELS[typology] ?? typology;
  const rawMemoContent = memo.content ?? "";

  // Build context with tiered fallback if memo exceeds the model's token budget.
  // Risk generation is a whole-memo judgment so we prefer the full text, but fall
  // back to scored-chapters-only or trimmed if necessary.
  const chapters = splitChapters(rawMemoContent);
  let memoCtx;
  try {
    memoCtx = buildMemoContext(framing.content, rawMemoContent, chapters);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Memo too large to process" },
      { status: 422 }
    );
  }

  const system = `You are a senior investment decision analyst applying the Innovera V3 evaluation framework.
Your task is to identify the top 5 most critical risks for this decision memo, given the framing document and typology context.

Return ONLY a JSON array of exactly 5 risk objects. Each object must have these exact fields:
- statement: string — a clear, specific risk statement
- classification: "BULL" | "BEAR" | "BILATERAL" — BULL = upside risk, BEAR = downside risk, BILATERAL = cuts both ways
- source: "TYPOLOGY" | "FRAMING" | "EMPIRICAL" | "LLM_INFERENCE" — primary source of this risk flag
- severity: "CRITICAL" | "HIGH" | "MEDIUM" — severity level
- whyNotARisk: string — a steelman argument for why this might NOT actually be a risk (devil's advocate)

Prioritize risks that are specific to this memo's content and framing — not generic boilerplate.
The framing document context MUST be considered first before analyzing the memo.`;

  const userMessage = `TYPOLOGY: ${typologyLabel}

--- FRAMING DOCUMENT ---
${framing.content}

--- DECISION MEMO ---
${memoCtx.content}

Identify the TOP 5 CRITICAL RISKS for this memo, given the framing above.`;

  let risks: RiskItem[];
  try {
    risks = await callModelJSON<RiskItem[]>({
      system,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface context-overflow errors with a clear 422 instead of 500
    if (msg.includes("too long") || msg.includes("context") || (err as { status?: number })?.status === 400) {
      return NextResponse.json(
        { error: `Memo is too large even after reduction (tier: ${memoCtx.tier}). ${msg}` },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: `Risk generation failed: ${msg}` }, { status: 502 });
  }

  // Validate shape
  if (!Array.isArray(risks) || risks.length === 0) {
    return NextResponse.json({ error: "Model returned unexpected shape" }, { status: 502 });
  }

  void SCORING_MODEL; // referenced to satisfy import usage

  const baseCaveat =
    "These risks are flagged by the AI model and subject to human judgment. Review each carefully before approving.";
  const frameworkCaveat = memoCtx.trimNote
    ? `${baseCaveat} Note: ${memoCtx.trimNote}`
    : baseCaveat;

  return NextResponse.json({ risks, frameworkCaveat, contextTier: memoCtx.tier });
}
