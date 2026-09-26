"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { compactNumber, fullNumber, niceMax } from "@/lib/chart-math";

export type TrendPoint = {
  /** Axis label, e.g. "Sep". */
  label: string;
  /** Tooltip and table label, e.g. "Sep 2026". Falls back to label. */
  longLabel?: string;
  value: number;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const PAD = { top: 10, right: 10, bottom: 22, left: 40 };

/**
 * Full width line and area chart for a short series (months, runs). Fills
 * its container, with a recessive axis, month labels, a dot per point and a
 * crosshair tooltip. Also renders a screen reader table of the same data.
 */
export function TrendChart({
  data,
  color,
  currency = false,
  height = 150,
  title,
}: {
  data: TrendPoint[];
  color: string;
  currency?: boolean;
  height?: number;
  /** Names the series for screen readers, e.g. "Order value by month". */
  title: string;
}) {
  const gradientId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(() => prefersReducedMotion());

  // Measure the container so the chart fills it at any card width, without
  // stretching strokes and dots the way a scaled viewBox would.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (drawn || width === 0) return;
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [drawn, width]);

  const chart = useMemo(() => {
    if (width === 0 || data.length === 0) return null;
    const max = niceMax(Math.max(...data.map((d) => d.value)));
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const x = (i: number) => PAD.left + (data.length > 1 ? i * stepX : innerW / 2);
    const y = (v: number) => PAD.top + innerH - (Math.max(0, v) / max) * innerH;
    const points = data.map((d, i) => [x(i), y(d.value)] as const);
    const line = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    const baseline = PAD.top + innerH;
    const area = `${line} L${points[points.length - 1][0].toFixed(1)},${baseline} L${points[0][0].toFixed(1)},${baseline} Z`;
    const ticks = [0, max / 2, max].map((v) => ({ v, y: y(v) }));
    return { points, line, area, ticks, stepX, baseline };
  }, [data, width, height]);

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left - PAD.left;
    const i = chart.stepX > 0 ? Math.round(relX / chart.stepX) : 0;
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  const last = data.length - 1;
  const active = hover ?? null;

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      {chart && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block touch-none"
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Recessive grid: three hairlines with compact labels. */}
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
                {compactNumber(t.v, currency)}
              </text>
            </g>
          ))}

          {data.map((d, i) => (
            <text
              key={d.label + i}
              x={chart.points[i][0]}
              y={height - 6}
              textAnchor={i === 0 && data.length > 1 ? "start" : i === last && data.length > 1 ? "end" : "middle"}
              className={`text-[10px] ${i === active || (active === null && i === last) ? "fill-slate-300 light:fill-slate-700" : "fill-slate-500"}`}
            >
              {d.label}
            </text>
          ))}

          <path
            d={chart.area}
            fill={`url(#${gradientId})`}
            style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.6s ease 0.3s" }}
          />
          <path
            d={chart.line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={drawn ? 0 : 1}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />

          {active !== null && (
            <line
              x1={chart.points[active][0]}
              x2={chart.points[active][0]}
              y1={PAD.top}
              y2={chart.baseline}
              stroke={color}
              strokeOpacity={0.35}
              strokeDasharray="3 3"
            />
          )}

          {/* A dot per point, ringed in the surface colour so it reads over
              the line; the latest (or hovered) point is larger. */}
          {chart.points.map(([px, py], i) => {
            const big = i === active || (active === null && i === last);
            return (
              <circle
                key={i}
                cx={px}
                cy={py}
                r={big ? 5 : 3.5}
                fill={color}
                strokeWidth={2}
                className="stroke-slate-950 light:stroke-white"
                style={{ opacity: drawn ? 1 : 0, transition: `opacity 0.3s ease ${0.5 + i * 0.05}s` }}
              />
            );
          })}
        </svg>
      )}

      {chart && active !== null && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-white/10 px-2.5 py-1.5 text-xs shadow-lg glass-strong light:border-white/80"
          style={{
            left: Math.min(Math.max(chart.points[active][0], 60), width - 60),
            top: chart.points[active][1] - 10,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-[11px] text-slate-400 light:text-slate-500">{data[active].longLabel ?? data[active].label}</p>
          <p className="font-mono font-semibold tabular-nums text-slate-50 light:text-slate-900">
            {fullNumber(data[active].value, currency)}
          </p>
        </div>
      )}

      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.longLabel ?? d.label}</th>
              <td>{fullNumber(d.value, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
