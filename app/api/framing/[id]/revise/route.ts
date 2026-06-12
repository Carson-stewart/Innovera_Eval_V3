import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/framing/[id]/revise — persist a Revised Framing as a new,
 * versioned Framing row (T2). The [id] in the path is the ORIGINAL framing;
 * that row is never modified here — revision creation is insert-only.
 *
 * Body: {
 *   content: string;        // the assembled (possibly inline-edited) text
 *   sourceCheckId: number;  // the SanityCheck the text was assembled from
 *   manualEdits: boolean;   // true when the text was edited after assembly
 *   mode?: "fix-list" | "merged"; // assembly mode (default fix-list) — merged =
 *                                 // rewrites applied into the original content
 * }
 *
 * Lineage rules:
 *  - revisions always chain off the ROOT framing: revising a revision attaches
 *    the new row to the same parent (flat sibling chain, monotonically
 *    numbered), so "revision N of <original>" stays unambiguous;
 *  - revisionNumber = max(existing) + 1 under that parent;
 *  - typology and sourceType are inherited from the parent (the revision is
 *    the same document, corrected).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid framing id" }, { status: 400 });
  }

  let body: {
    content?: string;
    sourceCheckId?: number;
    manualEdits?: boolean;
    mode?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (typeof body.sourceCheckId !== "number") {
    return NextResponse.json({ error: "sourceCheckId is required" }, { status: 400 });
  }

  const framing = await prisma.framing.findUnique({ where: { id } });
  if (!framing) {
    return NextResponse.json({ error: "Framing not found" }, { status: 404 });
  }

  // Chain off the root: if [id] is itself a revision, attach to its parent.
  const rootId = framing.parentFramingId ?? framing.id;
  const root = framing.parentFramingId
    ? await prisma.framing.findUnique({ where: { id: rootId } })
    : framing;
  if (!root) {
    return NextResponse.json({ error: "Parent framing not found" }, { status: 404 });
  }

  const latest = await prisma.framing.aggregate({
    where: { parentFramingId: rootId },
    _max: { revisionNumber: true },
  });
  const revisionNumber = (latest._max.revisionNumber ?? 0) + 1;

  const revision = await prisma.framing.create({
    data: {
      name: `${root.name} (rev ${revisionNumber})`,
      sourceType: root.sourceType,
      typology: root.typology,
      content: body.content,
      parentFramingId: rootId,
      revisionNumber,
      revisionSource:
        (body.mode === "merged" ? "sanity-merged" : "sanity-rewrites") +
        (body.manualEdits ? "+manual-edits" : ""),
      sourceCheckId: body.sourceCheckId,
    },
  });

  return NextResponse.json({
    framingId: revision.id,
    name: revision.name,
    revisionNumber,
    parentFramingId: rootId,
  });
}
