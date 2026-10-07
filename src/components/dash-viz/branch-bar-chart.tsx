"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compactNumber, fullNumber, niceMax } from "@/lib/chart-math";

export type BranchSeries = { id: string; name: string; color: string; values: number[] };

// Top padding leaves room for the share labels above the tallest bars.
const PAD = { top: 22, right: 8, bottom: 32, left: 52 };
/** Narrowest bar that still fits its "28%" label. */
const LABEL_MIN_BAR = 19;
/** Surface gap between neighbouring bars in a month. */
const GAP = 2;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A bar with 4px rounded top corners, anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

/**
 * Revenue per month for every branch side by side: months along the x
 * axis, rand up the y axis, one bar per branch in its own colour. A
 * legend names the branches; hover or tap a month to read every branch's
 * figure, highest first.
 */
export function BranchBarChart({
  months,
  series,
  height = 280,
  partialLast = false,
}: {
  /** Short and long label per month, oldest first. */
  months: { label: string; longLabel: string }[];
  series: BranchSeries[];
  height?: number;
  /** The last month is still running: its label says "so far". */
  partialLast?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [grown, setGrown] = useState(() => prefersReducedMotion());

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (grown || width === 0) return;
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, [grown, width]);

  const chart = useMemo(() => {
    if (width === 0 || months.length === 0 || series.length === 0) return null;
    const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const groupW = innerW / months.length;
    // Bars fill about 80% of each month, never wider than 32px each.
    const barW = Math.max(4, Math.min(32, (groupW * 0.8 - GAP * (series.length - 1)) / series.length));
    const clusterW = barW * series.length + GAP * (series.length - 1);
    const baseline = PAD.top + innerH;
    const y = (v: number) => baseline - (Math.max(0, v) / max) * innerH;
    // Round steps (R 5k, R 10k...): the first split of the top value whose
    // step starts with 1, 2 or 5.
    const parts = [5, 4, 2].find((n) => {
      const step = max / n;
      const lead = step / 10 ** Math.floor(Math.log10(step));
      return [1, 2, 5].some((l) => Math.abs(lead - l) < 1e-9);
    }) ?? 2;
    const ticks = Array.from({ length: parts + 1 }, (_, k) => (max * k) / parts).map((v) => ({ v, y: y(v) }));
    // Each month's total, for every bar's share of it.
    const totals = months.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
    return { max, innerH, groupW, barW, clusterW, baseline, y, ticks, totals };
  }, [months, series, width, height]);

  const empty = series.every((s) => s.values.every((v) => v === 0));
  if (empty) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-xs text-slate-500 light:border-slate-300">
        No revenue recorded for these months yet.
      </div>
    );
  }

  const tip =
    active !== null
      ? series
          .map((s) => ({ name: s.name, color: s.color, value: s.values[active] ?? 0 }))
          .sort((a, b) => b.value - a.value)
      : null;
  const tipTotal = tip?.reduce((s, r) => s + r.value, 0) ?? 0;
  const tipLeft = chart && active !== null ? PAD.left + chart.groupW * active + chart.groupW / 2 : 0;
  const monthName = (i: number) => (partialLast && i === months.length - 1 ? `${months[i].longLabel}, so far` : months[i].longLabel);

  return (
    <div>
      {/* Legend: every branch named, so colour is never the only key. */}
      <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300 light:text-slate-600">
        {series.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>

      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        {chart && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block"
            role="img"
            aria-label={`Revenue by month for ${series.map((s) => s.name).join(", ")}`}
            onPointerLeave={() => setActive(null)}
          >
            {/* Y axis: recessive gridlines with rand labels. */}
            {chart.ticks.map((t) => (
              <g key={t.v}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={t.y}
                  y2={t.y}
                  className="stroke-white/[0.07] light:stroke-slate-900/[0.08]"
                  strokeDasharray={t.v === 0 ? undefined : "3 4"}
                />
                <text x={PAD.left - 8} y={t.y} textAnchor="end" dominantBaseline="middle" className="fill-slate-400 text-[11px] tabular-nums light:fill-slate-500">
                  {compactNumber(t.v, true)}
                </text>
              </g>
            ))}

            {months.map((m, i) => {
              const left = PAD.left + chart.groupW * i;
              const start = left + (chart.groupW - chart.clusterW) / 2;
              const isQuiet = active !== null && active !== i;
              return (
                <g key={m.longLabel} onPointerEnter={() => setActive(i)} onClick={() => setActive(i)}>
                  {/* Hit area for the whole month, bigger than the bars. */}
                  <rect
                    x={left + 2}
                    y={PAD.top}
                    width={chart.groupW - 4}
                    height={chart.innerH}
                    rx={6}
                    className={active === i ? "fill-white/[0.04] light:fill-slate-900/[0.04]" : "fill-transparent"}
                  />
                  <g opacity={isQuiet ? 0.4 : 1} style={{ transition: "opacity 0.2s ease" }}>
                    {series.map((s, si) => {
                      const v = s.values[i] ?? 0;
                      const h = grown ? chart.baseline - chart.y(v) : 0;
                      if (v <= 0) return null;
                      const x = start + si * (chart.barW + GAP);
                      // Share of the month's revenue, above every bar when the
                      // bars are wide enough, else only for the month in focus.
                      const showLabel = chart.totals[i] > 0 && (chart.barW >= LABEL_MIN_BAR || active === i);
                      return (
                        <g key={s.id}>
                          <path
                            d={barPath(x, chart.baseline - h, chart.barW, h)}
                            fill={s.color}
                            style={{ transition: `d 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 40 + si * 30}ms` }}
                          />
                          {showLabel && (
                            <text
                              x={x + chart.barW / 2}
                              y={chart.y(v) - 5}
                              textAnchor="middle"
                              className="fill-slate-300 text-[11px] font-medium tabular-nums light:fill-slate-600"
                              style={{ opacity: grown ? 1 : 0, transition: `opacity 0.4s ease ${0.5 + i * 0.04}s` }}
                            >
                              {Math.round((v / chart.totals[i]) * 100)}%
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                  {/* X axis: the month, marked when it is still running. */}
                  <text
                    x={left + chart.groupW / 2}
                    y={chart.baseline + 18}
                    textAnchor="middle"
                    className={active === i ? "fill-slate-100 text-[11px] font-medium light:fill-slate-900" : "fill-slate-400 text-[11px] light:fill-slate-500"}
                  >
                    {m.label}
                    {partialLast && i === months.length - 1 ? " so far" : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {chart && tip && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-52 rounded-lg border border-white/10 bg-slate-950/95 p-3 text-xs shadow-xl light:border-slate-200 light:bg-white"
            style={{
              left: Math.min(Math.max(tipLeft - 104, 0), Math.max(0, width - 208)),
            }}
          >
            <p className="mb-2 font-medium text-slate-100 light:text-slate-900">{monthName(active)}</p>
            <ul className="space-y-1">
              {tip.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-300 light:text-slate-600">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="tabular-nums text-slate-100 light:text-slate-900">{fullNumber(r.value, true)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between border-t border-white/10 pt-2 text-slate-400 light:border-slate-200 light:text-slate-500">
              <span>All branches</span>
              <span className="tabular-nums">{fullNumber(tipTotal, true)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
