/**
 * E3b — analysis of the v12→v13 delta JSON: classifies introduced candidate
 * pairs as EDIT-SHADOW (mechanical re-keying after a value edit) vs genuinely
 * new, and runs explicit absence checks for the seven Run #66 reconciliation
 * targets (E1–E7). Token-free, DB-free.
 */
import * as fs from "node:fs";

const j = JSON.parse(
  fs.readFileSync("scripts/conflict-screener/output/v12-vs-v13/screen-report.json", "utf8")
);
const d = j.delta;
const A = j.memoA; // v12
const B = j.memoB; // v13

console.log("=== figure deltas (v12 -> v13) ===");
for (const f of d.figureDeltas) {
  console.log(
    `${f.display.padEnd(30)} ${f.key.padEnd(44)} ${f.before} -> ${f.after} (${f.delta > 0 ? "+" : ""}${f.delta})`
  );
}

// Values moved/added/removed by the E1–E7 edits (normalized keys).
const EDIT_VALUES = new Set([
  // E2 — TAM canonicalization
  "money:USD|5000000000|5000000000",   // $5 billion point — removed
  "money:USD|5100000000|5100000000",   // $5.1 billion point — 2 sites -> 1 (upper-bound naming)
  "money:USD|4850000000|5100000000",   // canonical range — 1 -> 5
  "money:USD|4850000000|4850000000",   // $4.85B GVR base (context edited at L369)
  // E3 — forecast family canonicalization
  "money:USD|10000000000|10000000000", // $10 billion point — removed
  "money:USD|9600000000|9600000000",   // $9.6 billion point — removed
  "money:USD|9600000000|10000000000",  // ~$9.6–10B range — 0 -> 6
  "money:USD|8310000000|8310000000",   // $8.31B (context edited on several lines)
  // E1 — range reconciliation + conversion
  "money:JPY|1000000000|1000000000",   // ¥1B (one added mention in the new sentence)
  "money:JPY|100000000|1000000000",    // ¥100M–¥1B range — new (if parsed as range)
  "money:JPY|100000000|100000000",     // ¥100M point — the range form does NOT parse
                                       // (MONEY_RE range arm only admits "$" as the
                                       // second symbol), so E1's sentence lands as
                                       // two points; edit-introduced either way
  "money:JPY|150|150",                 // ¥150/$ — new
  "money:USD|6700000|6700000",         // $6.7M (context edited at L29)
  // E4 / E5 / E6
  "money:USD|1200|1200",               // benchmark notes add mentions
  "money:USD|800|800",                 // scenario labels added around it
  "percent|44.7|44.7",                 // E5 adds one mention
  "percent|40|50",                     // "40–50% target band" added at E5 site
  "count:unit|800|800",                // E6 context edited
  "count:unit|2700|2700",              // E6 adds one mention
  "percent|1.5|1.5",                   // E7 qualifier site
]);
const sideKey = (s: any, unitClass: string) =>
  `${unitClass}|${s.lo}|${s.openEnded ? "inf" : s.hi}`;
const touchesEdit = (c: any) =>
  EDIT_VALUES.has(sideKey(c.a, c.unitClass)) || EDIT_VALUES.has(sideKey(c.b, c.unitClass));

const introducedShadow = d.candidatesIntroduced.filter((c: any) => touchesEdit(c));
const introducedNew = d.candidatesIntroduced.filter((c: any) => !touchesEdit(c));
const resolvedByEdit = d.candidatesResolved.filter((c: any) => touchesEdit(c));
const resolvedOther = d.candidatesResolved.filter((c: any) => !touchesEdit(c));

console.log(`\n=== introduced: ${d.candidatesIntroduced.length} total ===`);
console.log(`edit-shadow (>=1 side is an edit-moved value): ${introducedShadow.length}`);
console.log(`NOT touching any edit-moved value: ${introducedNew.length}`);
for (const c of introducedNew.slice(0, 30)) {
  console.log(
    `  NEW? ${c.unitClass}: ${c.a.raw} [${c.a.chapter} L${c.a.line}] vs ${c.b.raw} [${c.b.chapter} L${c.b.line}]`
  );
}

console.log(`\n=== resolved: ${d.candidatesResolved.length} total ===`);
console.log(`touching an edit-moved value: ${resolvedByEdit.length}; other: ${resolvedOther.length}`);
for (const c of resolvedOther.slice(0, 30)) {
  console.log(
    `  OTHER-RESOLVED ${c.unitClass}: ${c.a.raw} [${c.a.chapter} L${c.a.line}] vs ${c.b.raw} [${c.b.chapter} L${c.b.line}]`
  );
}

// ── The seven Run #66 targets — explicit v13 absence checks ──────────────────
const fig = (memo: any, key: string) => memo.figures.find((f: any) => f.key === key);
const occ = (memo: any, key: string) => fig(memo, key)?.occurrences ?? 0;
const pairBetween = (memo: any, keyX: string, keyY: string) =>
  memo.candidates.filter((c: any) => {
    const ka = sideKey(c.a, c.unitClass);
    const kb = sideKey(c.b, c.unitClass);
    return (ka === keyX && kb === keyY) || (ka === keyY && kb === keyX);
  });

console.log("\n=== v13 absence checks (the seven Run #66 targets) ===");

