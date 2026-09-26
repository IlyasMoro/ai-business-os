"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compactNumber, fullNumber, niceMax } from "@/lib/chart-math";
import { VIZ } from "./colors";

export type GroupedBarDatum = {
  label: string;
  /** Tooltip label, e.g. "September 2026". Falls back to label. */
  longLabel?: string;
  a: number; // e.g. income, plan
  b: number; // e.g. expenses, actual
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const PAD = { top: 12, right: 8, bottom: 44, left: 44 };
const GAP = 2;

/** A bar with rounded top corners, anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function signed(value: number) {
  if (value === 0) return "±$0";
  return `${value > 0 ? "+" : "−"}${compactNumber(Math.abs(value), true)}`;
}

/**
 * Two amounts per period side by side (income and expenses, plan and
 * actual) in fixed colours, with the difference a − b under each period
 * ("Net" or "Variance"): green and signed when a is ahead, red when b is.
 * Fills its container; hover or tap a period for its figures.
 */
export function GroupedBarChart({
  data,
  aLabel,
  bLabel,
  diffLabel = "Net",
  height = 220,
}: {
  data: GroupedBarDatum[];
  aLabel: string;
  bLabel: string;
  /** Name of a − b, shown under each period. */
  diffLabel?: string;
  height?: number;
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

  const empty = data.every((d) => d.a === 0 && d.b === 0);

  const chart = useMemo(() => {
    if (width === 0 || data.length === 0) return null;
    const max = niceMax(Math.max(...data.flatMap((d) => [d.a, d.b])));
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const groupW = innerW / data.length;
    const barW = Math.max(6, Math.min(22, groupW * 0.26));
    const baseline = PAD.top + innerH;
    const y = (v: number) => baseline - (Math.max(0, v) / max) * innerH;
    const groups = data.map((d, i) => {
      const center = PAD.left + groupW * i + groupW / 2;
      return { d, center, left: PAD.left + groupW * i, ax: center - GAP / 2 - barW, bx: center + GAP / 2 };
    });
    const ticks = [0, max / 2, max].map((v) => ({ v, y: y(v) }));
    return { groups, groupW, barW, baseline, innerH, y, ticks };
  }, [data, width, height]);

  if (empty) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-xs text-slate-500 light:border-slate-300"
        style={{ height: 96 }}
      >
        No {aLabel.toLowerCase()} or {bLabel.toLowerCase()} recorded for this period yet.
      </div>
    );
  }

  const last = data.length - 1;
  const focus = active !== null && chart ? chart.groups[active] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 light:text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VIZ.blue }} />
          {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VIZ.amber }} />
          {bLabel}
        </span>
        <span className="text-slate-500">
          {diffLabel} ({aLabel.toLowerCase()} minus {bLabel.toLowerCase()}) under each month
        </span>
      </div>

      <div ref={wrapRef} className="relative w-full" style={{ height }}>
        {chart && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block"
            role="img"
            aria-label={`${aLabel} and ${bLabel} by month`}
            onPointerLeave={() => setActive(null)}
          >
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
                <text
                  x={PAD.left - 8}
                  y={t.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-slate-500 font-mono text-[10px] tabular-nums"
                >
                  {compactNumber(t.v, true)}
                </text>
              </g>
            ))}

            {chart.groups.map((g, i) => {
              const isActive = active === i;
              const isQuiet = active !== null && !isActive;
              const hasData = g.d.a > 0 || g.d.b > 0;
              const diff = g.d.a - g.d.b;
              const aH = grown ? chart.baseline - chart.y(g.d.a) : 0;
              const bH = grown ? chart.baseline - chart.y(g.d.b) : 0;
              const current = i === last;
              return (
                <g key={g.d.label + i} onPointerEnter={() => setActive(i)} onClick={() => setActive(i)}>
                  {/* Hit area for the whole month, and its highlight. */}
                  <rect
                    x={g.left + 2}
                    y={PAD.top}
                    width={chart.groupW - 4}
                    height={chart.innerH}
                    rx={6}
                    className={isActive ? "fill-white/[0.04] light:fill-slate-900/[0.04]" : "fill-transparent"}
                  />
                  {hasData ? (
                    <g opacity={isQuiet ? 0.45 : 1} style={{ transition: "opacity 0.2s ease" }}>
                      {g.d.a > 0 && (
                        <path
                          d={barPath(g.ax, chart.baseline - aH, chart.barW, aH)}
                          fill={VIZ.blue}
                          style={{ transition: `d 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 50}ms` }}
                        />
                      )}
                      {g.d.b > 0 && (
                        <path
                          d={barPath(g.bx, chart.baseline - bH, chart.barW, bH)}
                          fill={VIZ.amber}
                          style={{ transition: `d 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 50 + 60}ms` }}
                        />
                      )}
                    </g>
                  ) : (
                    // A quiet stub, so an empty month reads as zero, not missing.
                    <rect
                      x={g.ax}
                      y={chart.baseline - 2}
                      width={chart.barW * 2 + GAP}
                      height={2}
                      rx={1}
                      className="fill-white/[0.12] light:fill-slate-900/[0.12]"
                    />
                  )}
                  <text
                    x={g.center}
                    y={chart.baseline + 16}
                    textAnchor="middle"
                    className={`text-[11px] ${isActive || current ? "fill-slate-200 light:fill-slate-800" : "fill-slate-500"}`}
                  >
                    {g.d.label}
                  </text>
                  {hasData && (
                    <text
                      x={g.center}
                      y={chart.baseline + 32}
                      textAnchor="middle"
                      className={`font-mono text-[10px] font-medium tabular-nums ${
                        diff > 0
                          ? "fill-emerald-400 light:fill-emerald-700"
                          : diff < 0
                            ? "fill-red-400 light:fill-red-700"
                            : "fill-slate-500"
                      }`}
                    >
                      {signed(diff)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {chart && focus && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-white/10 px-3 py-2 text-xs shadow-lg glass-strong light:border-white/80"
            // Beside the month, never over its bars: left of it on the right
            // half of the chart, right of it otherwise.
            style={
              focus.center > width / 2
                ? { right: width - (focus.left + 4), top: PAD.top }
                : { left: focus.left + chart.groupW - 4, top: PAD.top }
            }
          >
            <p className="mb-1 text-[11px] text-slate-400 light:text-slate-500">{focus.d.longLabel ?? focus.d.label}</p>
            <p className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300 light:text-slate-700">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: VIZ.blue }} />
                {aLabel}
              </span>
              <span className="font-mono tabular-nums text-slate-50 light:text-slate-900">{fullNumber(focus.d.a, true)}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300 light:text-slate-700">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: VIZ.amber }} />
                {bLabel}
              </span>
              <span className="font-mono tabular-nums text-slate-50 light:text-slate-900">{fullNumber(focus.d.b, true)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between gap-4 border-t border-white/10 pt-1 light:border-slate-200">
              <span className="text-slate-400 light:text-slate-500">{diffLabel}</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  focus.d.a - focus.d.b >= 0 ? "text-emerald-400 light:text-emerald-700" : "text-red-400 light:text-red-700"
                }`}
              >
                {focus.d.a - focus.d.b >= 0 ? "+" : "−"}
                {fullNumber(Math.abs(focus.d.a - focus.d.b), true)}
              </span>
            </p>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>{`${aLabel} and ${bLabel} by month`}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">{aLabel}</th>
            <th scope="col">{bLabel}</th>
            <th scope="col">{diffLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.longLabel ?? d.label}</th>
              <td>{fullNumber(d.a, true)}</td>
              <td>{fullNumber(d.b, true)}</td>
              <td>{fullNumber(d.a - d.b, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
