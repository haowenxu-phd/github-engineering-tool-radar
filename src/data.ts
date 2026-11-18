import type { AgeKey, Filters, SortKey, Taxonomy, Tool } from "./types";

export const EMPTY_FILTERS: Filters = {
  q: "",
  domain: null,
  category: null,
  phase: null,
  discipline: null,
  role: null,
  minTrl: 0,
  age: "all",
  showOther: false,
};

export const isOther = (t: Tool) => t.cls != null && !t.cls.is_engineering_relevant;

const DAY = 86_400_000;

function ageOk(t: Tool, age: AgeKey, now: number): boolean {
  if (age === "all" || !t.created) return true;
  return now - Date.parse(t.created) <= Number(age) * DAY;
}

function textOk(t: Tool, q: string): boolean {
  if (!q) return true;
  const hay = [t.name, t.desc, t.topics.join(" "), t.cls?.summary ?? "", t.cls?.keywords.join(" ") ?? ""]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

/** Apply all filters, optionally ignoring one facet (used to compute that facet's counts). */
export function applyFilters(tools: Tool[], f: Filters, ignore?: keyof Filters): Tool[] {
  const now = Date.now();
  return tools.filter((t) => {
    if (ignore !== "showOther" && !f.showOther && isOther(t)) return false;
    if (ignore !== "q" && !textOk(t, f.q)) return false;
    if (ignore !== "age" && !ageOk(t, f.age, now)) return false;
    if (ignore !== "domain" && f.domain && !t.domains.includes(f.domain)) return false;
    const c = t.cls;
    if (ignore !== "category" && f.category && c?.primary_category !== f.category) return false;
    if (ignore !== "phase" && f.phase && !c?.lifecycle_phases.includes(f.phase)) return false;
    if (ignore !== "discipline" && f.discipline && !c?.disciplines.includes(f.discipline)) return false;
    if (ignore !== "role" && f.role && !c?.career_roles.includes(f.role)) return false;
    if (ignore !== "minTrl" && f.minTrl > 0 && (c?.trl ?? 0) < f.minTrl) return false;
    return true;
  });
}

export function sortTools(tools: Tool[], key: SortKey): Tool[] {
  const out = [...tools];
  const by: Record<SortKey, (a: Tool, b: Tool) => number> = {
    rising: (a, b) => b.spd - a.spd,
    week: (a, b) => (b.d7 ?? -1) - (a.d7 ?? -1),
    stars: (a, b) => b.stars - a.stars,
    new: (a, b) => b.created.localeCompare(a.created),
    updated: (a, b) => b.pushed.localeCompare(a.pushed),
  };
  return out.sort(by[key]);
}

export function countBy(tools: Tool[], keysOf: (t: Tool) => string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tools) for (const k of keysOf(t)) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  if (n >= 1_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function labelMaps(tax: Taxonomy | null) {
  const m = (xs: { id: string; label: string }[] | undefined) => new Map((xs ?? []).map((x) => [x.id, x.label]));
  const sub = new Map<string, string>();
  for (const c of tax?.categories ?? []) for (const s of c.subcategories) sub.set(`${c.id}.${s.id}`, s.label);
  return {
    category: m(tax?.categories),
    subcategory: sub,
    phase: m(tax?.lifecycle_phases),
    discipline: m(tax?.disciplines),
    role: m(tax?.career_roles),
    teaching: m(tax?.teaching_uses),
    trl: new Map((tax?.trl_scale ?? []).map((l) => [l.level, l.label])),
  };
}

export type Labels = ReturnType<typeof labelMaps>;
