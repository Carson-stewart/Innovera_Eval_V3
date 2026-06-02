import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { splitChapters } from "@/lib/ingest/splitChapters";

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

interface PasteBody {
  content: string;
  name: string;
  typology: string;
  notes?: string;
}

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
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!TYPOLOGY_MAP[body.typology]) {
    return NextResponse.json({ error: "Valid typology is required" }, { status: 400 });
  }

  const chapters = splitChapters(body.content);

  const memo = await prisma.memo.create({
    data: {
      name: body.name.trim(),
      typology: TYPOLOGY_MAP[body.typology],
      notes: body.notes?.trim() ?? null,
      content: body.content,
      chapters: chapters as never,
    },
  });

  return NextResponse.json({
    memoId: memo.id,
    name: memo.name,
    chapterCount: chapters.length,
    chapters,
  });
}
