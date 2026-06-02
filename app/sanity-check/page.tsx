import { TopBar } from "@/components/shell/TopBar";
import { prisma } from "@/lib/db";
import Link from "next/link";

const VERDICT_STYLES: Record<string, { label: string; cls: string }> = {
  READY_FOR_DELIVERY:  { label: "Ready for Delivery", cls: "bg-green-100 text-green-800 border-green-300" },
  REVISIONS_REQUIRED:  { label: "Revisions Required", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  MAJOR_REWORK_NEEDED: { label: "Major Rework Needed", cls: "bg-red-100 text-red-800 border-red-300" },
  READY_FOR_ANALYSIS:  { label: "Ready for Analysis",  cls: "bg-green-100 text-green-800 border-green-300" },
};

export default async function SanityCheckLandingPage() {
  const checks = await prisma.sanityCheck.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      framing: { select: { id: true, name: true, typology: true } },
      _count: { select: { sanityIssues: true } },
    },
  });

  return (
    <>
      <TopBar title="Sanity Check" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[860px] mx-auto px-6 py-6 space-y-5">

          {/* Header + CTA */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sanity Check</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Quality-gate your decision framings across 48 checks before scoring.
              </p>
            </div>
            <Link
              href="/upload-framing"
              className="px-5 py-2.5 bg-brand-orange text-white rounded-xl font-semibold text-sm hover:bg-brand-orange-hover transition-colors shadow-sm"
            >
              + New Sanity Check
            </Link>
          </div>

          {/* Empty state */}
          {checks.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-16 text-center">
              <p className="text-lg font-semibold text-gray-700 mb-2">No sanity checks yet</p>
              <p className="text-sm text-gray-500 mb-6">
                Upload or paste a framing document to run your first quality check.
              </p>
              <Link
                href="/upload-framing"
                className="inline-block px-6 py-3 bg-brand-orange text-white rounded-xl font-semibold hover:bg-brand-orange-hover transition-colors"
              >
                Run your first sanity check
              </Link>
            </div>
          )}

          {/* Checks list */}
          {checks.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_90px_110px_70px_80px_90px] gap-x-3 px-5 py-2.5 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <span>Framing</span>
                <span>Type</span>
                <span>Verdict</span>
                <span>Issues</span>
                <span>Pass</span>
                <span>Date</span>
              </div>

              {checks.map((c) => {
                const verdict = VERDICT_STYLES[c.verdict] ?? { label: String(c.verdict), cls: "bg-gray-100 text-gray-600 border-gray-200" };
                const typology = c.typology ?? (c.framing.typology ? String(c.framing.typology).replace("_", "") : null);
                return (
                  <Link
                    key={c.id}
                    href={`/sanity-check/${c.id}`}
                    className="grid grid-cols-[1fr_90px_110px_70px_80px_90px] gap-x-3 px-5 py-3.5 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50 transition-colors"
                  >
                    {/* Framing name */}
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {c.framing.name}
                    </span>

                    {/* Typology */}
                    <span className="text-xs text-gray-500 font-mono">{typology ?? "—"}</span>

                    {/* Verdict badge */}
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 border w-fit ${verdict.cls}`}>
                      {verdict.label}
                    </span>

                    {/* Issue count */}
                    <span className="text-sm text-gray-700">
                      {c._count.sanityIssues > 0 ? (
                        <span className="font-semibold text-amber-700">{c._count.sanityIssues}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </span>

                    {/* Pass count */}
                    <span className="text-sm font-mono text-gray-600">{c.passCount}</span>

                    {/* Date */}
                    <span className="text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
