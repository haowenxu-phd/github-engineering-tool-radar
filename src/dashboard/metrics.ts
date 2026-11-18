import type { Taxonomy, Tool } from "../types";

export const MONTHS_BACK = 12;
export const MAX_SERIES = 7; // + "Other" = 8 categorical slots (dataviz rule: never a 9th hue)

/** The last N calendar months, oldest first, as "YYYY-MM". The last one is the current (partial) month. */
export function monthKeys(n = MONTHS_BACK, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export function monthLabel(key: string, withYear = false): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-AU", { month: "short", ...(withYear ? { year: "2-digit" } : {}), timeZone: "UTC" });
}

export const primaryDomain = (t: Tool) => t.domains[0] ?? "other";

export interface Series {
  key: string;
  label: string;
  values: number[];
  total: number;
}

/** Monthly counts of newly created tools, split by a single-valued group; top groups + "Other". */
export function monthlyByGroup(tools: Tool[], months: string[], groupOf: (t: Tool) => string,
                               labelOf: (k: string) => string, maxSeries = MAX_SERIES): Series[] {
  const idx = new Map(months.map((m, i) => [m, i]));
  const acc = new Map<string, number[]>();
  for (const t of tools) {
    const i = idx.get(t.created.slice(0, 7));
    if (i === undefined) continue;
    const g = groupOf(t);
    if (!acc.has(g)) acc.set(g, months.map(() => 0));
    acc.get(g)![i]++;
  }
  const all = [...acc.entries()]
    .map(([key, values]) => ({ key, label: labelOf(key), values, total: values.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  if (all.length <= maxSeries + 1) return all;
  const head = all.slice(0, maxSeries);
  const tail = all.slice(maxSeries);
  const other = months.map((_, i) => tail.reduce((s, x) => s + x.values[i], 0));
  return [...head, { key: "__other", label: "Other", values: other, total: other.reduce((a, b) => a + b, 0) }];
}

export interface Ranked {
  key: string;
  label: string;
  value: number;
}

export function rank(map: Map<string, number>, labelOf: (k: string) => string, limit?: number): Ranked[] {
  const out = [...map.entries()].map(([key, value]) => ({ key, label: labelOf(key), value })).sort((a, b) => b.value - a.value);
  return limit ? out.slice(0, limit) : out;
}

/* ------------------------------------------------------------------ lenses (bottom section) */
export type LensKey = "discipline" | "phase" | "category" | "role";

export interface Lens {
  key: LensKey;
  label: string;
  title: string;
  /** lower-case noun used inside chart titles */
  noun: string;
  description: string;
  groupsOf: (t: Tool) => string[];
  ids: { id: string; label: string }[];
}

export function lenses(tax: Taxonomy | null): Lens[] {
  const t = tax;
  return [
    {
      key: "discipline", label: "Discipline", title: "Engineering discipline", noun: "discipline",
      description: "Which engineering disciplines each tool serves (a tool can serve several).",
      groupsOf: (x) => x.cls?.disciplines ?? [], ids: t?.disciplines ?? [],
    },
    {
      key: "phase", label: "Systems engineering", title: "Systems engineering lifecycle (V-model phase)", noun: "V-model phase",
      description: "Where in the systems engineering V-model each tool is primarily used.",
      groupsOf: (x) => x.cls?.lifecycle_phases ?? [], ids: t?.lifecycle_phases ?? [],
    },
    {
      key: "category", label: "Digital engineering", title: "Digital engineering capability area", noun: "capability area",
      description: "The digital engineering capability each tool provides (its primary category).",
      groupsOf: (x) => (x.cls ? [x.cls.primary_category] : []),
      ids: (t?.categories ?? []).filter((c) => c.id !== "general_software"),
    },
    {
      key: "role", label: "Career role", title: "Future job role", noun: "job role",
      description: "The graduate roles for which each tool is most central.",
      groupsOf: (x) => x.cls?.career_roles ?? [], ids: t?.career_roles ?? [],
    },
  ];
}

export interface GroupStats {
  id: string;
  label: string;
  count: number;
  monthly: number[];
  recentShare: number; // share of the group's tools created in the last 90 days
  trlBands: [number, number, number]; // experimental 1-3, emerging 4-6, mature 7-9
  starsPerDay: number;
}

export function groupStats(tools: Tool[], lens: Lens, months: string[], now = Date.now()): GroupStats[] {
  const idx = new Map(months.map((m, i) => [m, i]));
  const m = new Map<string, GroupStats>(
    lens.ids.map((x) => [x.id, { id: x.id, label: x.label, count: 0, monthly: months.map(() => 0), recentShare: 0,
      trlBands: [0, 0, 0] as [number, number, number], starsPerDay: 0 }]),
  );
  const recent = new Map<string, number>();
  for (const t of tools) {
    if (!t.cls) continue;
    const isRecent = now - Date.parse(t.created) <= 90 * 86_400_000;
    for (const g of new Set(lens.groupsOf(t))) {
      const s = m.get(g);
      if (!s) continue;
      s.count++;
      const i = idx.get(t.created.slice(0, 7));
      if (i !== undefined) s.monthly[i]++;
      if (isRecent) recent.set(g, (recent.get(g) ?? 0) + 1);
      s.trlBands[t.cls.trl <= 3 ? 0 : t.cls.trl <= 6 ? 1 : 2]++;
      s.starsPerDay += t.spd;
    }
  }
  return [...m.values()]
    .filter((s) => s.count > 0)
    .map((s) => ({ ...s, recentShare: (recent.get(s.id) ?? 0) / s.count }))
    .sort((a, b) => b.count - a.count);
}

const STOP = new Set([
  "ai", "tool", "tools", "open-source", "opensource", "library", "app", "framework", "python", "javascript",
  "typescript", "rust", "cpp", "c", "go", "java", "awesome", "github", "llm", "api", "cli", "software", "engineering",
]);

/** Keyword frequencies for a word cloud: AI keywords + repo topics, weighted by sqrt(stars/day) momentum. */
export function keywordWeights(tools: Tool[], limit = 60): { text: string; weight: number; count: number }[] {
  const w = new Map<string, { weight: number; count: number }>();
  for (const t of tools) {
    const words = new Set([...(t.cls?.keywords ?? []), ...t.topics].map((x) => x.toLowerCase().replace(/_/g, "-").trim()));
    const boost = 1 + Math.sqrt(Math.max(0, t.spd));
    for (const word of words) {
      if (!word || word.length < 2 || word.length > 28 || STOP.has(word)) continue;
      const e = w.get(word) ?? { weight: 0, count: 0 };
      e.weight += boost;
      e.count++;
      w.set(word, e);
    }
  }
  return [...w.entries()]
    .map(([text, v]) => ({ text, ...v }))
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}
