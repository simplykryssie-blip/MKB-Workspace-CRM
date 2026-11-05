"use client";

import Link from "next/link";
import { PieChart } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { SERVICES, servicePerformance, usd } from "@/lib/sample-data";

const COLOR = { tax: "var(--svc-tax)", books: "var(--svc-books)", biz: "var(--svc-biz)", expunge: "var(--svc-expunge)" } as const;

const SIZE = 184;
const R = 76;
const STROKE = 22;
const C = 2 * Math.PI * R;
const GAP = 3; // px of surface between segments

export function ServiceDonut() {
  const [hover, setHover] = useState<string | null>(null);
  const total = servicePerformance.reduce((s, x) => s + x.active, 0);
  let offset = 0;
  const segs = servicePerformance.map((s) => {
    const frac = s.active / total;
    const len = frac * C;
    const seg = { ...s, frac, dash: Math.max(0, len - GAP), offset };
    offset += len;
    return seg;
  });
  const focus = hover ? segs.find((s) => s.key === hover) : null;

  return (
    <Card className="flex flex-col">
      <CardHeader icon={PieChart} title="Service performance" subtitle="Active engagements by division" />
      <div className="flex flex-1 flex-col items-center gap-5 px-5 pb-5 sm:flex-row sm:px-6 xl:flex-col 2xl:flex-row">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Active engagements: ${segs.map((s) => `${SERVICES[s.key].label} ${s.active}`).join(", ")}`}>
            <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={STROKE} />
              {segs.map((s) => (
                <circle
                  key={s.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={COLOR[s.key]}
                  strokeWidth={hover === s.key ? STROKE + 6 : STROKE}
                  strokeDasharray={`${s.dash} ${C - s.dash}`}
                  strokeDashoffset={-s.offset}
                  opacity={hover && hover !== s.key ? 0.35 : 1}
                  onPointerEnter={() => setHover(s.key)}
                  onPointerLeave={() => setHover(null)}
                  className="cursor-pointer transition-[stroke-width,opacity] duration-150"
                />
              ))}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[30px] font-bold leading-none tracking-tight text-ink tabular-nums">{focus ? focus.active : total}</div>
              <div className="mt-1 max-w-[100px] text-[12px] leading-tight text-muted">{focus ? SERVICES[focus.key].label : "Active engagements"}</div>
            </div>
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-1">
          {segs.map((s) => (
            <li key={s.key}>
              <Link
                href={SERVICES[s.key].href}
                onPointerEnter={() => setHover(s.key)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(s.key)}
                onBlur={() => setHover(null)}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors ${hover === s.key ? "bg-surface-hover" : ""}`}
              >
                <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: COLOR[s.key] }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{SERVICES[s.key].label}</span>
                  <span className="block text-[12px] text-muted tabular-nums">
                    {s.active} active · {usd(s.revenue)} MTD
                  </span>
                </span>
                <span className="text-[14px] font-semibold text-ink tabular-nums">{Math.round(s.frac * 100)}%</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
