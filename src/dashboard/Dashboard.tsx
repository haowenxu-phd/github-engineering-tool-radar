import { useMemo, useState } from "react";
import { compact, isOther } from "../data";
import type { Meta, Taxonomy, Tool } from "../types";
import { BarList, ChartCard, Heatmap, Legend, PercentBars, StackedColumns, WordCloud } from "./charts";
import {
  groupStats, keywordWeights, lenses, monthKeys, monthLabel, monthlyByGroup, primaryDomain, rank,
  type LensKey,
} from "./metrics";

const SERIES_VARS = Array.from({ length: 7 }, (_, i) => `var(--series-${i + 1})`);
const OTHER_VAR = "var(--series-other)";
const TRL_PARTS = [
  { label: "Experimental (TRL 1-3)", color: "var(--ord-1)" },
  { label: "Emerging (TRL 4-6)", color: "var(--ord-2)" },
  { label: "Mature (TRL 7-9)", color: "var(--ord-3)" },
];
const DAY = 86_400_000;

export default function Dashboard({ tools, meta, tax }: { tools: Tool[]; meta: Meta; tax: Taxonomy | null }) {
  const [includeOther, setIncludeOther] = useState(false);
  const [lensKey, setLensKey] = useState<LensKey>("discipline");
  const [focus, setFocus] = useState<string | null>(null);

  const months = useMemo(() => monthKeys(), []);
  const now = Date.now();

  const data = useMemo(() => (includeOther ? tools : tools.filter((t) => !isOther(t))), [tools, includeOther]);
  const domainLabel = (k: string) => meta.domains[k] ?? k;

  /* ---------------------------------------------------------------- top section: all tools */
  const top = useMemo(() => {
    const newYear = data.filter((t) => now - Date.parse(t.created) <= 365 * DAY).length;
    const new90 = data.filter((t) => now - Date.parse(t.created) <= 90 * DAY).length;
    const classified = data.filter((t) => t.cls).length;
    const series = monthlyByGroup(data, months, primaryDomain, domainLabel).map((s, i) => ({
      ...s, color: s.key === "__other" ? OTHER_VAR : SERIES_VARS[i],
    }));
    const attention = new Map<string, number>();
    const domainCount = new Map<string, number>();
    const langs = new Map<string, number>();
    for (const t of data) {
      for (const d of t.domains) {
        attention.set(d, (attention.get(d) ?? 0) + t.spd);
        domainCount.set(d, (domainCount.get(d) ?? 0) + 1);
      }
      if (t.lang) langs.set(t.lang, (langs.get(t.lang) ?? 0) + 1);
    }
    const rising = [...data].filter((t) => now - Date.parse(t.created) <= 365 * DAY).sort((a, b) => b.spd - a.spd).slice(0, 10);
    return { newYear, new90, classified, series, attention: rank(attention, domainLabel), domainCount, langs: rank(langs, (k) => k, 10), rising };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, months]);

  /* ---------------------------------------------------------------- bottom section: lenses */
  const allLenses = useMemo(() => lenses(tax), [tax]);
  const lens = allLenses.find((l) => l.key === lensKey)!;
  const stats = useMemo(() => groupStats(data, lens, months, now), [data, lens, months]); // eslint-disable-line react-hooks/exhaustive-deps
  const focusId = focus && stats.some((s) => s.id === focus) ? focus : stats[0]?.id ?? null;
  const focusStat = stats.find((s) => s.id === focusId);
  const words = useMemo(() => {
    if (!focusId) return [];
    return keywordWeights(data.filter((t) => t.cls && lens.groupsOf(t).includes(focusId)));
  }, [data, lens, focusId]);
  const classifiedShare = data.length ? top.classified / data.length : 0;
  const lastMonthPartial = true;

  return (
    <div className="dash">
      <div className="dash-filters">
        <label className="toggle">
          <input type="checkbox" checked={includeOther} onChange={(e) => setIncludeOther(e.target.checked)} />
          Include tools the AI marked as not engineering-related
        </label>
        <span className="muted small">Data updated {meta.generated_at.slice(0, 10)}</span>
      </div>

      {/* ============================================================ SECTION 1 */}
      <section className="dash-section">
        <div className="section-head">
          <h2>The whole landscape</h2>
          <p>All {data.length.toLocaleString()} tracked tools: how fast new ones appear, where attention is flowing, and what they are built with.</p>
        </div>

        <div className="stat-tiles">
          <div className="stat-tile"><span>Tools tracked</span><strong>{data.length.toLocaleString()}</strong></div>
          <div className="stat-tile"><span>Created in the last 12 months</span><strong>{top.newYear.toLocaleString()}</strong><em>{Math.round((top.newYear / Math.max(1, data.length)) * 100)}% of all</em></div>
          <div className="stat-tile"><span>Created in the last 90 days</span><strong>{top.new90.toLocaleString()}</strong><em>about {Math.round(top.new90 / 13)} per week</em></div>
          <div className="stat-tile"><span>AI-classified so far</span><strong>{top.classified.toLocaleString()}</strong><em>{Math.round(classifiedShare * 100)}% of tools</em></div>
        </div>

        <div className="chart-grid">
          <ChartCard
            wide
            title="New open-source tools per month"
            subtitle="Tools created each month that reached at least 20 GitHub stars, by main crawl domain"
            legend={<Legend items={top.series.map((s) => ({ label: s.label, color: s.color }))} />}
            note={<>* {monthLabel(months[months.length - 1], true)} is still in progress. Recent months are undercounted: new tools need time to reach the 20-star threshold, so a dip at the right edge is not necessarily a slowdown.</>}
            table={{
              columns: ["Month", ...top.series.map((s) => s.label), "Total"],
              rows: months.map((m, i) => [monthLabel(m, true), ...top.series.map((s) => s.values[i]), top.series.reduce((a, s) => a + s.values[i], 0)]),
            }}
          >
            <StackedColumns months={months} series={top.series} partialLast={lastMonthPartial} />
          </ChartCard>

          <ChartCard
            title="Where attention is flowing"
            subtitle="Combined stars per day across each domain's tools (average since each tool was created)"
            table={{ columns: ["Domain", "Stars/day", "Tools"], rows: top.attention.map((a) => [a.label, Math.round(a.value), top.domainCount.get(a.key) ?? 0]) }}
          >
            <BarList items={top.attention.map((a) => ({ key: a.key, label: a.label, value: a.value, display: compact(Math.round(a.value)) + "/day",
              tip: <><strong>{a.label}</strong><br />{Math.round(a.value).toLocaleString()} stars/day across {top.domainCount.get(a.key)} tools</> }))} />
          </ChartCard>

          <ChartCard
            title="Fastest-rising tools this year"
            subtitle="Average stars per day since creation, tools created in the last 12 months"
            table={{ columns: ["Tool", "Stars/day", "Stars", "Created"], rows: top.rising.map((t) => [t.name, Math.round(t.spd), t.stars, t.created]) }}
          >
            <BarList items={top.rising.map((t) => ({ key: t.id, label: t.name.split("/")[1], value: t.spd, display: `+${Math.round(t.spd)}/day`,
              tip: <><strong>{t.name}</strong><br />{t.cls?.summary ?? t.desc}<br />{t.stars.toLocaleString()} stars since {t.created}</> }))} />
          </ChartCard>

          <ChartCard
            title="What the tools are built with"
            subtitle="Primary programming language, top 10"
            table={{ columns: ["Language", "Tools"], rows: top.langs.map((l) => [l.label, l.value]) }}
          >
            <BarList items={top.langs.map((l) => ({ key: l.key, label: l.label, value: l.value }))} />
          </ChartCard>

          <ChartCard
            title="Tools per domain"
            subtitle="A tool found through several crawl domains counts in each"
            table={{ columns: ["Domain", "Tools"], rows: rank(top.domainCount, domainLabel).map((d) => [d.label, d.value]) }}
          >
            <BarList items={rank(top.domainCount, domainLabel).map((d) => ({ key: d.key, label: d.label, value: d.value }))} />
          </ChartCard>
        </div>
      </section>

      {/* ============================================================ SECTION 2 */}
      <section className="dash-section">
        <div className="section-head">
          <h2>By discipline, systems engineering and digital engineering</h2>
          <p>
            How the AI-classified tools spread across disciplines, the systems engineering lifecycle and digital
            engineering capability areas, and which areas are growing fastest.
          </p>
        </div>

        <div className="lens-bar" role="tablist" aria-label="Group tools by">
          {allLenses.map((l) => (
            <button key={l.key} role="tab" aria-selected={l.key === lensKey} className={l.key === lensKey ? "active" : ""}
              onClick={() => { setLensKey(l.key); setFocus(null); }}>
              {l.label}
            </button>
          ))}
        </div>
        <p className="lens-desc">
          {lens.description}{" "}
          {classifiedShare < 0.95 && (
            <span className="muted">Based on {top.classified.toLocaleString()} AI-classified tools so far ({Math.round(classifiedShare * 100)}%); charts fill in as classification completes.</span>
          )}
        </p>

        {stats.length === 0 ? (
          <div className="state">No classified tools yet for this view.</div>
        ) : (
          <div className="chart-grid">
            <ChartCard
              title={`Tools per ${lens.noun}`}
              subtitle="Select a row to see what its tools are about"
              table={{ columns: [lens.title, "Tools", "Created in last 90 days"], rows: stats.map((s) => [s.label, s.count, `${Math.round(s.recentShare * 100)}%`]) }}
            >
              <BarList selected={focusId} onSelect={setFocus}
                items={stats.map((s) => ({ key: s.id, label: s.label, value: s.count }))} />
            </ChartCard>

            <ChartCard
              title={`What "${focusStat?.label ?? ""}" tools are about`}
              subtitle="Most common keywords and topics, weighted by how fast the tools are rising"
              table={{ columns: ["Keyword", "Tools mentioning it"], rows: words.map((w) => [w.text, w.count]) }}
            >
              {words.length ? <WordCloud words={words} /> : <div className="state">Not enough tools in this group yet.</div>}
            </ChartCard>

            <ChartCard
              wide
              title={`When new tools appeared, by ${lens.noun}`}
              subtitle="Number of new tools created each month (darker = more). Read across a row to see an area heating up."
              note={<>* {monthLabel(months[months.length - 1], true)} is still in progress; recent months are undercounted (tools need time to reach 20 stars).</>}
              table={{ columns: [lens.title, ...months.map((m) => monthLabel(m, true))], rows: stats.map((s) => [s.label, ...s.monthly]) }}
            >
              <Heatmap months={months} partialLast={lastMonthPartial} rows={stats.map((s) => ({ id: s.id, label: s.label, values: s.monthly }))} />
            </ChartCard>

            <ChartCard
              title="Emerging areas"
              subtitle="Share of each group's tools created in the last 90 days: higher means the area is new and moving fast"
              table={{ columns: [lens.title, "Created in last 90 days", "Tools"], rows: [...stats].sort((a, b) => b.recentShare - a.recentShare).map((s) => [s.label, `${Math.round(s.recentShare * 100)}%`, s.count]) }}
            >
              <BarList items={[...stats].filter((s) => s.count >= 5).sort((a, b) => b.recentShare - a.recentShare)
                .map((s) => ({ key: s.id, label: s.label, value: s.recentShare, display: `${Math.round(s.recentShare * 100)}%`,
                  tip: <><strong>{s.label}</strong><br />{Math.round(s.recentShare * 100)}% of {s.count} tools created in the last 90 days</> }))} />
            </ChartCard>

            <ChartCard
              title="How mature is each area?"
              subtitle="Share of tools by maturity band (AI-estimated TRL); the number is the mature share"
              legend={<Legend items={TRL_PARTS} />}
              table={{ columns: [lens.title, ...TRL_PARTS.map((p) => p.label), "Tools"], rows: stats.map((s) => [s.label, ...s.trlBands, s.count]) }}
            >
              <PercentBars parts={TRL_PARTS} rows={stats.map((s) => ({ id: s.id, label: s.label, parts: s.trlBands }))} />
            </ChartCard>
          </div>
        )}
      </section>
    </div>
  );
}
