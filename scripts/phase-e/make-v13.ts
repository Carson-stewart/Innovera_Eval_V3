/**
 * E3b — Daikin v12 → v13 edit script (Run #66 persisted-findings reconciliation).
 *
 *   npx tsx scripts/phase-e/make-v13.ts
 *
 * Applies the seven targeted edits (E1–E7) with per-edit exact-match assertions
 * (occurrence count must equal `expect` BEFORE the edit; every edit is a plain
 * string replacement, so nothing can land elsewhere). Emits a changed-line diff
 * and a string-count audit to stdout for the E3b-EDITS.md record.
 *
 * No LLM calls, no DB access — file-level transform only.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "C:\\Users\\cstew\\Downloads\\2026-02-11_Daikin_Oxi_Corporate_v12.md";
const DST = "C:\\Users\\cstew\\Downloads\\2026-02-11_Daikin_Oxi_Corporate_v13.md";

interface EditSpec {
  id: string;
  finding: string; // Run #66 finding(s) this edit clears
  old: string;
  new: string;
  expect?: number; // occurrences of `old` required pre-edit (default 1)
}

const EDITS: EditSpec[] = [
  {
    id: "E1+E7 — Highlights bullet: range reconciliation, ¥150/$ conversion, qualifier harmonized",
    finding: "F2 (major), F8 (minor), F12-exception",
    old: "- The venture targets ¥1 billion (\\~$6.7M) in annual revenue by 2030, requiring \\~1.5% market share of the estimated $460 million Serviceable Addressable Market (SAM).",
    new: "- The venture targets ¥1 billion (\\~$6.7M at ¥150/$) in annual revenue by 2030, requiring approximately 1.5% market share of the estimated $460 million Serviceable Addressable Market (SAM). The brief frames the ambition as ¥100M–¥1B by 2030; this memo plans against the upper bound (¥1B) as the success threshold, since the lower bound would not justify the program.",
  },
  {
    id: "E3 — Exec Summary (Should We Do It?): Fact.MR extension canonicalized",
    finding: "F3-pattern, F9",
    old: "(Grand View Research; the same forecast extended to 2035 approaches $10 billion per Fact.MR)",
    new: "(Grand View Research; the longer Fact.MR horizon reaches ~$9.6–10B by 2035)",
  },
  {
    id: "E2+E3 — Market Summary (Opportunity Validation): canonical TAM range + instructed GVR/Fact.MR merge",
    finding: "F1, F3 (majors)",
    old: "valued at approximately $5 billion (2025) and projected to reach $8.31 billion by 2033 (Grand View Research; extended to 2035, the same forecast approaches $10 billion per Fact.MR), though 85%",
    new: "valued at $4.85–5.1B (2024/25; sources vary) and projected to reach $8.31 billion by 2033 (Grand View Research); the longer Fact.MR horizon reaches ~$9.6–10B by 2035, though 85%",
  },
  {
    id: "E2 — Market Growth & Structural Tailwinds: GVR 2024 base named within the canonical range",
    finding: "F4 (major)",
    old: "projected to expand from approximately $4.85 billion in 2024 to $8.31 billion by 2033, with a CAGR of 6.4%",
    new: "projected to expand from approximately $4.85 billion in 2024 (the lower bound of the established $4.85–5.1B range) to $8.31 billion by 2033, with a CAGR of 6.4%",
  },
  {
    id: "E3 — Market Growth & Structural Tailwinds: Fact.MR value canonicalized",
    finding: "F9 (minor, B-side)",
    old: "the same growth trajectory reaches roughly $9.6 billion by 2035",
    new: "the same growth trajectory reaches ~$9.6–10B by 2035",
  },
  {
    id: "E2 — Customer & Demand Validation Claims: canonical TAM range",
    finding: "F1/F4 (majors, B-side)",
    old: "*   The global oxygen concentrator market is valued at approximately $4.85 billion to $5.1 billion in 2024/2025.",
    new: "*   The global oxygen concentrator market is valued at $4.85–5.1B (2024/25; sources vary).",
  },
  {
    id: "E3 — Customer & Demand Validation Claims: Fact.MR extension canonicalized",
    finding: "F9-pattern",
    old: "(extending to ~$9.6 billion by 2035 per Fact.MR)",
    new: "(the longer Fact.MR horizon reaches ~$9.6–10B by 2035)",
  },
  {
    id: "E2+E3 — Market Research TAM paragraph: canonical range + labeled forecast family",
    finding: "F5 (major, A-side), F3-pattern",
    old: "this market is valued at approximately $5 billion (2025) with a projected growth trajectory reaching $8.31 billion by 2033 (Grand View Research; approaching $10 billion by 2035 on the extended Fact.MR horizon).",
    new: "this market is valued at $4.85–5.1B (2024/25; sources vary), with a projected growth trajectory reaching $8.31 billion by 2033 (Grand View Research); the longer Fact.MR horizon reaches ~$9.6–10B by 2035.",
  },
  {
    id: "E2 — Market Research SAM segmentation: chosen point named within the range",
    finding: "F5 (major, B-side)",
    old: "Applying the segmentation ratios to the $5.1 billion baseline \\[CHAPTER: Opportunity Validation\\]:",
    new: "Applying the segmentation ratios using the $5.1B upper bound of the established range \\[CHAPTER: Opportunity Validation\\]:",
  },
  {
    id: "E2+E3 — Market Research Claims: canonical range + labeled forecast family",
    finding: "F1-pattern, F3-pattern",
    old: "- The global oxygen concentrator market is valued at approximately $5 billion in 2025, projected to reach $8.31 billion by 2033 (approaching $10 billion by 2035 on the extended Fact.MR horizon).",
    new: "- The global oxygen concentrator market is valued at $4.85–5.1B (2024/25; sources vary), projected to reach $8.31 billion by 2033 (Grand View Research); the longer Fact.MR horizon reaches ~$9.6–10B by 2035.",
  },
  {
    id: "E2 — Six T TAM deep dive: last standalone $5B TAM form replaced with the canonical range",
    finding: "F1-pattern (the $5B+ short form was the only $5B point left; it paired with the $5.1B upper-bound naming)",
    old: 'broad "Wellness Economy" data ($5B+) rather than',
    new: 'broad "Wellness Economy" data (the $4.85–5.1B TAM) rather than',
  },
  {
    id: "E5 — Unit Economics, Inogen benchmark: vague margin reference replaced with the established figure",
    finding: "F6 (major)",
    old: "Reports gross margins consistent with the targets cited in Market Pricing Dynamics",
    new: "Reports ~44.7% gross margin, within the 40–50% target band",
  },
  {
    id: "E4 — LTV & Payback table: $800 cell scenario-labeled",
    finding: "F7 (major)",
    old: "| Optimistic | $3,500 | 50% | $1,750 | $800 | Immediate | 2.2x | ✅ Viable |",
    new: "| Optimistic | $3,500 | 50% | $1,750 | $800 (optimistic scenario) | Immediate | 2.2x | ✅ Viable |",
  },
  {
    id: "E4 — LTV & Payback table: benchmark note appended under the table",
    finding: "F7 (major)",
    old: "| Pessimistic | $1,500 | 40% | $600 | $1,200 | >2 Units | 0.5x | ❌ Failure |",
    new: "| Pessimistic | $1,500 | 40% | $600 | $1,200 | >2 Units | 0.5x | ❌ Failure |\r\n\r\n*Note: benchmark blended CAC ~$1,200 (Inogen 2024); $800 represents the channel-advantage scenario.*",
  },
  {
    id: "E4 — F&O Key Drivers, CAC row: rationale carries the benchmark contrast",
    finding: "F7-pattern (Y3 driver $800)",
    old: "| CAC | N/A | $1,500 | $800 | **Analyst** | 2 | Base | High initial friction; assumes HVAC channel efficiency kicks in Y3. |",
    new: "| CAC | N/A | $1,500 | $800 | **Analyst** | 2 | Base | High initial friction; assumes HVAC channel efficiency kicks in Y3 — benchmark blended CAC ~$1,200 (Inogen 2024); $800 represents the channel-advantage scenario. |",
  },
  {
    id: "E4 — F&O Scenario & Sensitivity: Base line carries the scenario keyword",
    finding: "F7-pattern (the line reads 'Base', not 'base case'/'scenario' — the only $800 line left outside the detector's scenario exclusion)",
    old: "- **Base**: Revenue $2.0M. GM 40%. CAC $800. (Assumes successful pilot, moderate adoption).",
    new: "- **Base scenario**: Revenue $2.0M. GM 40%. CAC $800. (Assumes successful pilot, moderate adoption).",
  },
  {
    id: "E6 — F&O Capacity Math: Y3 800 units framed as interim ramp milestone",
    finding: "F13 (minor)",
    old: "- **Reality Check**: To hit Y3 target (800 units), Daikin needs ~2 dedicated sellers or significant channel activation.",
    new: "- **Reality Check**: To hit Y3 target (800 units), Daikin needs ~2 dedicated sellers or significant channel activation. The Y3 target of 800 units is an interim ramp milestone; the ~2,700 units/year run-rate is the 2030 steady-state requirement.",
  },
];

// String-count audit: [needle, expectedBefore, expectedAfter]
const AUDIT: Array<[string, number, number]> = [
  ["$5 billion", 3, 0],
  ["($5B+)", 1, 0],
  ["$5.1 billion", 2, 0],
  ["$4.85–5.1B", 0, 6],
  ["(2024/25; sources vary)", 0, 4],
  ["~$9.6–10B by 2035", 0, 6],
  ["$10 billion", 4, 0],
  ["$9.6 billion", 2, 0],
  ["approaches $10 billion", 2, 0],
  ["44.7%", 1, 2],
  ["¥100M–¥1B", 0, 1],
  ["at ¥150/$", 0, 1],
  ["channel-advantage scenario", 0, 2],
  ["(optimistic scenario)", 0, 1],
  ["**Base scenario**:", 0, 1],
  ["interim ramp milestone", 0, 1],
  ["approximately 1.5% market share", 0, 1],
  ["\\~1.5% market share", 1, 0],
];

function count(haystack: string, needle: string): number {
  let n = 0,
    i = -1;
  while ((i = haystack.indexOf(needle, i + 1)) !== -1) n++;
  return n;
}

const before = readFileSync(SRC, "utf8");
let doc = before;
let failed = 0;

console.log("=== Per-edit exact-match assertions ===");
for (const e of EDITS) {
  const expect = e.expect ?? 1;
  const found = count(doc, e.old);
  if (found !== expect) {
    console.log(`FAIL  [${e.id}] expected ${expect} occurrence(s), found ${found}`);
    failed++;
    continue;
  }
  doc = doc.split(e.old).join(e.new);
  console.log(`OK    [${e.id}] (${e.finding})`);
}
if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed — v13 NOT written.`);
  process.exit(1);
}

console.log("\n=== String-count audit (before -> after) ===");
let auditFailed = 0;
for (const [needle, expBefore, expAfter] of AUDIT) {
  const b = count(before, needle);
  const a = count(doc, needle);
  const ok = b === expBefore && a === expAfter;
  if (!ok) auditFailed++;
  console.log(
    `${ok ? "OK  " : "FAIL"}  "${needle}": ${b} -> ${a} (expected ${expBefore} -> ${expAfter})`
  );
}
if (auditFailed > 0) {
  console.error(`\n${auditFailed} audit count(s) off — v13 NOT written.`);
  process.exit(1);
}

writeFileSync(DST, doc, "utf8");
console.log(`\nv13 written: ${DST}`);

// Changed-line diff (v12 line -> v13 line), for the E3b-EDITS record.
const a = before.split("\r\n");
const b = doc.split("\r\n");
console.log("\n=== Changed-line diff (1-based v12 line numbers) ===");
let ai = 0,
  bi = 0;
while (ai < a.length || bi < b.length) {
  if (ai < a.length && bi < b.length && a[ai] === b[bi]) {
    ai++;
    bi++;
    continue;
  }
  // Inserted line(s) in v13 (the table note): old side advances only when it matches later
  if (ai < a.length && bi < b.length && a[ai] !== b[bi] && a[ai] === b[bi + 2]) {
    // two inserted lines (blank + note)
    console.log(`@@ +${ai + 1} (insert) @@`);
    console.log(`+${b[bi]}`);
    console.log(`+${b[bi + 1]}`);
    bi += 2;
    continue;
  }
  console.log(`@@ -${ai + 1} @@`);
  console.log(`-${a[ai]}`);
  console.log(`+${b[bi]}`);
  ai++;
  bi++;
}
