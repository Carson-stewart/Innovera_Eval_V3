/**
 * lib/framing/quantities.ts — Stage 1 of the Single-Source-of-Truth check (D18)
 * and the Anchor Inventory (both deterministic; NO LLM anywhere in this module).
 *
 * Extracts quantities (money, percentages, counts, durations, engineering units)
 * with a ±1-statement context window, normalizes units and magnitudes, and emits:
 *  - candidate conflict pairs: two quantities of the same unit class whose values
 *    differ and whose contexts share signal — adjudicated by stage 2 (LLM) at
 *    run time;
 *  - the anchor inventory: distinct quantities with in-framing repetition counts.
 *
 * Explicit NON-candidates (encoded here, unit-tested):
 *  - a single stated range ("$150–200M" is ONE value with lo/hi);
 *  - scenario-labeled variants (base case / upside / downside…);
 *  - time-distinguished values (distinct year tags: "2025: $5B; 2035: $10B").
 *
 * Counting semantics: "stated N times" counts distinct statements (lines), not raw
 * token occurrences — a sentence restating the same anchor twice is one statement.
 */

export interface Quantity {
  /** verbatim matched text */
  raw: string;
  /** e.g. "money:USD", "money:JPY", "percent", "duration:year", "count:units", "unit:MW" */
  unitClass: string;
  /** normalized numeric range; lo === hi for single values */
  lo: number;
  hi: number;
  /** 1-based line number of the statement */
  line: number;
  /** the full statement (line) text, trimmed */
  statement: string;
  /** lowercased ±1-line context window */
  context: string;
  scenarioLabeled: boolean;
  /** 4-digit years appearing in the statement (time-distinguishing tags) */
  years: string[];
}

export interface CandidatePair {
  a: Quantity;
  b: Quantity;
  /** why stage 1 paired them (shared nouns / target-language adjacency) */
  sharedSignals: string[];
}

export interface AnchorEntry {
  value: string;
  unit: string;
  label: string;
  count: number;
  locations: number[];
}

const CURRENCY_CLASS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY" };

const MAGNITUDE: Record<string, number> = {
  trillion: 1e12, t: 1e12,
  billion: 1e9, bn: 1e9, b: 1e9,
  million: 1e6, mm: 1e6, m: 1e6,
  thousand: 1e3, k: 1e3,
};

const SCENARIO_RE = /\b(base[ -]?case|upside|downside|optimistic|pessimistic|worst[ -]?case|best[ -]?case|bull|bear|scenario)\b/i;
const TARGET_LANG_RE = /\b(target|goal|expect|expectation|potential|forecast|projection|projected|threshold|aim|require[sd]?|objective)\b/i;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "must", "will", "should",
  "have", "has", "are", "was", "were", "been", "being", "into", "over", "under",
  "year", "years", "annually", "annual", "blended", "across", "all", "channels",
  "least", "than", "more", "most", "within", "about", "approximately", "between",
]);

const num = (s: string) => parseFloat(s.replace(/,/g, ""));

/** Split into statements (lines), keeping 1-based numbering. */
function statements(text: string): string[] {
  return text.split(/\r?\n/);
}

function contextWindow(lines: string[], idx: number): string {
  return [lines[idx - 1] ?? "", lines[idx], lines[idx + 1] ?? ""].join(" ").toLowerCase();
}

function yearsIn(statement: string): string[] {
  return Array.from(new Set(statement.match(/\b(19|20)\d{2}\b/g) ?? []));
}

