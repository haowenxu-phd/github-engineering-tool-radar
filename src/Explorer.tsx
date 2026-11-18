import { useCallback, useMemo, useState } from "react";
import { Detail, Facet, ToolCard, type FacetOption } from "./components";
import { EMPTY_FILTERS, applyFilters, countBy, isOther, labelMaps, sortTools } from "./data";
import type { AgeKey, Filters, Meta, SortKey, Taxonomy, Tool } from "./types";

const PAGE = 60;

export default function Explorer({ tools, meta, tax }: { tools: Tool[]; meta: Meta; tax: Taxonomy | null }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("rising");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Tool | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const set = useCallback(<K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setLimit(PAGE);
  }, []);

  const labels = useMemo(() => labelMaps(tax), [tax]);
  const all = tools;
  const classified = meta.classified > 0;
  const hasWeekly = useMemo(() => all.some((t) => t.d7 != null), [all]);

  const results = useMemo(() => sortTools(applyFilters(all, filters), sort), [all, filters, sort]);

  // Facet counts: each facet is counted against all *other* active filters.
  const facet = useCallback(
    (key: keyof Filters, keysOf: (t: Tool) => string[], ids: { id: string; label: string }[]): FacetOption[] => {
      const counts = countBy(applyFilters(all, filters, key), keysOf);
      return ids
        .map((x) => ({ id: x.id, label: x.label, count: counts.get(x.id) ?? 0 }))
        .filter((o) => o.count > 0 || filters[key] === o.id)
        .sort((a, b) => b.count - a.count);
    },
    [all, filters],
  );

  const domainOptions = useMemo(
    () => facet("domain", (t) => t.domains, Object.entries(meta.domains).map(([id, label]) => ({ id, label }))),
    [facet, meta],
  );

  const activeCount = Object.entries(filters).filter(([k, v]) =>
    k === "showOther" ? false : k === "minTrl" ? (v as number) > 0 : k === "age" ? v !== "all" : !!v,
  ).length;
  const otherCount = applyFilters(all, { ...filters, showOther: true }).filter(isOther).length;

  return (
    <>

      {!classified && (
        <div className="banner">
          Preview: tools are grouped by crawl domain. Categories, maturity (TRL), V-model phase, disciplines and career
          roles appear once the AI classification step has run.
        </div>
      )}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search tools, e.g. digital twin, gaussian splatting, ros2, text-to-cad…"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          aria-label="Search tools"
        />
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="rising">Rising (stars/day)</option>
            {hasWeekly && <option value="week">Most stars this week</option>}
            <option value="stars">Most stars overall</option>
            <option value="new">Newest</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
        <label>
          Created
          <select value={filters.age} onChange={(e) => set("age", e.target.value as AgeKey)}>
            <option value="all">Any time</option>
            <option value="365">Last 12 months</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
        <button className="filters-toggle" onClick={() => setShowFilters((s) => !s)}>
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>

      <div className="layout">
        <aside className={"sidebar" + (showFilters ? " open" : "")}>
          {classified && tax ? (
            <>
              <Facet title="Category" options={facet("category", (t) => (t.cls ? [t.cls.primary_category] : []), tax.categories)} value={filters.category} onChange={(v) => set("category", v)} />
              <Facet title="Lifecycle phase (V-model)" options={facet("phase", (t) => t.cls?.lifecycle_phases ?? [], tax.lifecycle_phases)} value={filters.phase} onChange={(v) => set("phase", v)} />
              <Facet title="Discipline" options={facet("discipline", (t) => t.cls?.disciplines ?? [], tax.disciplines)} value={filters.discipline} onChange={(v) => set("discipline", v)} />
              <Facet title="Career role" options={facet("role", (t) => t.cls?.career_roles ?? [], tax.career_roles)} value={filters.role} onChange={(v) => set("role", v)} />
              <section className="facet">
                <div className="facet-head">
                  <h3>Minimum maturity</h3>
                </div>
                <select value={filters.minTrl} onChange={(e) => set("minTrl", Number(e.target.value))}>
                  <option value={0}>Any TRL</option>
                  {tax.trl_scale.map((l) => (
                    <option key={l.level} value={l.level}>
                      TRL {l.level}+ ({l.label})
                    </option>
                  ))}
                </select>
              </section>
            </>
          ) : null}
          <Facet title="Crawl domain" options={domainOptions} value={filters.domain} onChange={(v) => set("domain", v)} hint={classified ? undefined : "Broad seed areas used to find the tools."} />
          {activeCount > 0 && (
            <button className="reset" onClick={() => { setFilters(EMPTY_FILTERS); setLimit(PAGE); }}>
              Reset all filters
            </button>
          )}
        </aside>

        <main>
          <div className="result-head">
            <p className="result-count">
              {results.length.toLocaleString()} {results.length === 1 ? "tool" : "tools"}{" "}
              {sort === "rising" && <span className="muted">· ranked by average stars per day since creation</span>}
            </p>
            {(otherCount > 0 || filters.showOther) && (
              <label className="toggle">
                <input type="checkbox" checked={filters.showOther} onChange={(e) => set("showOther", e.target.checked)} />
                Show {otherCount.toLocaleString()} non-engineering tools
              </label>
            )}
          </div>
          {results.length === 0 ? (
            <div className="state">No tools match these filters.</div>
          ) : (
            <div className="grid">
              {results.slice(0, limit).map((t) => (
                <ToolCard key={t.id} tool={t} domainLabels={meta.domains} labels={labels} onOpen={setOpen} />
              ))}
            </div>
          )}
          {limit < results.length && (
            <button className="more" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({(results.length - limit).toLocaleString()} left)
            </button>
          )}
        </main>
      </div>


      {open && <Detail tool={open} domainLabels={meta.domains} labels={labels} onClose={() => setOpen(null)} />}
    </>
  );
}
