import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/framing/[id] — framing lookup for the Score Memo handoff (T1).
 * Returns name, content and revision lineage; 404 when the framing was
 * deleted between check and scoring (the client shows "no longer available").
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid framing id" }, { status: 400 });

  const framing = await prisma.framing.findUnique({
    where: { id },
    include: { parent: { select: { id: true, name: true } } },
  });
  if (!framing) {
    return NextResponse.json({ error: "Framing not found" }, { status: 404 });
  }

  return NextResponse.json({
    framingId: framing.id,
    name: framing.name,
    content: framing.content,
    typology: framing.typology,
    createdAt: framing.createdAt.toISOString(),
    parentFramingId: framing.parentFramingId,
    revisionNumber: framing.revisionNumber,
    revisionSource: framing.revisionSource,
    sourceCheckId: framing.sourceCheckId,
    parentName: framing.parent?.name ?? null,
  });
}

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