/** Extract all quantities from a framing text. Pure and deterministic. */
export function extractQuantities(text: string): Quantity[] {
  const lines = statements(text);
  const out: Quantity[] = [];

  const push = (raw: string, unitClass: string, lo: number, hi: number, idx: number) => {
    const statement = lines[idx].trim();
    out.push({
      raw,
      unitClass,
      lo: Math.min(lo, hi),
      hi: Math.max(lo, hi),
      line: idx + 1,
      statement,
      context: contextWindow(lines, idx),
      scenarioLabeled: SCENARIO_RE.test(statement),
      years: yearsIn(statement),
    });
  };

  // Money: $150-200M, ¥1 billion, $4.85 billion, $2,500, $500M/year
  const MONEY_RE = /([$€£¥])\s?(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|thousand|bn|mm|[tbmk])?(?:\s?[–—-]\s?\$?(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|thousand|bn|mm|[tbmk])?)?\b/gi;
  // Percent (with optional range): 6.4%, 40–50%
  const PCT_RE = /(\d+(?:\.\d+)?)(?:\s?[–—-]\s?(\d+(?:\.\d+)?))?\s?%/g;
  // Duration: 3 years, 18 months
  const DUR_RE = /\b(\d+(?:\.\d+)?)\s?(years?|months?|weeks?|days?)\b/gi;
  // Counts with unit nouns: 2,700 units, 400 FTEs
  const COUNT_RE = /\b(\d[\d,]*(?:\.\d+)?)\s?(units?|users?|customers?|FTEs?|stores?|sites?|employees?|headcount)\b/gi;
  // Engineering units: 5 MW, 200 MWh
  const ENG_RE = /\b(\d[\d,]*(?:\.\d+)?)\s?(MWh|GWh|kWh|MW|GW|kW)\b/g;

  lines.forEach((lineText, idx) => {
    let m: RegExpExecArray | null;

    MONEY_RE.lastIndex = 0;
    while ((m = MONEY_RE.exec(lineText)) !== null) {
      const [raw, cur, v1, mag1, v2, mag2] = m;
      // Trailing magnitude can be attached to the upper bound only ("$150-200M"):
      // a magnitude on either side applies to both when the other has none.
      const mag = (s?: string) => (s ? MAGNITUDE[s.toLowerCase()] ?? 1 : undefined);
      const m1 = mag(mag1);
      const m2 = mag(mag2);
      const sharedMag = m1 ?? m2 ?? 1;
      const lo = num(v1) * (m1 ?? sharedMag);
      const hi = v2 !== undefined ? num(v2) * (m2 ?? sharedMag) : lo;
      push(raw.trim(), `money:${CURRENCY_CLASS[cur] ?? cur}`, lo, hi, idx);
    }

    PCT_RE.lastIndex = 0;
    while ((m = PCT_RE.exec(lineText)) !== null) {
      const [raw, v1, v2] = m;
      push(raw.trim(), "percent", num(v1), v2 !== undefined ? num(v2) : num(v1), idx);
    }

    DUR_RE.lastIndex = 0;
    while ((m = DUR_RE.exec(lineText)) !== null) {
      const [raw, v, unit] = m;
      const u = unit.toLowerCase().replace(/s$/, "");
      push(raw.trim(), `duration:${u}`, num(v), num(v), idx);
    }

    COUNT_RE.lastIndex = 0;
    while ((m = COUNT_RE.exec(lineText)) !== null) {
      const [raw, v, noun] = m;
      push(raw.trim(), `count:${noun.toLowerCase().replace(/s$/, "")}`, num(v), num(v), idx);
    }

    ENG_RE.lastIndex = 0;
    while ((m = ENG_RE.exec(lineText)) !== null) {
      const [raw, v, unit] = m;
      push(raw.trim(), `unit:${unit}`, num(v), num(v), idx);
    }
  });

  return out;
}

function keyNouns(context: string): Set<string> {
  return new Set(
    (context.match(/[a-z]{4,}/g) ?? []).filter((w) => !STOPWORDS.has(w))
  );
}

function rangesDisjoint(a: Quantity, b: Quantity): boolean {
  return a.hi < b.lo || b.hi < a.lo;
}

function timeDistinguished(a: Quantity, b: Quantity): boolean {
  if (a.years.length === 0 || b.years.length === 0) return false;
  return !a.years.some((y) => b.years.includes(y)); // disjoint year tags
}

/**
 * Stage 1 pairing: same unit class, disjoint values, shared context signal,
 * not scenario-labeled, not time-distinguished. The same statement never pairs
 * with itself.
 */
export function extractCandidatePairs(text: string): CandidatePair[] {
  const qs = extractQuantities(text);
  const pairs: CandidatePair[] = [];

  for (let i = 0; i < qs.length; i++) {
    for (let j = i + 1; j < qs.length; j++) {
      const a = qs[i];
      const b = qs[j];
      if (a.unitClass !== b.unitClass) continue;
      if (a.line === b.line) continue; // same statement — one assertion context
      if (!rangesDisjoint(a, b)) continue; // equal/overlapping = one value (range is ONE value)
      if (a.scenarioLabeled || b.scenarioLabeled) continue; // scenario variants
      if (timeDistinguished(a, b)) continue; // different year tags

      const sharedSignals: string[] = [];
      const nounsA = keyNouns(a.context);
      const shared = Array.from(keyNouns(b.context)).filter((w) => nounsA.has(w));
      if (shared.length > 0) sharedSignals.push(...shared.slice(0, 5).map((w) => `noun:${w}`));
      if (TARGET_LANG_RE.test(a.context) && TARGET_LANG_RE.test(b.context)) {
        sharedSignals.push("target-language:both");
      }
      if (sharedSignals.length === 0) continue;

      pairs.push({ a, b, sharedSignals });
    }
  }

  return pairs;
}

/** Label heuristic: most frequent meaningful token within the anchor's statements. */
function labelFor(group: Quantity[]): string {
  const counts = new Map<string, number>();
  for (const q of group) {
    for (const w of Array.from(keyNouns(q.statement.toLowerCase()))) {
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const top = Array.from(counts.entries()).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([w]) => w);
  return top.join(" ") || "(unlabeled)";
}

/**
 * Anchor inventory: distinct quantities with per-statement repetition counts.
 * Machine-readable; sorted by count desc then magnitude desc; capped at 20 entries.
 */
export function buildAnchorInventory(text: string): AnchorEntry[] {
  const qs = extractQuantities(text);
  const groups = new Map<string, Quantity[]>();
  for (const q of qs) {
    const key = `${q.unitClass}|${q.lo}|${q.hi}`;
    const g = groups.get(key) ?? [];
    g.push(q);
    groups.set(key, g);
  }

  const entries: AnchorEntry[] = [];
  for (const group of Array.from(groups.values()) as Quantity[][]) {
    const lines = Array.from(new Set(group.map((q) => q.line))).sort((x, y) => x - y);
    entries.push({
      value: group[0].raw,
      unit: group[0].unitClass,
      label: labelFor(group),
      count: lines.length, // distinct statements, not raw tokens
      locations: lines,
    });
  }

  return entries
    .sort((x, y) => y.count - x.count)
    .slice(0, 20);
}
