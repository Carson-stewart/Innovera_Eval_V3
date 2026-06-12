/** READ-ONLY: identify which framing version rows 63/64/65 contain. */
import "dotenv/config";
import { createHash } from "node:crypto";
import { prisma } from "../../lib/db";

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

async function main() {
  const rows = await prisma.framing.findMany({
    where: { name: { contains: "Daikin" } },
    select: {
      id: true, name: true, createdAt: true, content: true,
      parentFramingId: true, revisionNumber: true,
      sanityChecks: { select: { id: true, gateVerdict: true, createdAt: true } },
    },
    orderBy: { id: "asc" },
  });
  for (const r of rows) {
    console.log(
      `#${r.id} ${r.name.slice(0, 60)} | ${r.content.length} chars sha=${sha(r.content)} | ` +
      `rev=${r.revisionNumber ?? "-"} parent=${r.parentFramingId ?? "-"} | ` +
      `checks=[${r.sanityChecks.map((c) => `${c.id}:${c.gateVerdict}`).join(",")}] | ${r.createdAt.toISOString().slice(0, 16)}`
    );
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
