import { max, scaleBand, scaleLinear, scaleSqrt } from "d3";
import cloud from "d3-cloud";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { compact } from "../data";
import { monthLabel } from "./metrics";

/* ================================================================== shared plumbing */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    setW(Math.floor(ref.current.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

/** Tooltip positioned inside the nearest .viz-host (position: relative). */
function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = (e: React.MouseEvent | React.FocusEvent, content: ReactNode) => {
    const host = (e.currentTarget as Element).closest(".viz-host");
    if (!host) return;
    const r = host.getBoundingClientRect();
    let x: number, y: number;
    if ("clientX" in e) {
      x = e.clientX - r.left;
      y = e.clientY - r.top;
    } else {
      const b = (e.currentTarget as Element).getBoundingClientRect();
      x = b.left + b.width / 2 - r.left;
      y = b.top - r.top;
    }
    // keep the tooltip (centred on x, up to 280px wide) inside the chart so it never widens the page
    const half = Math.min(140, r.width / 2);
    x = Math.min(Math.max(x, half), r.width - half);
    setTip({ x, y, content });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  ) : null;
  return { show, hide, node };
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="viz-legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="swatch" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

export function ChartCard(props: {
  title: string;
  subtitle?: string;
  note?: ReactNode;
  legend?: ReactNode;
  table: TableData;
  wide?: boolean;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={"chart-card" + (props.wide ? " wide" : "")}>
      <header className="chart-head">
        <div>
          <h3>{props.title}</h3>
          {props.subtitle && <p className="chart-sub">{props.subtitle}</p>}
        </div>
        <button className="table-toggle" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? "Chart" : "Table"}
        </button>
      </header>
      {!asTable && props.legend}
      {asTable ? (
        <div className="viz-table-wrap">
          <table className="viz-table">
            <thead>
              <tr>
                {props.table.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j}>{typeof v === "number" ? v.toLocaleString() : v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        props.children
      )}
      {props.note && <p className="chart-note">{props.note}</p>}
    </section>
  );
}

/* ================================================================== ranked bar list (HTML) */
export interface BarItem {
  key: string;
  label: string;
  value: number;
  display?: string;
  tip?: ReactNode;
}

export function BarList(props: { items: BarItem[]; selected?: string | null; onSelect?: (k: string) => void }) {
  const { items, selected, onSelect } = props;
  const tip = useTip();
  const top = Math.max(1e-9, ...items.map((i) => i.value));
  return (
    <div className="viz-host barlist" onMouseLeave={tip.hide}>
      {items.map((i) => {
        const Row = onSelect ? "button" : "div";
        return (
          <Row
            key={i.key}
            className={"bar-row" + (selected === i.key ? " selected" : "") + (onSelect ? " clickable" : "")}
            onClick={onSelect ? () => onSelect(i.key) : undefined}
            onMouseMove={(e: React.MouseEvent) => tip.show(e, i.tip ?? <><strong>{i.label}</strong><br />{i.display ?? i.value.toLocaleString()}</>)}
            onFocus={(e: React.FocusEvent) => tip.show(e, i.tip ?? <><strong>{i.label}</strong><br />{i.display ?? i.value.toLocaleString()}</>)}
            onBlur={tip.hide}
            aria-pressed={onSelect ? selected === i.key : undefined}
          >
            <span className="bar-label" title={i.label}>{i.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(i.value / top) * 100}%` }} />
            </span>
            <span className="bar-value">{i.display ?? i.value.toLocaleString()}</span>
          </Row>
        );
      })}
      {tip.node}
    </div>
  );
}

/* ================================================================== stacked columns over time */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function StackedColumns(props: {
  months: string[];
  series: { key: string; label: string; values: number[]; color: string }[];
  partialLast?: boolean;
  height?: number;
}) {
  const { months, series, partialLast, height = 240 } = props;
  const [ref, width] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const m = { top: 8, right: 8, bottom: 26, left: 36 };
  const iw = Math.max(0, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const totals = months.map((_, i) => series.reduce((s, x) => s + x.values[i], 0));
  const x = scaleBand<string>().domain(months).range([0, iw]).paddingInner(0.28).paddingOuter(0.1);
  const y = scaleLinear().domain([0, max(totals) || 1]).nice(4).range([ih, 0]);
  const GAP = 2;
  const narrow = width < 520;

  return (
    <div className="viz-host" ref={ref} onMouseLeave={tip.hide}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Stacked column chart of new tools per month">
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={iw} className={t === 0 ? "axis-base" : "grid"} />
                <text x={-6} dy="0.32em" textAnchor="end" className="tick">{compact(t)}</text>
              </g>
            ))}
            {months.map((mo, i) => {
              const bx = x(mo)!;
              let acc = 0;
              const nonZero = series.filter((s) => s.values[i] > 0);
              const topKey = nonZero[nonZero.length - 1]?.key;
              const partial = partialLast && i === months.length - 1;
              return (
                <g key={mo} opacity={partial ? 0.5 : 1}>
                  {series.map((s, si) => {
                    const v = s.values[i];
                    if (!v) return null;
                    const y0 = y(acc);
                    acc += v;
                    const y1 = y(acc);
                    const isBottom = s.key === nonZero[0].key;
                    const h = Math.max(0, y0 - y1 - (isBottom ? 0 : GAP));
                    return s.key === topKey ? (
                      <path key={s.key} d={topRoundedRect(bx, y1, x.bandwidth(), h, 4)} fill={s.color} />
                    ) : (
                      <rect key={s.key} x={bx} y={y1} width={x.bandwidth()} height={h} fill={s.color} data-i={si} />
                    );
                  })}
                  {(!narrow || i % 2 === months.length % 2 || i === months.length - 1) && (
                    <text x={bx + x.bandwidth() / 2} y={ih + 17} textAnchor="middle" className="tick">
                      {monthLabel(mo, i === 0 || mo.endsWith("-01"))}
                      {partial ? "*" : ""}
                    </text>
                  )}
                  <rect
                    className="hit"
                    x={bx - (x.step() - x.bandwidth()) / 2}
                    y={0}
                    width={x.step()}
                    height={ih}
                    tabIndex={0}
                    onMouseMove={(e) => tip.show(e, monthTip(mo, totals[i], series, i, !!partial))}
                    onFocus={(e) => tip.show(e, monthTip(mo, totals[i], series, i, !!partial))}
                    onBlur={tip.hide}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {tip.node}
    </div>
  );
}

function monthTip(mo: string, total: number, series: { label: string; values: number[]; color: string }[], i: number, partial: boolean) {
  return (
    <>
      <strong>
        {monthLabel(mo, true)}
        {partial ? " (month in progress)" : ""}: {total.toLocaleString()} new tools
      </strong>
      {[...series].reverse().filter((s) => s.values[i] > 0).map((s) => (
        <div key={s.label} className="tip-row">
          <span className="swatch" style={{ background: s.color }} />
          <span>{s.label}</span>
          <span className="tip-val">{s.values[i]}</span>
        </div>
      ))}
    </>
  );
}

/* ================================================================== heatmap: group x month */
export const SEQ_STEPS = 7;

export function Heatmap(props: {
  months: string[];
  rows: { id: string; label: string; values: number[] }[];
  partialLast?: boolean;
}) {
  const { months, rows, partialLast } = props;
  const [ref, width] = useWidth<HTMLDivElement>();
  const tip = useTip();
  const narrow = width < 560;
  const labelW = narrow ? 120 : 210;
  const cellH = 24;
  const GAP = 2;
  const top = 4;
  const height = top + rows.length * cellH + 24;
  const x = scaleBand<string>().domain(months).range([labelW, Math.max(labelW + 1, width - 4)]);
  const vmax = max(rows.flatMap((r) => r.values)) || 1;
  const step = (v: number) => (v <= 0 ? 0 : Math.min(SEQ_STEPS, Math.ceil((v / vmax) * SEQ_STEPS)));

  return (
    <div className="viz-host" ref={ref} onMouseLeave={tip.hide}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Heatmap of new tools per group and month">
          {rows.map((r, ri) => (
            <g key={r.id} transform={`translate(0,${top + ri * cellH})`}>
              <text x={labelW - 8} y={cellH / 2} dy="0.32em" textAnchor="end" className="row-label">
                {narrow && r.label.length > 18 ? r.label.slice(0, 17) + "…" : r.label}
              </text>
              {months.map((mo, i) => {
                const v = r.values[i];
                const s = step(v);
                return (
                  <rect
                    key={mo}
                    x={x(mo)! + GAP / 2}
                    y={GAP / 2}
                    width={Math.max(0, x.bandwidth() - GAP)}
                    height={cellH - GAP}
                    rx={3}
                    className={s === 0 ? "cell-zero" : undefined}
                    fill={s === 0 ? undefined : `var(--seq-${s})`}
                    opacity={partialLast && i === months.length - 1 ? 0.55 : 1}
                    tabIndex={0}
                    onMouseMove={(e) => tip.show(e, <><strong>{r.label}</strong><br />{monthLabel(mo, true)}: {v} new tools</>)}
                    onFocus={(e) => tip.show(e, <><strong>{r.label}</strong><br />{monthLabel(mo, true)}: {v} new tools</>)}
                    onBlur={tip.hide}
                  />
                );
              })}
            </g>
          ))}
          {months.map((mo, i) =>
            !narrow || i % 3 === 0 || i === months.length - 1 ? (
              <text key={mo} x={x(mo)! + x.bandwidth() / 2} y={top + rows.length * cellH + 16} textAnchor="middle" className="tick">
                {monthLabel(mo, i === 0 || mo.endsWith("-01"))}
                {partialLast && i === months.length - 1 ? "*" : ""}
              </text>
            ) : null,
          )}
        </svg>
      )}
      <div className="seq-legend" aria-label={`Colour scale from 1 to ${vmax} new tools per month`}>
        <span>fewer</span>
        {Array.from({ length: SEQ_STEPS }, (_, i) => (
          <span key={i} className="seq-step" style={{ background: `var(--seq-${i + 1})` }} />
        ))}
        <span>more (max {vmax}/month)</span>
      </div>
      {tip.node}
    </div>
  );
}

/* ================================================================== 100% stacked bars */
export function PercentBars(props: {
  rows: { id: string; label: string; parts: number[] }[];
  parts: { label: string; color: string }[];
}) {
  const { rows, parts } = props;
  const tip = useTip();
  return (
    <div className="viz-host pctbars" onMouseLeave={tip.hide}>
      {rows.map((r) => {
        const total = r.parts.reduce((a, b) => a + b, 0) || 1;
        const content = (
          <>
            <strong>{r.label}</strong> ({total} tools)
            {parts.map((p, i) => (
              <div key={p.label} className="tip-row">
                <span className="swatch" style={{ background: p.color }} />
                <span>{p.label}</span>
                <span className="tip-val">{Math.round((r.parts[i] / total) * 100)}%</span>
              </div>
            ))}
          </>
        );
        return (
          <div key={r.id} className="pct-row" tabIndex={0} onMouseMove={(e) => tip.show(e, content)} onFocus={(e) => tip.show(e, content)} onBlur={tip.hide}>
            <span className="bar-label" title={r.label}>{r.label}</span>
            <span className="pct-track">
              {r.parts.map((v, i) =>
                v > 0 ? <span key={i} className="pct-seg" style={{ flexGrow: v, background: parts[i].color }} /> : null,
              )}
            </span>
            <span className="bar-value">{Math.round((r.parts[2] / total) * 100)}%</span>
          </div>
        );
      })}
      {tip.node}
    </div>
  );
}

/* ================================================================== word cloud */
interface Placed {
  text: string;
  x: number;
  y: number;
  size: number;
  count: number;
  rank: number;
}

export function WordCloud({ words, height = 300 }: { words: { text: string; weight: number; count: number }[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [placed, setPlaced] = useState<Placed[]>([]);
  const tip = useTip();

  useEffect(() => {
    if (!width || !words.length) {
      setPlaced([]);
      return;
    }
    const s = scaleSqrt().domain([Math.min(...words.map((w) => w.weight)), Math.max(...words.map((w) => w.weight))])
      .range([12, width < 480 ? 30 : 44]);
    const rankOf = new Map(words.map((w, i) => [w.text, i]));
    const countOf = new Map(words.map((w) => [w.text, w.count]));
    let cancelled = false;
    const layout = cloud<cloud.Word>()
      .size([width, height])
      .words(words.map((w) => ({ text: w.text, size: s(w.weight) })))
      .padding(3)
      .rotate(0)
      .font("system-ui, -apple-system, Segoe UI, sans-serif")
      .fontWeight(600)
      .fontSize((d) => d.size ?? 12)
      .random(() => 0.5)
      .on("end", (out) => {
        if (cancelled) return;
        setPlaced(out.map((d) => ({ text: d.text!, x: d.x!, y: d.y!, size: d.size!, count: countOf.get(d.text!) ?? 0, rank: rankOf.get(d.text!) ?? 99 })));
      });
    layout.start();
    return () => {
      cancelled = true;
      layout.stop();
    };
  }, [words, width, height]);

  return (
    <div className="viz-host" ref={ref} onMouseLeave={tip.hide}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Word cloud of the most common keywords">
          <g transform={`translate(${width / 2},${height / 2})`}>
            {placed.map((w) => (
              <text
                key={w.text}
                x={w.x}
                y={w.y}
                textAnchor="middle"
                className={"cloud-word" + (w.rank < 10 ? " strong" : "")}
                style={{ fontSize: w.size }}
                onMouseMove={(e) => tip.show(e, <><strong>{w.text}</strong><br />mentioned by {w.count} tools</>)}
              >
                {w.text}
              </text>
            ))}
          </g>
        </svg>
      )}
      {tip.node}
    </div>
  );
}
