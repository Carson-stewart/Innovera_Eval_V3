import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Wipe existing benchmark entries so the seed is idempotent
  await prisma.benchmarkEntry.deleteMany({});

  await prisma.benchmarkEntry.createMany({
    data: [
      // ─── Typology 1A — External Investment ───────────────────────────────
      {
        typology: "ONE_A",
        metric: "Target IRR (PE/strategic)",
        plausibleRange: "15–25%",
        boundaryRange: "10–15% / 25–35%",
        outOfRange: "<10% / >35%",
        sources: "McKinsey, Bain",
      },
      {
        typology: "ONE_A",
        metric: "PE LP hurdle rate",
        plausibleRange: "7–10%",
        boundaryRange: "5–7%",
        outOfRange: "<5%",
        sources: "EQT, Hamilton Lane",
      },
      {
        typology: "ONE_A",
        metric: "Deal entry multiple (EV/EBITDA)",
        plausibleRange: "6–12×",
        boundaryRange: "12–16×",
        outOfRange: ">16× / <4×",
        sources: "McKinsey, Bain",
      },
      {
        typology: "ONE_A",
        metric: "Revenue growth (target, Y1–3)",
        plausibleRange: "15–35%",
        boundaryRange: "8–15% / 35–60%",
        outOfRange: "<5% / >80% (non-AI)",
        sources: "Lighter Capital, SaaS Capital",
      },
      {
        typology: "ONE_A",
        metric: "Gross margin (SaaS target)",
        plausibleRange: "65–82%",
        boundaryRange: "60–65% / 82–88%",
        outOfRange: "<55% / >90%",
        sources: "Eagle Rock CFO, Maxio",
      },
      {
        typology: "ONE_A",
        metric: "Gross margin (hardware/industrial)",
        plausibleRange: "30–50%",
        boundaryRange: "25–30% / 50–60%",
        outOfRange: "<20% / >65%",
        sources: "Eagle Rock CFO",
      },
      {
        typology: "ONE_A",
        metric: "Gross margin (manufacturing)",
        plausibleRange: "20–40%",
        boundaryRange: "15–20% / 40–50%",
        outOfRange: "<12% / >55%",
        sources: "Viking Mergers, Vena",
      },
      {
        typology: "ONE_A",
        metric: "LTV:CAC (SaaS target)",
        plausibleRange: "3:1–6:1",
        boundaryRange: "2:1–3:1",
        outOfRange: "<2:1",
        sources: "Optifai",
      },
      {
        typology: "ONE_A",
        metric: "CAC payback (enterprise)",
        plausibleRange: "14–24 mo",
        boundaryRange: "12–14 / 24–30 mo",
        outOfRange: "<8 / >36 mo",
        sources: "Optifai, Benchmarkit",
      },
      {
        typology: "ONE_A",
        metric: "NRR (SaaS target)",
        plausibleRange: "95–120%",
        boundaryRange: "88–95%",
        outOfRange: "<85%",
        sources: "Maxio, Understory",
      },

      // ─── Typology 1B — Internal Initiative ───────────────────────────────
      {
        typology: "ONE_B",
        metric: "Corporate hurdle rate / WACC",
        plausibleRange: "8–15%",
        boundaryRange: "6–8% / 15–20%",
        outOfRange: "<5% / >25%",
        sources: "Wall Street Prep, Eqvista",
      },
      {
        typology: "ONE_B",
        metric: "Project IRR (internal)",
        plausibleRange: "15–30%",
        boundaryRange: "10–15% / 30–45%",
        outOfRange: "<8% / >50%",
        sources: "Wall Street Prep, Eqvista",
      },
      {
        typology: "ONE_B",
        metric: "Payback period (capex)",
        plausibleRange: "2–5 yr",
        boundaryRange: "1–2 / 5–8 yr",
        outOfRange: "<1 / >10 yr",
        sources: "Vena, Eagle Rock CFO",
      },
      {
        typology: "ONE_B",
        metric: "Revenue uplift from initiative",
        plausibleRange: "3–20%",
        boundaryRange: "1–3% / 20–40%",
        outOfRange: ">50% (no justification)",
        sources: "McKinsey, Bain",
      },
      {
        typology: "ONE_B",
        metric: "Cost reduction target",
        plausibleRange: "5–25%",
        boundaryRange: "2–5% / 25–40%",
        outOfRange: ">50% (single initiative)",
        sources: "McKinsey, Bain",
      },
      {
        typology: "ONE_B",
        metric: "Headcount change",
        plausibleRange: "±10–30%",
        boundaryRange: "±30–50%",
        outOfRange: ">±50% (no justification)",
        sources: "Deloitte, ISM",
      },
      {
        typology: "ONE_B",
        metric: "Implementation timeline",
        plausibleRange: "6–24 mo",
        boundaryRange: "3–6 / 24–48 mo",
        outOfRange: "<3 mo / >5 yr",
        sources: "McKinsey, Bain",
      },
      {
        typology: "ONE_B",
        metric: "CapEx as % of revenue",
        plausibleRange: "2–15%",
        boundaryRange: "15–25%",
        outOfRange: ">30% (non-infrastructure)",
        sources: "Vena, Eagle Rock CFO",
      },

      // ─── Typology 2A — New Market Entry ──────────────────────────────────
      {
        typology: "TWO_A",
        metric: "TAM claim",
        plausibleRange: "Bottom-up or cited top-down",
        boundaryRange: "TAM >10× realistic segment",
        outOfRange: "Top-down only, no bottom-up",
        sources: "High Alpha, McKinsey",
      },
      {
        typology: "TWO_A",
        metric: "Year 1 market share",
        plausibleRange: "0.1–3%",
        boundaryRange: "3–8%",
        outOfRange: ">10% (no justification)",
        sources: "High Alpha, McKinsey",
      },
      {
        typology: "TWO_A",
        metric: "Revenue growth (Y1–3, from zero)",
        plausibleRange: "40–150%",
        boundaryRange: "150–300%",
        outOfRange: ">300%",
        sources: "Lighter Capital, High Alpha",
      },
      {
        typology: "TWO_A",
        metric: "Time to breakeven",
        plausibleRange: "18–48 mo",
        boundaryRange: "12–18 / 48–72 mo",
        outOfRange: "<12 mo / >7 yr",
        sources: "High Alpha, SaaS Capital",
      },
      {
        typology: "TWO_A",
        metric: "Gross margin (SaaS)",
        plausibleRange: "65–82%",
        boundaryRange: "60–65%",
        outOfRange: "<55%",
        sources: "Eagle Rock CFO, Maxio",
      },
      {
        typology: "TWO_A",
        metric: "Gross margin (industrial/services)",
        plausibleRange: "30–55%",
        boundaryRange: "25–30%",
        outOfRange: "<20%",
        sources: "Viking Mergers, Eagle Rock CFO",
      },
      {
        typology: "TWO_A",
        metric: "CAC payback (B2B enterprise)",
        plausibleRange: "14–24 mo",
        boundaryRange: "12–14 mo",
        outOfRange: "<8 mo (new market)",
        sources: "Optifai, Benchmarkit",
      },
      {
        typology: "TWO_A",
        metric: "Initial capital requirement",
        plausibleRange: "Consistent w/ headcount+GTM+infra",
        boundaryRange: "Cap ask <6 mo opex, no bridge",
        outOfRange: null,
        sources: "High Alpha, SaaS Capital",
      },

      // ─── Typology 2B — New Product Launch ────────────────────────────────
      {
        typology: "TWO_B",
        metric: "Year 1 revenue",
        plausibleRange: "Consistent w/ sales cycle + ramp",
        boundaryRange: "Y1 >20% of mature-state revenue",
        outOfRange: null,
        sources: "Lighter Capital, High Alpha",
      },
      {
        typology: "TWO_B",
        metric: "Revenue growth (Y1–3, from launch)",
        plausibleRange: "30–120%",
        boundaryRange: "120–200%",
        outOfRange: ">200% (no justification)",
        sources: "Lighter Capital, SaaS Capital",
      },
      {
        typology: "TWO_B",
        metric: "Gross margin (SaaS)",
        plausibleRange: "65–82%",
        boundaryRange: "55–65%",
        outOfRange: "<50%",
        sources: "Eagle Rock CFO, Maxio",
      },
      {
        typology: "TWO_B",
        metric: "Gross margin (hardware/device)",
        plausibleRange: "30–50%",
        boundaryRange: "25–30% / 50–60%",
        outOfRange: "<20%",
        sources: "Eagle Rock CFO",
      },
      {
        typology: "TWO_B",
        metric: "Time to product-market fit",
        plausibleRange: "6–18 mo",
        boundaryRange: "3–6 mo",
        outOfRange: "<3 mo (complex B2B)",
        sources: "High Alpha, SaaS Capital",
      },
      {
        typology: "TWO_B",
        metric: "CAC payback (mid-market)",
        plausibleRange: "14–18 mo",
        boundaryRange: "12–14 mo",
        outOfRange: "<8 mo",
        sources: "Optifai",
      },
      {
        typology: "TWO_B",
        metric: "Break-even timeline",
        plausibleRange: "24–60 mo",
        boundaryRange: "18–24 / 60–84 mo",
        outOfRange: "<18 mo / >7 yr",
        sources: "High Alpha, SaaS Capital",
      },
      {
        typology: "TWO_B",
        metric: "NRR (new product)",
        plausibleRange: "90–110%",
        boundaryRange: "85–90%",
        outOfRange: "<80%",
        sources: "Maxio, Understory",
      },

      // ─── Cross-Typology Reference ─────────────────────────────────────────
      {
        typology: "CROSS",
        metric: "B2B SaaS gross margin",
        plausibleRange: "65–82%",
        boundaryRange: null,
        outOfRange: null,
        sources: "Eagle Rock CFO, Maxio",
      },
      {
        typology: "CROSS",
        metric: "B2B SaaS revenue growth (median)",
        plausibleRange: "25–35%",
        boundaryRange: null,
        outOfRange: null,
        sources: "Lighter Capital, SaaS Capital",
      },
      {
        typology: "CROSS",
        metric: "B2B SaaS revenue growth (top quartile)",
        plausibleRange: "55–75%",
        boundaryRange: null,
        outOfRange: null,
        sources: "Lighter Capital",
      },
      {
        typology: "CROSS",
        metric: "CAC payback (SMB)",
        plausibleRange: "8–12 mo",
        boundaryRange: null,
        outOfRange: null,
        sources: "Optifai, Benchmarkit",
      },
      {
        typology: "CROSS",
        metric: "CAC payback (mid-market)",
        plausibleRange: "14–18 mo",
        boundaryRange: null,
        outOfRange: null,
        sources: "Optifai",
      },
      {
        typology: "CROSS",
        metric: "CAC payback (enterprise)",
        plausibleRange: "18–24 mo",
        boundaryRange: null,
        outOfRange: null,
        sources: "Optifai, Benchmarkit",
      },
      {
        typology: "CROSS",
        metric: "B2B SaaS NRR (median)",
        plausibleRange: "100–105%",
        boundaryRange: null,
        outOfRange: null,
        sources: "Maxio, Understory",
      },
      {
        typology: "CROSS",
        metric: "LTV:CAC (healthy)",
        plausibleRange: "3:1–5:1",
        boundaryRange: null,
        outOfRange: null,
        sources: "Optifai",
      },
      {
        typology: "CROSS",
        metric: "Manufacturing gross margin",
        plausibleRange: "20–40%",
        boundaryRange: null,
        outOfRange: null,
        sources: "Viking Mergers, Vena",
      },
      {
        typology: "CROSS",
        metric: "Semiconductor/industrial hardware GM",
        plausibleRange: "35–55%",
        boundaryRange: null,
        outOfRange: null,
        sources: "Eagle Rock CFO",
      },
      {
        typology: "CROSS",
        metric: "Professional services gross margin",
        plausibleRange: "40–65%",
        boundaryRange: null,
        outOfRange: null,
        sources: "Viking Mergers",
      },
      {
        typology: "CROSS",
        metric: "PE buyout target IRR",
        plausibleRange: "15–25%",
        boundaryRange: null,
        outOfRange: null,
        sources: "McKinsey, Bain",
      },
      {
        typology: "CROSS",
        metric: "PE LP hurdle rate",
        plausibleRange: "7–10%",
        boundaryRange: null,
        outOfRange: null,
        sources: "EQT, Hamilton Lane",
      },
      {
        typology: "CROSS",
        metric: "Corporate strategic investment IRR threshold",
        plausibleRange: "12–20%",
        boundaryRange: null,
        outOfRange: null,
        sources: "Wall Street Prep, Eqvista",
      },
      {
        typology: "CROSS",
        metric: "Manufacturing revenue growth (stable)",
        plausibleRange: "3–8%/yr",
        boundaryRange: null,
        outOfRange: null,
        sources: "ISM, Deloitte",
      },
    ],
  });

  const count = await prisma.benchmarkEntry.count();
  console.log(`Seeded ${count} BenchmarkEntry rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
