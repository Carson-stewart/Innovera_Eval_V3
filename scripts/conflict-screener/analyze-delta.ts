/**
 * One-off analysis of the v11→v12 delta JSON for V12-SCREEN-VALIDATION.md:
 * classifies introduced candidate pairs as EDIT-SHADOW (mechanical re-keying of
 * a resolved pair after a value edit) vs genuinely new. Token-free, DB-free.
 */
import * as fs from "node:fs";

const j = JSON.parse(
  fs.readFileSync("scripts/conflict-screener/output/v11-vs-v12/screen-report.json", "utf8")
);
const d = j.delta;

console.log("=== figure deltas ===");
for (const f of d.figureDeltas) {
  console.log(`${f.display.padEnd(28)} ${f.key.padEnd(40)} ${f.before} -> ${f.after} (${f.delta > 0 ? "+" : ""}${f.delta})`);
}

// Edit-moved figure values per E3 (normalized): the four edits touched these.
const EDIT_VALUES = new Set([
  "count:unit|2500|2500", "count:unit|2700|2700", "count:unit|3000|4000", "count:unit|3000|3000",
  "percent|6.4|6.4", "percent|7.6|7.6",
  "money:USD|8310000000|8310000000", "money:USD|10000000000|10000000000", "money:USD|9600000000|9600000000",
  "money:USD|8300000000|8300000000", "money:USD|8300000000|9600000000", "money:USD|8310000000|9600000000",
  "percent|45|45", "percent|50|50", "money:USD|1250|1250", "money:USD|1125|1125",
]);
const sideKey = (s: any, unitClass: string) =>
  `${unitClass}|${s.lo}|${s.openEnded ? "inf" : s.hi}`;
const touchesEdit = (c: any) =>
  EDIT_VALUES.has(sideKey(c.a, c.unitClass)) || EDIT_VALUES.has(sideKey(c.b, c.unitClass));

const introducedNew = d.candidatesIntroduced.filter((c: any) => !touchesEdit(c));
const introducedShadow = d.candidatesIntroduced.filter((c: any) => touchesEdit(c));
const resolvedByEdit = d.candidatesResolved.filter((c: any) => touchesEdit(c));
const resolvedOther = d.candidatesResolved.filter((c: any) => !touchesEdit(c));

console.log(`\n=== introduced: ${d.candidatesIntroduced.length} total ===`);
console.log(`edit-shadow (>=1 side is an edit-moved value): ${introducedShadow.length}`);
console.log(`NOT touching any edit-moved value: ${introducedNew.length}`);
for (const c of introducedNew.slice(0, 20)) {
  console.log(`  NEW? ${c.unitClass}: ${c.a.raw} [${c.a.chapter}] vs ${c.b.raw} [${c.b.chapter}]`);
}

console.log(`\n=== resolved: ${d.candidatesResolved.length} total ===`);
console.log(`touching an edit-moved value: ${resolvedByEdit.length}; other: ${resolvedOther.length}`);
for (const c of resolvedOther.slice(0, 20)) {
  console.log(`  OTHER-RESOLVED ${c.unitClass}: ${c.a.raw} [${c.a.chapter}] vs ${c.b.raw} [${c.b.chapter}]`);
}

// The four audited conflicts — explicit absence checks in v12 (memoB):
const B = j.memoB;
const findPair = (unitClass: string, loA: number, hiA: number, loB: number, hiB: number) =>
  B.candidates.find(
    (c: any) => c.unitClass === unitClass &&
      c.a.lo === loA && (c.a.hi ?? Infinity) === hiA && c.b.lo === loB && (c.b.hi ?? Infinity) === hiB
  );
console.log("\n=== v12 absence checks (the four audited conflicts) ===");
console.log("units 2500 vs 2700 pair:", findPair("count:unit", 2500, 2500, 2700, 2700) ? "PRESENT (bad)" : "absent");
console.log("units 2500 vs 3000-4000 pair:", findPair("count:unit", 2500, 2500, 3000, 4000) ? "PRESENT (bad)" : "absent");
console.log("units 2700 vs 3000-4000 pair:", findPair("count:unit", 2700, 2700, 3000, 4000) ? "PRESENT (bad)" : "absent");
const cagr = B.candidates.find((c: any) => c.unitClass === "percent" && c.a.lo === 6.4 && c.b.lo === 7.6);
console.log("CAGR 6.4 vs 7.6 pair:", cagr ? "PRESENT (bad)" : "absent");
console.log("7.6% mentions in v12:", B.figures.find((f: any) => f.key === "percent|7.6|7.6")?.occurrences ?? 0);

// Watch item in v12: fleet 2,500+ must not pair with any >=2500 count.
const fleet = B.candidates.filter(
  (c: any) => c.unitClass === "count:unit" &&
    ((c.a.openEnded && c.a.lo === 2500 && c.b.lo >= 2500) || (c.b.openEnded && c.b.lo === 2500 && c.a.lo >= 2500))
);
console.log("watch item — 'fleet of 2,500+' pairs vs >=2500 in v12:", fleet.length);
const fleetFig = B.figures.find((f: any) => f.key === "count:unit|2500|inf");
console.log("fleet figure present in v12:", fleetFig ? `yes (${fleetFig.occurrences}x in ${Object.keys(fleetFig.perChapter).join(", ")})` : "NO");

// remaining count:unit candidates in v12 among the units-to-target chapters
const unitPairsB = B.candidates.filter((c: any) => c.unitClass === "count:unit");
console.log(`count:unit candidates v11=${j.memoA.candidates.filter((c: any) => c.unitClass === "count:unit").length} v12=${unitPairsB.length}`);

console.log("\n=== tags & buckets movement ===");
console.log("tags:", JSON.stringify(d.tagMovement));
for (const m of d.bucketMovement ?? []) {
  console.log(`${m.name}: family/ch ${m.beforeFamilyPerChapter} -> ${m.afterFamilyPerChapter}; all-figure/ch ${m.beforeFigurePerChapter.toFixed(2)} -> ${m.afterFigurePerChapter.toFixed(2)}`);
}
