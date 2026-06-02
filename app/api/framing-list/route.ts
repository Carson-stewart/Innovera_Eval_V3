import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const framings = await prisma.framing.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        typology: true,
        sourceType: true,
        createdAt: true,
        content: true,
      },
    });
    return NextResponse.json({ framings });
  } catch (e) {
    console.error("[framing-list]", e);
    return NextResponse.json({ error: "Failed to load framings" }, { status: 500 });
  }
}
