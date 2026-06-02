import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseFile, UnsupportedFileTypeError } from "@/lib/ingest/parseFile";
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const typologyRaw = formData.get("typology");
  if (typeof typologyRaw !== "string" || !TYPOLOGY_MAP[typologyRaw]) {
    return NextResponse.json({ error: "Valid typology is required" }, { status: 400 });
  }
  const typology = TYPOLOGY_MAP[typologyRaw];

  const nameRaw = formData.get("name");
  const memoName = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : file.name;
  const notesRaw = formData.get("notes");
  const notes = typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : undefined;

  const buffer = Buffer.from(await file.arrayBuffer());

  let content: string;
  try {
    content = await parseFile(buffer, file.name);
  } catch (err) {
    if (err instanceof UnsupportedFileTypeError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  const chapters = splitChapters(content);

  const memo = await prisma.memo.create({
    data: {
      name: memoName,
      typology,
      notes: notes ?? null,
      content,
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
