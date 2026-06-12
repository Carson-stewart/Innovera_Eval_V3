/**
 * Conflict Screener calibration — the acceptance bar from the Daikin v11 audit
 * (snippets-audit-FINAL.md, 2026-06-12). TOKEN-FREE: profileMemo never touches
 * an LLM or the database (asserted below via the import graph).
 *
 * Tolerances: ±10% where extraction grammar may differ from the audit's literal
 * string counting; exact where counting is unambiguous.
 *
 * REPORTED DISCREPANCIES (pinned, NOT tolerance-loosened — per the build spec,
 * out-of-tolerance results are reported with examples):
 *
 *  D1. $1,200 — audit ≈12, screener 14. Reconciliation: 13 literal "$1,200"
 *      tokens (audit likely excluded the Herman Miller chair benchmark at
 *      v11 L2077, a same-value figure that is NOT the CAC anchor) plus one
 *      normalized variant "$1.2k" (v11 L2525, a unit-cost figure). Value
 *      normalization cannot distinguish concept identity — that remains the
 *      stage-2 adjudicator's job. Both extra mentions are identified below.
 *
 *  D2. $460M — audit ≈8, screener 11. Reconciliation: the audit counted the
 *      spelled-out "$460 million" (exactly 8); the extractor also catches the
 *      "$460M" short form (exactly 3). 8 + 3 = 11. Audit replication asserted
 *      on the literal forms.
 *
 *  D3. M3 WITH-FIGURE share — registered baseline "≈100%" is corrected to the
 *      measured 20/111 (18%). The audit's "0%-substitution" claim concerned
 *      figure references (no tag ever SUBSTITUTES for a figure — when a figure
 *      is referenced cross-chapter it is always restated). Most v11 tags are
 *      qualitative cross-references ("the risks flagged in [CHAPTER: Legal
 *      and IP]") with no figure in the sentence at all, so the WITH-FIGURE
 *      share over ALL tags is structurally far below 100%. The F4 prediction
 *      direction is unaffected: after the prompt fixes, WITH-FIGURE share
 *      should DROP (tags replacing figures), measured against this 20/111
 *      baseline.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { profileMemo, type MemoProfile, type BucketsConfig } from "../measure";

const V11 = "C:/Users/cstew/Downloads/2026-02-11_Daikin_Oxi_Corporate_v11.md";
const have = fs.existsSync(V11);

const config: BucketsConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "daikin-buckets.json"), "utf8")
);

let p: MemoProfile;
let raw: string;
beforeAll(async () => {
  if (!have) return;
  p = await profileMemo(V11, config);
  raw = fs.readFileSync(V11, "utf8");
});

const fig = (unitClass: string, lo: number, hi: number = lo) =>
  p.figures.find((f) => f.unitClass === unitClass && f.lo === lo && f.hi === hi);

describe("screener boundary — token-free, DB-free", () => {
  it("never imports prisma or the OpenRouter client", () => {
    const importsForbidden = /import[^;]*from\s+["'][^"']*(openrouter|prisma)/i;
    for (const file of ["measure.ts", "report.ts", "screen.ts"]) {
      const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      expect(src, file).not.toMatch(importsForbidden);
    }
  });
});

describe.skipIf(!have)("calibration 1 — M1 anchor-figure mentions vs audit", () => {
  it("¥1bn family: ≈26 mentions (±10%) across ≥10 chapters", () => {
    const f = fig("money:JPY", 1e9)!;
    expect(f).toBeDefined();
    expect(f.occurrences).toBeGreaterThanOrEqual(24);
    expect(f.occurrences).toBeLessThanOrEqual(29);
    expect(f.chapterCount).toBeGreaterThanOrEqual(10);
  });

  it("$2,500: ≈20 mentions (±10%)", () => {
    const f = fig("money:USD", 2500)!;
    expect(f).toBeDefined();
    expect(f.occurrences).toBeGreaterThanOrEqual(18);
    expect(f.occurrences).toBeLessThanOrEqual(22);
  });

  it("$1,200: audit ≈12 — REPORTED DISCREPANCY D1, pinned at 14 (13 literal + 1 '$1.2k')", () => {
    const f = fig("money:USD", 1200)!;
    expect(f).toBeDefined();
    expect(f.occurrences).toBe(14); // outside 12±10% — see header D1, not loosened
    // reconciliation evidence: literal-form count and the normalized variant
    expect((raw.match(/\$1,?200\b/g) ?? []).length).toBe(13);
    expect((raw.match(/\$1\.2k/gi) ?? []).length).toBe(1);
  });

  it("$460M: audit ≈8 — REPORTED DISCREPANCY D2, pinned at 11 (8 spelled + 3 short form)", () => {
    const f = fig("money:USD", 460e6)!;
    expect(f).toBeDefined();
    expect(f.occurrences).toBe(11); // outside 8±10% — see header D2, not loosened
    // audit replication on the literal forms:
    expect((raw.match(/\$460\s?million/gi) ?? []).length).toBe(8);
    expect((raw.match(/\$460M\b/g) ?? []).length).toBe(3);
  });
});

describe.skipIf(!have)("calibration 2 — M2 audited candidate sets", () => {
  const pairBetween = (
    unitClass: string,
    valA: [number, number],
    chA: string,
    valB: [number, number],
    chB: string
  ) =>
    p.candidates.find(
      (c) =>
        c.unitClass === unitClass &&
        c.a.lo === valA[0] && c.a.hi === valA[1] && c.a.chapter === chA &&
        c.b.lo === valB[0] && c.b.hi === valB[1] && c.b.chapter === chB
    );

  it("units-to-target set: 2,500 (Revenue Model) vs ~2,700 (Finance and Operations) vs 3,000–4,000 (Unit Economics)", () => {
    expect(
      pairBetween("count:unit", [2500, 2500], "Revenue Model", [2700, 2700], "Finance and Operations")
    ).toBeDefined();
    expect(
      pairBetween("count:unit", [2500, 2500], "Revenue Model", [3000, 4000], "Unit Economics")
    ).toBeDefined();
    expect(
      pairBetween("count:unit", [2700, 2700], "Finance and Operations", [3000, 4000], "Unit Economics")
    ).toBeDefined();
  });

  it("CAGR pair: 6.4% vs 7.6% (Market Research vs Revenue Model)", () => {
    const pair = p.candidates.find(
      (c) =>
        c.unitClass === "percent" &&
        c.a.lo === 6.4 && c.b.lo === 7.6 &&
        c.a.chapter === "Market Research" && c.b.chapter === "Revenue Model"
    );
    expect(pair).toBeDefined();
  });

  it("watch item: the open-floor 'fleet of 2,500+ units' never pairs with 2,700 (or any value ≥ 2,500)", () => {
    const offenders = p.candidates.filter(
      (c) =>
        c.unitClass === "count:unit" &&
        ((c.a.openEnded && c.a.lo === 2500 && c.b.lo >= 2500) ||
          (c.b.openEnded && c.b.lo === 2500 && c.a.lo >= 2500))
    );
    expect(offenders).toHaveLength(0);
  });

  it("candidates are labeled candidates, not confirmed conflicts (instanceCount present for adjudication triage)", () => {
    for (const c of p.candidates.slice(0, 5)) {
      expect(c.instanceCount).toBeGreaterThanOrEqual(1);
      expect(c.a.quote).toBeTruthy();
      expect(c.b.quote).toBeTruthy();
    }
  });
});

describe.skipIf(!have)("calibration 3 — M3 tag-substitution baseline", () => {
  it("exactly 111 [CHAPTER: …] tags", () => {
    expect(p.tags.total).toBe(111);
  });

  it("WITH-FIGURE: registered '≈100%' baseline — REPORTED DISCREPANCY D3, pinned at 20/111", () => {
    expect(p.tags.withFigure).toBe(20); // see header D3: baseline correction, not loosened
    expect(p.tags.withoutFigure).toBe(91);
  });
});

describe.skipIf(!have)("calibration 4 — per-bucket anchor rates (audit buckets)", () => {
  it("RULES-ON ≈ 4.4/chapter and RULES-OFF ≈ 8.8/chapter (±10%)", () => {
    const on = p.buckets!.find((b) => b.name === "RULES-ON")!;
    const off = p.buckets!.find((b) => b.name === "RULES-OFF")!;
    expect(on.chapterCount).toBe(8);
    expect(off.chapterCount).toBe(4);
    expect(on.familyPerChapter!).toBeGreaterThanOrEqual(3.96);
    expect(on.familyPerChapter!).toBeLessThanOrEqual(4.84);
    expect(off.familyPerChapter!).toBeGreaterThanOrEqual(7.92);
    expect(off.familyPerChapter!).toBeLessThanOrEqual(9.68);
  });

  it("summaries-exempt bucket reproduces the audit's 12 mentions exactly", () => {
    const s = p.buckets!.find((b) => b.name === "SUMMARIES-EXEMPT")!;
    expect(s.chapterCount).toBe(1);
    expect(s.familyMentions).toBe(12);
  });
});
