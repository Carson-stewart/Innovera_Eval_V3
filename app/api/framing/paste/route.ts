import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface PasteBody {
  content: string;
  typology?: string;
}

const TYPOLOGY_MAP: Record<string, "ONE_A" | "ONE_B" | "TWO_A" | "TWO_B"> = {
  "1A": "ONE_A",
  "1B": "ONE_B",
  "2A": "TWO_A",
  "2B": "TWO_B",
  ONE_A: "ONE_A",
  ONE_B: "ONE_B",
  TWO_A: "TWO_A",
  TWO_B: "TWO_B",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PasteBody;
  try {
    body = (await req.json()) as PasteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const typology = body.typology ? TYPOLOGY_MAP[body.typology] : undefined;

  const framing = await prisma.framing.create({
    data: {
      name: "Pasted Framing",
      sourceType: "WIZARD",
      content: body.content,
      typology: typology ?? null,
    },
  });

  return NextResponse.json({ framingId: framing.id, content: framing.content });
}
