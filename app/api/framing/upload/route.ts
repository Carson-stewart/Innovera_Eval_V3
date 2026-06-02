import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseFile, UnsupportedFileTypeError } from "@/lib/ingest/parseFile";

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

  const sourceType = file.name.toLowerCase().endsWith(".docx") ? "DOCX" : "CHAT";

  const framing = await prisma.framing.create({
    data: {
      name: file.name,
      sourceType: sourceType as "DOCX" | "CHAT",
      content,
    },
  });

  return NextResponse.json({
    framingId: framing.id,
    content,
    preview: content.slice(0, 300),
  });
}
