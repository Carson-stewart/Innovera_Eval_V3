# E3 — Daikin v12 Edit Record

Source: `2026-02-11_Daikin_Oxi_Corporate_v11.md` → `2026-02-11_Daikin_Oxi_Corporate_v12.md`
(both in `C:\Users\cstew\Downloads`; v12 is ready for Carson to upload and score 3×).

Exactly the four audited conflicts were edited — minimal text changes, nothing else
reworded. Each replacement was applied with an exact-match assertion (count == 1) so
no edit could silently land elsewhere.

## Edit 1 — Units-to-target standardized at ~2,700/yr (arithmetically correct: ¥1bn ≈ $6.7M ÷ $2,500 ≈ 2,680)
- Risks bullet (Pricing-Volume Conflict): ~2,500 → ~2,700 units annually
- Revenue Model (Implied Unit Pricing): approximately 2,500 → 2,700 units annually
- Cost Structure (Manufacturing Scale): (2,500 units/year) → (2,700 units/year)
- Unit Economics (Pricing implications): ~3,000–4,000 → ~2,700 units annually
- Finance & Operations already said ~2,700 (2 pre-existing sites, untouched).
- NOT changed: "a fleet of 2,500+ units" (Cost Structure service-risk sentence) — an
  installed-fleet size, not the annual units-to-target figure, and "2,500+" is not
  numerically contradicted by 2,700/yr. Watch item if the scorer reads it as the same claim.

