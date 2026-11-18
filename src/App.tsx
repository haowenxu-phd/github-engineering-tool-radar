import { useEffect, useState } from "react";
import Dashboard from "./dashboard/Dashboard";
import Explorer from "./Explorer";
import type { Meta, Taxonomy, Tool } from "./types";

type Tab = "explorer" | "dashboard";
const tabFromHash = (): Tab => (window.location.hash === "#dashboard" ? "dashboard" : "explorer");

export default function App() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tax, setTax] = useState<Taxonomy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(tabFromHash);

  useEffect(() => {
    // "no-cache" = always revalidate, so a daily data refresh shows up without a hard reload
    Promise.all([
      fetch("data/tools.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch("data/taxonomy.json", { cache: "no-cache" }).then((r) => r.json()),
    ])
      .then(([d, t]) => {
        setTools(d.tools);
        setMeta(d.meta);
        setTax(t);
      })
      .catch((e) => setError(String(e)));
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (error) return <div className="state">Could not load data: {error}</div>;
  if (!tools || !meta) return <div className="state">Loading tools…</div>;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Digital Engineering Tool Radar</h1>
          <p>
            Trending open-source tools for Digital &amp; Systems Engineering students: what is rising on GitHub, what it is
            for, and where it fits in the engineering lifecycle.
          </p>
        </div>
        <nav className="tabs" aria-label="Views">
          <a href="#explorer" className={tab === "explorer" ? "active" : ""} aria-current={tab === "explorer" ? "page" : undefined}>
            Tool explorer
          </a>
          <a href="#dashboard" className={tab === "dashboard" ? "active" : ""} aria-current={tab === "dashboard" ? "page" : undefined}>
            Trends dashboard
          </a>
        </nav>
      </header>

      {tab === "explorer" ? <Explorer tools={tools} meta={meta} tax={tax} /> : <Dashboard tools={tools} meta={meta} tax={tax} />}

      <footer className="foot">
        Data from the GitHub and GitLab APIs ({meta.count.toLocaleString()} tools, updated {meta.generated_at.slice(0, 10)}).
        Star counts are a popularity signal, not a quality guarantee: check maturity and licence before adopting a tool.
      </footer>
    </div>
  );
}
