"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fullNumber } from "@/lib/chart-math";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Small line and area chart for a KPI card. Fills its container's width and
 * works like the trend chart on Reports: hover (or focus and use the arrow
 * keys) to read a month, with a crosshair, a dot per month and a tooltip
 * showing the month and the formatted value.
 */
export function Sparkline({
  data,
  color,
  height = 36,
  labels,
  currency = false,
  title = "Trend",
}: {
  data: number[];
  color: string;
  height?: number;
  /** One label per point, e.g. "Sep 2026", shown in the tooltip. */
  labels?: string[];
  currency?: boolean;
  /** Names the series for screen readers. */
  title?: string;
}) {
  const gradientId = useId();
  const glowId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(() => prefersReducedMotion());

  // Measure the card so the line spans it at any width, without the
  // stretched strokes a scaled viewBox would give.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Draw the line in once the width is known.
  useEffect(() => {
    if (drawn || width === 0) return;
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [drawn, width]);

  const { points, linePath, areaPath, stepX } = useMemo(() => {
    if (data.length === 0 || width === 0) {
      return { points: [] as (readonly [number, number])[], linePath: "", areaPath: "", stepX: 0 };
    }
    const max = Math.max(...data, 0.0001);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    // Keep the end dots inside the card.
    const inset = 4;
    const stepX = (width - inset * 2) / Math.max(1, data.length - 1);

    const points = data.map((v, i) => {
      const x = inset + i * stepX;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return [x, y] as const;
    });

    const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;
    return { points, linePath, areaPath, stepX };
  }, [data, width, height]);

  const lastIndex = points.length - 1;
  const activeIndex = hoverIndex ?? lastIndex;
  const active = points[activeIndex];

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    if (stepX === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nearest = Math.round((e.clientX - rect.left - 4) / stepX);
    setHoverIndex(Math.max(0, Math.min(lastIndex, nearest)));
  }

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const from = hoverIndex ?? lastIndex;
    setHoverIndex(Math.max(0, Math.min(lastIndex, from + (e.key === "ArrowRight" ? 1 : -1))));
  }

  // Keep the tooltip inside the card: pin it left or right near the edges.
  const align = !active ? "center" : active[0] < width / 3 ? "left" : active[0] > (width * 2) / 3 ? "right" : "center";
  // Whole numbers, "$1,250" or "-$80" for money: cents add nothing at a glance.
  const format = (v: number) => {
    const whole = Math.round(v);
    return currency ? `${whole < 0 ? "-" : ""}$${fullNumber(Math.abs(whole))}` : fullNumber(whole);
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
      style={{ height }}
      tabIndex={0}
      aria-label={`${title}. Use the arrow keys to read each month.`}
      onKeyDown={handleKey}
      onBlur={() => setHoverIndex(null)}
    >
      {active && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
          aria-hidden
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.38} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d={areaPath}
            fill={`url(#${gradientId})`}
            style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.5s ease 0.3s" }}
          />

          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={drawn ? 0 : 1}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />

          {hoverIndex !== null && (
            <>
              <line x1={active[0]} y1={0} x2={active[0]} y2={height} stroke={color} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 2" />
              {/* A faint dot on every month while reading the line. */}
              {points.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={2} fill={color} fillOpacity={i === hoverIndex ? 0 : 0.45} />
              ))}
            </>
          )}

          <circle
            cx={active[0]}
            cy={active[1]}
            r={hoverIndex !== null ? 4 : 3}
            fill={color}
            className="stroke-slate-950 light:stroke-white"
            strokeWidth={2}
            filter={hoverIndex !== null ? `url(#${glowId})` : undefined}
            style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.3s ease 0.7s" }}
          />
        </svg>
      )}

      {hoverIndex !== null && active && (
        <div
          className={`pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md border border-white/10 light:border-white/80 glass-strong px-2 py-1 text-xs shadow-lg ${
            align === "left" ? "left-0" : align === "right" ? "right-0" : "-translate-x-1/2"
          }`}
          style={align === "center" ? { left: active[0] } : undefined}
        >
          {labels?.[hoverIndex] && <span className="mr-1.5 text-slate-400 light:text-slate-500">{labels[hoverIndex]}</span>}
          <span className="font-mono tabular-nums text-slate-50 light:text-slate-900">{format(data[hoverIndex])}</span>
        </div>
      )}

      {/* The same numbers for screen readers. */}
      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <tbody>
          {data.map((v, i) => (
            <tr key={i}>
              <th scope="row">{labels?.[i] ?? `Point ${i + 1}`}</th>
              <td>{format(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
