import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const TYPOLOGY_MAP: Record<string, "ONE_A" | "ONE_B" | "TWO_A" | "TWO_B"> = {
  "1A": "ONE_A", "1B": "ONE_B", "2A": "TWO_A", "2B": "TWO_B",
  ONE_A: "ONE_A", ONE_B: "ONE_B", TWO_A: "TWO_A", TWO_B: "TWO_B",
};

interface PatchBody {
  name?: string;
  typology?: string;
  notes?: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid memo ID" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    update.name = name;
  }

  if (typeof body.typology === "string") {
    const mapped = TYPOLOGY_MAP[body.typology];
    if (!mapped) {
      return NextResponse.json(
        { error: `Invalid typology: ${body.typology}. Use ONE_A, ONE_B, TWO_A, TWO_B, 1A, 1B, 2A, or 2B.` },
        { status: 400 }
      );
    }
    update.typology = mapped;
  }

  if ("notes" in body) {
    update.notes = body.notes ?? null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const memo = await prisma.memo.update({
      where: { id },
      data: update as Parameters<typeof prisma.memo.update>[0]["data"],
      select: { id: true, name: true, typology: true, notes: true },
    });
    return NextResponse.json(memo);
  } catch {
    return NextResponse.json({ error: "Memo not found or update failed" }, { status: 404 });
  }
}
