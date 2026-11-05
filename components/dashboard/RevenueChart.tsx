"use client";

import { ArrowUpRight, LineChart, Table2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { revenueRanges, usd } from "@/lib/sample-data";

type RangeKey = keyof typeof revenueRanges;

const MIN_H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

/** Pick a 1/2/2.5/5 x 10^n step giving at most 5 intervals, so ticks stay clean and headroom small. */
function niceScale(v: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(v / 5)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => Math.ceil(v / s) <= 5) ?? 10 * pow;
  const n = Math.ceil(v / step);
  return { max: step * n, ticks: Array.from({ length: n + 1 }, (_, i) => i * step) };
}
const compact = (n: number) => (n >= 1000 ? `$${+(n / 1000).toFixed(1)}k` : `$${n}`);

export function RevenueChart() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [H, setH] = useState(MIN_H);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setW(Math.max(260, Math.round(e.contentRect.width)));
      setH(Math.max(MIN_H, Math.min(380, Math.round(e.contentRect.height))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const data = revenueRanges[range];
  const pts = data.points;

  const geo = useMemo(() => {
    const { max, ticks } = niceScale(Math.max(...pts.map((p) => p.value)) * 1.05);
    const iw = w - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
    const y = (v: number) => PAD.top + ih - (v / max) * ih;
    // monotone-ish smooth path (Catmull-Rom → Bézier, tension 0.5 clamped)
    const xy = pts.map((p, i) => [x(i), y(p.value)] as const);
    let d = `M${xy[0][0]},${xy[0][1]}`;
    for (let i = 0; i < xy.length - 1; i++) {
      const p0 = xy[i - 1] ?? xy[i];
      const p1 = xy[i];
      const p2 = xy[i + 1];
      const p3 = xy[i + 2] ?? p2;
      const t = 0.18;
      const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
      const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    const area = `${d} L${xy[xy.length - 1][0]},${PAD.top + ih} L${xy[0][0]},${PAD.top + ih} Z`;
    // show at most ~6 x labels
    const every = Math.ceil(pts.length / Math.max(2, Math.floor(iw / 90)));
    return { d, area, ticks, x, y, ih, iw, every, xy };
  }, [pts, w, H]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bd = Infinity;
    geo.xy.forEach(([x], i) => {
      const dd = Math.abs(x - px);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover != null ? pts[hover] : null;
  const prev = hover != null && hover > 0 ? pts[hover - 1] : null;

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={LineChart}
        title="Revenue overview"
        subtitle="Cumulative collected revenue, all divisions"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-line bg-surface-2 p-0.5" role="group" aria-label="Chart or table">
              <button onClick={() => setView("chart")} aria-pressed={view === "chart"} title="Chart view" className={`grid h-7 w-7 place-items-center rounded-md ${view === "chart" ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>
                <LineChart size={15} />
              </button>
              <button onClick={() => setView("table")} aria-pressed={view === "table"} title="Table view" className={`grid h-7 w-7 place-items-center rounded-md ${view === "table" ? "bg-surface text-accent shadow-soft" : "text-muted"}`}>
                <Table2 size={15} />
              </button>
            </div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              aria-label="Date range"
              className="h-8 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium text-ink-2 focus:border-accent focus:outline-none"
            >
              {Object.entries(revenueRanges).map(([k, r]) => (
                <option key={k} value={k}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 sm:px-6 md:flex-row md:items-stretch">
        <div className="order-1 flex shrink-0 items-end gap-4 md:order-2 md:w-[150px] md:flex-col md:items-start md:justify-center md:border-l md:border-line md:pl-6">
          <div>
            <div className="text-[28px] font-bold leading-none tracking-tight text-ink tabular-nums sm:text-[32px]">{usd(data.total)}</div>
            <div className="mt-1.5 text-[13px] text-muted">Total revenue · {data.title.toLowerCase()}</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[12.5px] font-semibold text-success-ink">
            <ArrowUpRight size={14} strokeWidth={2.5} /> {data.delta}% vs prior
          </span>
        </div>

        <div ref={wrapRef} className="relative order-2 min-h-[240px] min-w-0 flex-1 overflow-hidden md:order-1">
          {view === "chart" ? (
            <div className="absolute inset-0">
              {w > 0 && (<>
              <svg
                width={w}
                height={H}
                role="img"
                aria-label={`Revenue ${data.title}: from ${usd(pts[0].value)} to ${usd(pts[pts.length - 1].value)}`}
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
                className="block touch-pan-y select-none"
              >
                <defs>
                  <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--chart-area-top)" />
                    <stop offset="1" stopColor="var(--chart-area-bottom)" />
                  </linearGradient>
                </defs>
                {geo.ticks.map((t) => (
                  <g key={t}>
                    <line x1={PAD.left} x2={w - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--chart-grid)" strokeDasharray={t === 0 ? undefined : "3 4"} />
                    <text x={PAD.left - 10} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                      {compact(t)}
                    </text>
                  </g>
                ))}
                {pts.map((p, i) =>
                  i % geo.every === 0 || i === pts.length - 1 ? (
                    i !== pts.length - 1 && pts.length - 1 - i < geo.every / 2 ? null : (
                      <text key={p.label} x={geo.x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
                        {p.label}
                      </text>
                    )
                  ) : null,
                )}
                <path d={geo.area} fill="url(#rev-fill)" />
                <path d={geo.d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {hover != null && (
                  <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={PAD.top + geo.ih} stroke="var(--border-strong)" strokeWidth={1} />
                )}
                {/* end-point marker + hover marker, with surface ring */}
                {[pts.length - 1, ...(hover != null && hover !== pts.length - 1 ? [hover] : [])].map((i) => (
                  <circle key={i} cx={geo.x(i)} cy={geo.y(pts[i].value)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
                ))}
              </svg>
              {hp && hover != null && (
                <div
                  className="pointer-events-none absolute z-10 min-w-[140px] -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 shadow-pop"
                  style={{
                    left: Math.min(Math.max(geo.x(hover), 80), w - 80),
                    top: Math.max(0, geo.y(hp.value) - 74),
                  }}
                >
                  <div className="text-[11.5px] font-medium text-muted">{hp.label}</div>
                  <div className="text-[15px] font-bold text-ink tabular-nums">{usd(hp.value)}</div>
                  {prev && (
                    <div className="text-[11.5px] text-muted tabular-nums">
                      {hp.value >= prev.value ? "+" : "−"}
                      {usd(Math.abs(hp.value - prev.value))} since {prev.label}
                    </div>
                  )}
                </div>
              )}
              </>)}
            </div>
          ) : (
            <div className="scrollbar-thin absolute inset-0 overflow-auto rounded-xl border border-line">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-surface-2 text-left text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Cumulative revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {pts.map((p) => (
                    <tr key={p.label} className="border-t border-line">
                      <td className="px-3 py-2 text-ink-2">{p.label}</td>
                      <td className="px-3 py-2 text-right font-medium text-ink tabular-nums">{usd(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
