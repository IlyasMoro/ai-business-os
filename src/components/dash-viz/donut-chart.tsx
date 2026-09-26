"use client";

import { useEffect, useId, useState } from "react";

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DonutChart({
  title,
  centerValue,
  centerLabel,
  slices,
  size = 160,
  strokeWidth = 22,
}: {
  title: string;
  centerValue: string;
  centerLabel: string;
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const filterId = useId();
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Sequential draw in on mount: each arc grows from 0 to its share, one
  // after another, same transition based technique RingGauge uses rather
  // than a new one, staggered per slice so the composition visibly builds
  // instead of just appearing.
  const [drawn, setDrawn] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (drawn) return;
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arcs = slices.reduce<{ slice: DonutSlice; fraction: number; offset: number; cumulative: number }[]>(
    (acc, slice) => {
      const cumulative = acc.length > 0 ? acc[acc.length - 1].cumulative + acc[acc.length - 1].fraction : 0;
      const fraction = slice.value / total;
      acc.push({ slice, fraction, offset: -cumulative * circumference, cumulative });
      return acc;
    },
    []
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Faint track under the arcs, so an all zero chart still reads as
              an empty ring instead of a blank box. */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-white/[0.06] light:stroke-slate-900/[0.06]"
          />
          {arcs.map(({ slice, fraction, offset }, i) => {
            const targetDash = fraction * circumference;
            const dash = drawn ? targetDash : 0;
            const gap = circumference - dash;
            const isHovered = hovered === i;
            return (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                filter={isHovered ? `url(#${filterId})` : undefined}
                opacity={hovered === null || isHovered ? 1 : 0.45}
                style={{
                  transition: `stroke-dasharray 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 90}ms, stroke-width 0.2s ease, opacity 0.2s ease`,
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{`${slice.label}: ${slice.value.toLocaleString()} (${Math.round(fraction * 100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-semibold tabular-nums text-slate-50 light:text-slate-900">{centerValue}</span>
          <span className="text-[11px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <div className="w-full">
        <p className="mb-2 text-center text-xs font-medium text-slate-400 light:text-slate-500">{title}</p>
        <ul className="space-y-1.5">
          {slices.map((slice, i) => (
            <li
              key={slice.label}
              className="flex items-center justify-between text-xs"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="flex items-center gap-1.5 text-slate-300 light:text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
                {slice.label}
              </span>
              <span className="font-mono tabular-nums text-slate-500">{slice.value.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