## Edit 2 — One growth rate: 6.4% through 2033
- Revenue Model: "CAGR of 7.6% through 2033" (cited to GVR's *U.S.* report) →
  "approximately 6.4% through 2033" cited to the *global* GVR report used everywhere
  else. Figure and source swapped together so the citation stays truthful.

## Edit 3 — One TAM forecast: $8.31B by 2033 (Grand View Research); 2035 framing explicitly labeled as the Fact.MR extension
- Executive Summary, Opportunity Validation overview, Market Research TAM paragraph,
  Market Research key-facts list: "nearly $10 billion by 2035" → "$8.31 billion by
  2033 (… extended to 2035 approaches $10 billion per Fact.MR)"
- Opportunity Validation key fact: "$8.3–9.6 billion by 2033–2035" → "$8.31 billion
  by 2033 (extending to ~$9.6 billion by 2035 per Fact.MR)"
- Market Timing & Catalysts: "Other estimates forecast … $9.6 billion by 2035" →
  "On the longer Fact.MR horizon, the same growth trajectory reaches roughly $9.6
  billion by 2035" (extension framing, not a competing forecast; Fact.MR link kept).

## Edit 4 — Unit Economics internally reconciled on the 45% base case
- The scenario table is untouched (Base Case $2,500 / 45% / $1,125 GP / $1,200 CAC /
  >1 Unit / 0.9x / Unprofitable).
- The CAC-section prose that asserted "50% GM ($1,250 GP) → Payback is Immediate"
  now reads: base-case 45% GM ($1,125 gross profit) → payback takes more than one
  unit, marginally unprofitable (LTV/CAC ≈ 0.9x); 50% GM is the upside scenario
  where payback turns immediate with near-zero first-unit profit. Table and prose
  assert one consistent story and the arithmetic matches.

## Verification (string-count audit, v11 → v12)
- "2,700 units": 2 → 6 (delta exactly the 4 unit edits)
- "8.31 billion by 2033": 1 → 6 (delta exactly the 5 TAM edits)
- Old conflict strings ("~2,500 units annually", "3,000–4,000 units annually",
  "7.6%", bare "nearly $10 billion by 2035", "50% GM ($1,250 GP) … Payback is
  Immediate"): 0 occurrences remain.

## Full unified diff (every changed line)

```diff
--- v11
+++ v12
@@ -75 +75 @@
-The venture targets a 2030 revenue goal of ¥1 billion (\~$6.7M) with 40–50% gross margins, requiring Daikin to capture approximately 1.5% of the estimated $460 million Serviceable Addressable Market (SAM) for non-medical stationary oxygen devices. While the global oxygen concentrator market is projected to reach nearly $10 billion by 2035, demand is driven 85% by medical necessity (COPD), leaving the corporate wellness segment as an unproven "Blue Ocean." The value proposition relies on internal research indicating a 13% improvement in memorization tasks, but there is currently zero empirical evidence that corporate buyers will pay medical-grade prices ($2,500+) for this productivity gain without insurance reimbursement.
+The venture targets a 2030 revenue goal of ¥1 billion (\~$6.7M) with 40–50% gross margins, requiring Daikin to capture approximately 1.5% of the estimated $460 million Serviceable Addressable Market (SAM) for non-medical stationary oxygen devices. While the global oxygen concentrator market is projected to reach $8.31 billion by 2033 (Grand View Research; the same forecast extended to 2035 approaches $10 billion per Fact.MR), demand is driven 85% by medical necessity (COPD), leaving the corporate wellness segment as an unproven "Blue Ocean." The value proposition relies on internal research indicating a 13% improvement in memorization tasks, but there is currently zero empirical evidence that corporate buyers will pay medical-grade prices ($2,500+) for this productivity gain without insurance reimbursement.
@@ -119 +119 @@
-The global oxygen concentrator market is valued at approximately $5 billion (2025) and projected to reach nearly $10 billion by 2035, though 85% of this demand stems from medical necessity. The Serviceable Addressable Market (SAM) for non-medical stationary devices is estimated at approximately $460 million globally. To achieve the 2030 revenue target of ¥1 billion (\~$6.7 million), Daikin requires a market share of roughly 1.5% of this specific non-medical niche. Growth is driven by a "flight to quality" in commercial real estate, where employers invest in wellness amenities to combat burnout. However, the market is currently in the "Innovator" stage with no established category for office oxygen. Daikin must create demand rather than capture existing budget lines. Primary headwinds include the "medicalization" stigma of oxygen devices and cultural skepticism regarding air performance products, particularly in Japan.
+The global oxygen concentrator market is valued at approximately $5 billion (2025) and projected to reach $8.31 billion by 2033 (Grand View Research; extended to 2035, the same forecast approaches $10 billion per Fact.MR), though 85% of this demand stems from medical necessity. The Serviceable Addressable Market (SAM) for non-medical stationary devices is estimated at approximately $460 million globally. To achieve the 2030 revenue target of ¥1 billion (\~$6.7 million), Daikin requires a market share of roughly 1.5% of this specific non-medical niche. Growth is driven by a "flight to quality" in commercial real estate, where employers invest in wellness amenities to combat burnout. However, the market is currently in the "Innovator" stage with no established category for office oxygen. Daikin must create demand rather than capture existing budget lines. Primary headwinds include the "medicalization" stigma of oxygen devices and cultural skepticism regarding air performance products, particularly in Japan.
@@ -369 +369 @@
-The global oxygen concentrator market is entering a period of sustained growth, projected to expand from approximately $4.85 billion in 2024 to $8.31 billion by 2033, with a CAGR of 6.4% <a target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-600 cursor-pointer" href="https://www.grandviewresearch.com/industry-analysis/medical-oxygen-concentrators-market">Grand View Research — Oxygen Concentrator Market Size | Industry Report, 2033</a>, <a target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-600 cursor-pointer" href="https://www.grandviewresearch.com/press-release/global-medical-oxygen-concentrators-market">Grand View Research — Oxygen Concentrator Market To Reach $8.31 Billion By 2033</a>. Other estimates forecast the market reaching nearly $9.6 billion by 2035 <a target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-600 cursor-pointer" href="https://www.factmr.com/report/oxygen-concentrator-market">Fact.MR — Oxygen Concentrator Market</a>.
+The global oxygen concentrator market is entering a period of sustained growth, projected to expand from approximately $4.85 billion in 2024 to $8.31 billion by 2033, with a CAGR of 6.4% <a target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-600 cursor-pointer" href="https://www.grandviewresearch.com/industry-analysis/medical-oxygen-concentrators-market">Grand View Research — Oxygen Concentrator Market Size | Industry Report, 2033</a>, <a target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-600 cursor-pointer" href="https://www.grandviewresearch.com/press-release/global-medical-oxygen-concentrators-market">Grand View Research — Oxygen Concentrator Market To Reach $8.31 Billion By 2033</a>. On the longer Fact.MR horizon, the same growth trajectory reaches roughly $9.6 billion by 2035 <a target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-600 cursor-pointer" href="https://www.factmr.com/report/oxygen-concentrator-market">Fact.MR — Oxygen Concentrator Market</a>.
@@ -574 +574 @@
-*   The market is projected to reach $8.3 billion to $9.6 billion by 2033–2035, growing at a CAGR of approximately 6.4%.
+*   The market is projected to reach $8.31 billion by 2033 (extending to ~$9.6 billion by 2035 per Fact.MR), growing at a CAGR of approximately 6.4%.
@@ -949 +949 @@
-The global oxygen concentrator market serves as the foundational Total Addressable Market (TAM) for Daikin’s entry. As established in \[CHAPTER: Opportunity Validation\], this market is valued at approximately $5 billion (2025) with a projected growth trajectory reaching nearly $10 billion by 2035.
+The global oxygen concentrator market serves as the foundational Total Addressable Market (TAM) for Daikin’s entry. As established in \[CHAPTER: Opportunity Validation\], this market is valued at approximately $5 billion (2025) with a projected growth trajectory reaching $8.31 billion by 2033 (Grand View Research; approaching $10 billion by 2035 on the extended Fact.MR horizon).
@@ -1218 +1218 @@
-- The global oxygen concentrator market is valued at approximately $5 billion in 2025 with a projected growth to nearly $10 billion by 2035.
+- The global oxygen concentrator market is valued at approximately $5 billion in 2025, projected to reach $8.31 billion by 2033 (approaching $10 billion by 2035 on the extended Fact.MR horizon).
@@ -1966 +1966 @@
-*   **Pricing-Volume Conflict**: Achieving the ¥1 billion revenue target requires selling ~2,500 units annually at premium pricing, but the lack of insurance reimbursement creates pressure to lower prices toward consumer levels ($1,000–$1,500), potentially eroding the 40–50% gross margin target.
+*   **Pricing-Volume Conflict**: Achieving the ¥1 billion revenue target requires selling ~2,700 units annually at premium pricing, but the lack of insurance reimbursement creates pressure to lower prices toward consumer levels ($1,000–$1,500), potentially eroding the 40–50% gross margin target.
@@ -2092 +2092 @@
-The oxygen concentrator market is projected to grow at a CAGR of 7.6% through 2033 <a target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-600 cursor-pointer" href="https://www.grandviewresearch.com/industry-analysis/us-oxygen-concentrator-market-report">Grand View Research — U.S. Oxygen Concentrator Market | Industry Report, 2033</a>. As the market expands, commoditization is a threat. Low-cost imports could drive hardware prices down, similar to the trajectory of standard air purifiers. Daikin’s defense against price erosion lies in its "Air Solutions" integration strategy, bundling the commodity hardware with proprietary building management services that competitors cannot easily replicate.
+The oxygen concentrator market is projected to grow at a CAGR of approximately 6.4% through 2033 <a target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-600 cursor-pointer" href="https://www.grandviewresearch.com/industry-analysis/medical-oxygen-concentrators-market">Grand View Research — Oxygen Concentrator Market Size | Industry Report, 2033</a>. As the market expands, commoditization is a threat. Low-cost imports could drive hardware prices down, similar to the trajectory of standard air purifiers. Daikin’s defense against price erosion lies in its "Air Solutions" integration strategy, bundling the commodity hardware with proprietary building management services that competitors cannot easily replicate.
@@ -2101 +2101 @@
-*   **Implied Unit Pricing**: Assuming a premium B2B price point comparable to medical POCs, Daikin would need to sell approximately 2,500 units annually to hit revenue targets.
+*   **Implied Unit Pricing**: Assuming a premium B2B price point comparable to medical POCs, Daikin would need to sell approximately 2,700 units annually to hit revenue targets.
@@ -2128 +2128 @@
-*   **Manufacturing Scale**: The target volume (2,500 units/year) is low compared to Daikin’s core air conditioning lines. This limits purchasing power leverage for specific oxygen-related components (e.g., molecular sieves), preventing significant unit cost reduction until volumes scale by an order of magnitude.
+*   **Manufacturing Scale**: The target volume (2,700 units/year) is low compared to Daikin’s core air conditioning lines. This limits purchasing power leverage for specific oxygen-related components (e.g., molecular sieves), preventing significant unit cost reduction until volumes scale by an order of magnitude.
@@ -2343 +2343 @@
-    *   To achieve the **¥1bn revenue target** by 2030, Daikin needs to sell significant volume. If priced at ~$2,500 (mid-point), that requires ~3,000–4,000 units annually.
+    *   To achieve the **¥1bn revenue target** by 2030, Daikin needs to sell significant volume. If priced at ~$2,500 (mid-point), that requires ~2,700 units annually.
@@ -2393 +2393 @@
-    *   If Daikin’s CAC mirrors Inogen (~$1,200) and the unit price is ~$2,500 with 50% GM ($1,250 GP), the **Payback is Immediate** but profit is near zero on the first unit.
+    *   If Daikin’s CAC mirrors Inogen (~$1,200) at a ~$2,500 unit price with the base-case 45% GM ($1,125 gross profit), gross profit per unit falls short of CAC — **payback takes more than one unit and the base case is marginally unprofitable (LTV/CAC ≈ 0.9x)**. Only at the upside 50% GM ($1,250 GP) does payback turn immediate, and even then profit is near zero on the first unit.
```
