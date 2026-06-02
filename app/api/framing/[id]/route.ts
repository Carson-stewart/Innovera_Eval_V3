import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid framing id" }, { status: 400 });

  let content: string;
  try {
    const body = (await req.json()) as { content?: string };
    if (typeof body.content !== "string" || !body.content.trim())
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    content = body.content;
  } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const updated = await prisma.framing.update({ where: { id }, data: { content } });
    return NextResponse.json({ framingId: updated.id });
  } catch { return NextResponse.json({ error: "Framing not found" }, { status: 404 }); }
}