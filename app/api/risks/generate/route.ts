import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { callModelJSON, SCORING_MODEL } from "@/lib/openrouter";

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

  // Critical-risk IDENTIFICATION draws from the FRAMING + TYPOLOGY only — the
  // decision memo is intentionally NOT loaded here. (memoId is still accepted/
  // validated for the gate contract and is used downstream by /api/score, but
  // no memo text enters the identification context.) The memo drives the
  // separate downstream coverage step (Step 8 addressedStatus), not this one.
  const framing = await prisma.framing.findUniqueOrThrow({ where: { id: framingId } });

  const typologyLabel = TYPOLOGY_LABELS[typology] ?? typology;

  const system = `You are a senior investment decision analyst applying the Innovera V3 evaluation framework.
Your task is to identify the top 5 most critical risks THIS DECISION CARRIES, reasoned from the FRAMING DOCUMENT and the TYPOLOGY below. You are given the framing and typology ONLY — you are NOT given the decision memo, and you must not assume or guess what the memo says. Reason about the risks the decision itself carries.

Return ONLY a JSON array of exactly 5 risk objects. Each object must have these exact fields:
- statement: string — a clear, specific risk statement
- classification: "BULL" | "BEAR" | "BILATERAL" — BULL = upside risk, BEAR = downside risk, BILATERAL = cuts both ways
- source: "TYPOLOGY" | "FRAMING" | "EMPIRICAL" | "LLM_INFERENCE" — where this risk primarily comes from. Use FRAMING when it is grounded in something the framing states; TYPOLOGY when it follows from the decision typology; EMPIRICAL when it rests on well-established base rates for this kind of decision; LLM_INFERENCE when the framing was too thin to surface it and you reasoned it out from the decision's type/sector. Tag honestly so the human reviewer can see which risks are framing-grounded and which were inferred.
- severity: "CRITICAL" | "HIGH" | "MEDIUM" — severity level
- whyNotARisk: string — a steelman argument for why this might NOT actually be a risk (devil's advocate)

Prioritize risks that are specific to THIS decision's actual context — its sector, geography, structure, and the facts the framing states — not generic boilerplate.

THIN FRAMING: If the framing lacks enough detail to surface specific critical risks, use sound domain reasoning about the decision's type, sector, and typology to identify the most logical critical risks it should account for, and tag those LLM_INFERENCE. Even then, stay grounded in the framing's stated context — do NOT invent risks unrelated to what the framing describes.`;

  const userMessage = `TYPOLOGY: ${typologyLabel}

--- FRAMING DOCUMENT ---
${framing.content}

Identify the TOP 5 CRITICAL RISKS this decision carries, reasoned from the framing and typology above. The decision memo is deliberately NOT provided — do not ask for it or speculate about its contents.`;

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
        { error: `Framing is too large to process. ${msg}` },
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

  const frameworkCaveat =
    "These risks are flagged by the AI model from the framing document and subject to human judgment. Review each carefully before approving.";

  return NextResponse.json({ risks, frameworkCaveat });
}
