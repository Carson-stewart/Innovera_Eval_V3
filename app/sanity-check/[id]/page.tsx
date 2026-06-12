import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { SanityCheckClient, type FramingLineage } from "./SanityCheckClient";

interface Props {
  params: { id: string };
}

export default async function SanityCheckPage({ params }: Props) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) notFound();

  const check = await prisma.sanityCheck.findUnique({
    where: { id },
    include: {
      sanityIssues: { orderBy: { id: "asc" } },
      framing: {
        select: {
          id: true,
          name: true,
          content: true,
          parentFramingId: true,
          revisionNumber: true,
          parent: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!check) notFound();

  // Revision lineage (T2): list every revision chained off this framing's
  // root, each with its latest check (verdicts belong to framing × check run —
  // a revision shows "not checked" until it has its own run).
  const rootId = check.framing.parentFramingId ?? check.framing.id;
  const rootName = check.framing.parent?.name ?? check.framing.name;
  const revisionRows = await prisma.framing.findMany({
    where: { parentFramingId: rootId },
    orderBy: { revisionNumber: "asc" },
    include: {
      sanityChecks: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, verdict: true, gateVerdict: true, createdAt: true },
      },
    },
  });

  const lineage: FramingLineage = {
    framingId: check.framing.id,
    framingName: check.framing.name,
    revisionNumber: check.framing.revisionNumber,
    rootId,
    rootName,
    revisions: revisionRows.map((r) => {
      const latest = r.sanityChecks[0] ?? null;
      return {
        id: r.id,
        name: r.name,
        revisionNumber: r.revisionNumber,
        revisionSource: r.revisionSource,
        createdAt: r.createdAt.toISOString(),
        latestCheck: latest
          ? {
              id: latest.id,
              verdict: String(latest.verdict),
              gateVerdict: latest.gateVerdict,
              createdAt: latest.createdAt.toISOString(),
            }
          : null,
      };
    }),
  };

  const { framing: _framing, ...checkRow } = check;

  return (
    <SanityCheckClient
      check={JSON.parse(JSON.stringify(checkRow))}
      lineage={lineage}
      framingContent={check.framing.content}
    />
  );
}
