import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

interface SanityCheckRequestBody {
  framingDocId: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: SanityCheckRequestBody;

  try {
    body = (await req.json()) as SanityCheckRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { framingDocId } = body;

  if (typeof framingDocId !== "number") {
    return NextResponse.json(
      { error: "Missing required field: framingDocId" },
      { status: 400 }
    );
  }

  const { ids } = await inngest.send({
    name: "framing/sanity-check.requested",
    data: { framingDocId },
  });

  return NextResponse.json({ eventId: ids[0] ?? null });
}