// E2 / F1+F4+F5 — TAM alternation
console.log(`$5B point mentions:    v12=${occ(A, "money:USD|5000000000|5000000000")} v13=${occ(B, "money:USD|5000000000|5000000000")} (expect v13 0)`);
console.log(`$5.1B point mentions:  v12=${occ(A, "money:USD|5100000000|5100000000")} v13=${occ(B, "money:USD|5100000000|5100000000")} (expect v13 1 — 'upper bound' naming)`);
console.log(`canonical range:       v12=${occ(A, "money:USD|4850000000|5100000000")} v13=${occ(B, "money:USD|4850000000|5100000000")} (expect 1 -> 5)`);
console.log(`$5B-vs-$5.1B pairs in v13:   ${pairBetween(B, "money:USD|5000000000|5000000000", "money:USD|5100000000|5100000000").length} (expect 0)`);
console.log(`$5B-vs-range pairs in v13:   ${pairBetween(B, "money:USD|5000000000|5000000000", "money:USD|4850000000|5100000000").length} (expect 0)`);
console.log(`$4.85B-vs-$5.1B pairs: v12=${pairBetween(A, "money:USD|4850000000|4850000000", "money:USD|5100000000|5100000000").length} v13=${pairBetween(B, "money:USD|4850000000|4850000000", "money:USD|5100000000|5100000000").length} (bounds of one named range in v13 prose)`);

// E3 / F3+F9 — forecast family
console.log(`$10B point mentions:   v12=${occ(A, "money:USD|10000000000|10000000000")} v13=${occ(B, "money:USD|10000000000|10000000000")} (expect v13 0)`);
console.log(`$9.6B point mentions:  v12=${occ(A, "money:USD|9600000000|9600000000")} v13=${occ(B, "money:USD|9600000000|9600000000")} (expect v13 0)`);
console.log(`~$9.6–10B range:       v12=${occ(A, "money:USD|9600000000|10000000000")} v13=${occ(B, "money:USD|9600000000|10000000000")} (expect 0 -> 6)`);
console.log(`$10B-vs-$9.6B pairs in v13:  ${pairBetween(B, "money:USD|10000000000|10000000000", "money:USD|9600000000|9600000000").length} (expect 0)`);

// E1 / F2 — ¥ range vs point
console.log(`¥100M–¥1B range:       v12=${occ(A, "money:JPY|100000000|1000000000")} v13=${occ(B, "money:JPY|100000000|1000000000")} (expect 0 -> 1)`);
const jpyPairs = (memo: any) =>
  memo.candidates.filter((c: any) => c.unitClass === "money:JPY").length;
console.log(`money:JPY candidate pairs:   v12=${jpyPairs(A)} v13=${jpyPairs(B)} (expect 0 in both — point is inside the range)`);

// E4 / F7 — CAC $800 vs $1,200
const cacPairs = (memo: any) => pairBetween(memo, "money:USD|800|800", "money:USD|1200|1200");
console.log(`$800-vs-$1,200 pairs:  v12=${cacPairs(A).length} v13=${cacPairs(B).length}`);
for (const c of cacPairs(B)) {
  console.log(`  v13 残: ${c.a.raw} [${c.a.chapter} L${c.a.line}] vs ${c.b.raw} [${c.b.chapter} L${c.b.line}]`);
}

// E5 / F6 — Inogen margin
console.log(`44.7% mentions:        v12=${occ(A, "percent|44.7|44.7")} v13=${occ(B, "percent|44.7|44.7")} (expect 1 -> 2; same value = repetition, never a conflict pair)`);

// E6 / F13 — 800 vs 2,700 units
const unitPairs = (memo: any) => pairBetween(memo, "count:unit|800|800", "count:unit|2700|2700");
console.log(`800-vs-2,700 unit pairs: v12=${unitPairs(A).length} v13=${unitPairs(B).length}`);
for (const c of unitPairs(B)) {
  console.log(`  v13 残: ${c.a.raw} [${c.a.chapter} L${c.a.line}] vs ${c.b.raw} [${c.b.chapter} L${c.b.line}]`);
}

// E7 / F8 — $460M (same value; phrasing-only minor — can never be a value pair)
console.log(`$460M family mentions: v12=${occ(A, "money:USD|460000000|460000000")} v13=${occ(B, "money:USD|460000000|460000000")} (expect unchanged)`);

// Watch item from E3: fleet 2,500+ must still pair with nothing >= 2,500.
const fleet = B.candidates.filter(
  (c: any) =>
    c.unitClass === "count:unit" &&
    ((c.a.openEnded && c.a.lo === 2500 && c.b.lo >= 2500) ||
      (c.b.openEnded && c.b.lo === 2500 && c.a.lo >= 2500))
);
console.log(`watch item — 'fleet of 2,500+' pairs vs >=2500 in v13: ${fleet.length} (expect 0)`);

console.log("\n=== tags & buckets movement ===");
console.log("tags:", JSON.stringify(d.tagMovement));
for (const m of d.bucketMovement ?? []) {
  console.log(
    `${m.name}: family/ch ${m.beforeFamilyPerChapter} -> ${m.afterFamilyPerChapter}; all-figure/ch ${m.beforeFigurePerChapter.toFixed(2)} -> ${m.afterFigurePerChapter.toFixed(2)}`
  );
}
