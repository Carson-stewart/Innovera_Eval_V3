import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const INNGEST_BASE_URL = process.env.INNGEST_BASE_URL ?? "http://localhost:8288";

interface ProgressResponse {
  status: "running" | "completed" | "failed";
  sanityCheckId?: number;
}

interface InngestRun {
  run_id?: string;
  status?: string;
  output?: unknown;
}

interface InngestStep {
  display_name?: string;
  name?: string;
  status?: string;
}

interface InngestRunDetail {
  status?: string;
  output?: unknown;
  steps?: InngestStep[];
}

function mapRunStatus(raw: string | undefined): "running" | "completed" | "failed" {
  if (!raw) return "running";
  const s = raw.toLowerCase();
  if (s === "completed") return "completed";
  if (s === "failed" || s === "cancelled") return "failed";
  return "running";
}

function parseOutput(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const sanityCheckIdParam = req.nextUrl.searchParams.get("sanityCheckId");
  const sanityCheckId = sanityCheckIdParam ? parseInt(sanityCheckIdParam, 10) : null;

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  try {
    const eventRes = await fetch(`${INNGEST_BASE_URL}/v1/events/${eventId}/runs`, {
      headers: { Accept: "application/json" },
    });

    if (!eventRes.ok) {
      return dbFallback(sanityCheckId);
    }

    const eventData = (await eventRes.json()) as Record<string, unknown>;
    const runs = (eventData.data ?? eventData.runs ?? []) as InngestRun[];
    const firstRun = runs[0];

    if (!firstRun?.run_id) {
      return dbFallback(sanityCheckId);
    }

    const runId = firstRun.run_id;

    const runRes = await fetch(`${INNGEST_BASE_URL}/v1/runs/${runId}`, {
      headers: { Accept: "application/json" },
    });

    if (!runRes.ok) {
      return dbFallback(sanityCheckId);
    }

    const runRaw = (await runRes.json()) as Record<string, unknown>;
    const runDetail = (
      runRaw.data && typeof runRaw.data === "object" ? runRaw.data : runRaw
    ) as InngestRunDetail;

    const runStatus = mapRunStatus(runDetail.status);
    const response: ProgressResponse = { status: runStatus };

    if (runStatus === "completed") {
      const output = parseOutput(runDetail.output);
      const rawId = output?.sanityCheckId;
      const resolvedId =
        typeof rawId === "number" ? rawId :
        typeof rawId === "string" ? parseInt(rawId, 10) :
        null;

      if (resolvedId && !isNaN(resolvedId)) {
        response.sanityCheckId = resolvedId;
      } else {
        const fallback = await latestSanityCheckId(sanityCheckId);
        if (fallback) response.sanityCheckId = fallback;
      }
    }

    return NextResponse.json(response);
  } catch {
    return dbFallback(sanityCheckId);
  }
}

async function latestSanityCheckId(id: number | null): Promise<number | null> {
  try {
    if (id) {
      const check = await prisma.sanityCheck.findUnique({
        where: { id },
        select: { id: true },
      });
      return check?.id ?? null;
    }
    const check = await prisma.sanityCheck.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return check?.id ?? null;
  } catch {
    return null;
  }
}

async function dbFallback(sanityCheckId: number | null): Promise<NextResponse> {
  if (sanityCheckId) {
    const id = await latestSanityCheckId(sanityCheckId);
    if (id) {
      return NextResponse.json<ProgressResponse>({
        status: "completed",
        sanityCheckId: id,
      });
    }
  }
  return NextResponse.json<ProgressResponse>({ status: "running" });
}
