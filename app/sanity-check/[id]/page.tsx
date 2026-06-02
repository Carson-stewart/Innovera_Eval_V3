import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { SanityCheckClient } from "./SanityCheckClient";

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
    },
  });

  if (!check) notFound();

  return <SanityCheckClient check={JSON.parse(JSON.stringify(check))} />;
}
