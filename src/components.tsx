import { useEffect } from "react";
import { compact, type Labels } from "./data";
import type { Tool } from "./types";

/* ------------------------------------------------------------------ facet list */
export interface FacetOption {
  id: string;
  label: string;
  count: number;
}

export function Facet(props: {
  title: string;
  options: FacetOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  hint?: string;
}) {
  const { title, options, value, onChange, hint } = props;
  const max = Math.max(1, ...options.map((o) => o.count));
  return (
    <section className="facet">
      <div className="facet-head">
        <h3>{title}</h3>
        {value && (
          <button className="link" onClick={() => onChange(null)}>
            clear
          </button>
        )}
      </div>
      {hint && <p className="facet-hint">{hint}</p>}
      <ul>
        {options.map((o) => (
          <li key={o.id}>
            <button
              className={"facet-item" + (value === o.id ? " active" : "")}
              onClick={() => onChange(value === o.id ? null : o.id)}
              disabled={o.count === 0 && value !== o.id}
              aria-pressed={value === o.id}
            >
              <span className="facet-bar" style={{ width: `${(o.count / max) * 100}%` }} />
              <span className="facet-label">{o.label}</span>
              <span className="facet-count">{o.count.toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ badges */
export function TrlBadge({ trl, labels }: { trl: number; labels: Labels }) {
  const band = trl <= 3 ? "low" : trl <= 6 ? "mid" : "high";
  return (
    <span className={`trl trl-${band}`} title={labels.trl.get(trl) ?? ""}>
      TRL {trl}
    </span>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <span className={"stat" + (accent ? " accent" : "")}>
      <strong>{value}</strong> {label}
    </span>
  );
}

/* ------------------------------------------------------------------ card */
export function ToolCard(props: {
  tool: Tool;
  domainLabels: Record<string, string>;
  labels: Labels;
  onOpen: (t: Tool) => void;
}) {
  const { tool: t, domainLabels, labels, onOpen } = props;
  const [owner, repo] = t.name.split("/");
  const c = t.cls;
  return (
    <article className="card" onClick={() => onOpen(t)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(t)}>
      <header className="card-head">
        <h2>
          <span className="owner">{owner}/</span>
          {repo}
        </h2>
        {c && <TrlBadge trl={c.trl} labels={labels} />}
      </header>
      <p className="card-desc">{c?.summary || t.desc || "No description."}</p>
      <div className="card-stats">
        <Stat value={"★ " + compact(t.stars)} label="" />
        <Stat value={"+" + compact(Math.round(t.spd))} label="/day" accent={t.spd >= 20} />
        {t.d7 != null && <Stat value={"+" + compact(t.d7)} label="this week" />}
        {t.lang && <span className="lang">{t.lang}</span>}
        <span className="muted">since {t.created.slice(0, 7)}</span>
      </div>
      <div className="tags">
        {c ? (
          <span className="tag tag-cat">{labels.category.get(c.primary_category) ?? c.primary_category}</span>
        ) : (
          t.domains.map((d) => (
            <span key={d} className="tag">
              {domainLabels[d] ?? d}
            </span>
          ))
        )}
        {c?.career_roles.slice(0, 2).map((r) => (
          <span key={r} className="tag tag-role">
            {labels.role.get(r) ?? r}
          </span>
        ))}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ detail drawer */
function Row({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="detail-row">
      <h4>{title}</h4>
      <div className="tags">
        {items.map((i) => (
          <span key={i} className="tag">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Detail(props: {
  tool: Tool;
  domainLabels: Record<string, string>;
  labels: Labels;
  onClose: () => void;
}) {
  const { tool: t, domainLabels, labels, onClose } = props;
  const c = t.cls;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const map = (m: Map<string, string>, xs: string[]) => xs.map((x) => m.get(x) ?? x);

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t.name}>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="drawer-title">{t.name}</h2>
        <p className="drawer-desc">{c?.what_it_does || t.desc}</p>
        <div className="card-stats">
          <Stat value={"★ " + t.stars.toLocaleString()} label="stars" />
          <Stat value={"+" + t.spd.toFixed(1)} label="stars/day avg" accent={t.spd >= 20} />
          {t.d7 != null && <Stat value={"+" + t.d7.toLocaleString()} label="last 7 days" />}
          {t.d30 != null && <Stat value={"+" + t.d30.toLocaleString()} label="last 30 days" />}
        </div>
        <p className="muted small">
          Created {t.created} · last push {t.pushed} · {t.lang ?? "unknown language"} · {t.lic ?? "no license info"}
        </p>
        <div className="drawer-links">
          <a href={t.url} target="_blank" rel="noreferrer">
            Open repository ↗
          </a>
          {t.home && (
            <a href={t.home} target="_blank" rel="noreferrer">
              Website ↗
            </a>
          )}
        </div>

        {c ? (
          <>
            <div className="detail-row">
              <h4>Maturity</h4>
              <p>
                <TrlBadge trl={c.trl} labels={labels} /> {labels.trl.get(c.trl)} — {c.trl_rationale}
              </p>
            </div>
            <Row title="Category" items={[labels.category.get(c.primary_category) ?? c.primary_category, ...map(labels.subcategory, c.subcategories)]} />
            <Row title="Lifecycle phase (V-model)" items={map(labels.phase, c.lifecycle_phases)} />
            <Row title="Disciplines" items={map(labels.discipline, c.disciplines)} />
            <Row title="Career roles" items={map(labels.role, c.career_roles)} />
            <Row title="Teaching use" items={map(labels.teaching, c.teaching_uses)} />
            <div className="detail-row">
              <h4>Getting started</h4>
              <p>
                Learning curve: <strong>{c.learning_curve}</strong> · Cost: <strong>{c.cost_model.replace(/_/g, " ")}</strong>
                {c.platforms.length > 0 && <> · Runs on: {c.platforms.join(", ")}</>}
              </p>
              {c.prerequisites.length > 0 && <p className="muted">Prerequisites: {c.prerequisites.join(", ")}</p>}
            </div>
            {c.student_project_ideas.length > 0 && (
              <div className="detail-row">
                <h4>Student project ideas</h4>
                <ul className="ideas">
                  {c.student_project_ideas.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            )}
            <Row title="Alternatives" items={c.relations.alternatives_to} />
            <Row title="Integrates with" items={c.relations.integrates_with} />
            <Row title="Built on" items={c.relations.built_on} />
            <p className="muted small">AI classification · confidence: {c.confidence}. Reviewed by lecturer: not yet.</p>
          </>
        ) : (
          <>
            <Row title="Crawl domains" items={t.domains.map((d) => domainLabels[d] ?? d)} />
            <Row title="Topics" items={t.topics} />
            <p className="notice">Not yet classified. Category, maturity (TRL), lifecycle phase and career roles appear here after the AI classification step runs.</p>
          </>
        )}
      </aside>
    </div>
  );
}
