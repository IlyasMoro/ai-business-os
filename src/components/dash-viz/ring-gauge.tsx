"use client";

import { useEffect, useState } from "react";
import { thresholdColor } from "./colors";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A single percentage as a ring, coloured by how good it is. `pct` null
 * means there is nothing to measure yet (no invoices, no projects): the
 * ring stays empty and says so, instead of faking 0% or 100%. `detail`
 * says what the percentage is made of, e.g. "3 of 4 paid".
 */
export function RingGauge({
  label,
  pct,
  detail,
  emptyText = "No data yet",
  goodIsHigh = true,
  size = 112,
  strokeWidth = 9,
}: {
  label: string;
  pct: number | null;
  detail?: string;
  emptyText?: string;
  goodIsHigh?: boolean;
  size?: number;
  strokeWidth?: number;
}) {
  const empty = pct === null || !Number.isFinite(pct);
  const clamped = empty ? 0 : Math.max(0, Math.min(100, pct));
  const color = thresholdColor(clamped, goodIsHigh);
  const radius = (size - strokeWidth) / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  const [animatedPct, setAnimatedPct] = useState(() => (prefersReducedMotion() ? clamped : 0));
  useEffect(() => {
    if (animatedPct === clamped) return;
    const raf = requestAnimationFrame(() => setAnimatedPct(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped, animatedPct]);

  const dash = (animatedPct / 100) * circumference;
  const ariaLabel = empty ? `${label}: ${emptyText}` : `${label}: ${Math.round(clamped)}%${detail ? `, ${detail}` : ""}`;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={empty ? "2 5" : undefined}
            className="stroke-white/[0.07] light:stroke-slate-900/[0.08]"
          />
          {!empty && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {empty ? (
            <span className="font-mono text-lg font-semibold text-slate-500">n/a</span>
          ) : (
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-50 light:text-slate-900">
              {Math.round(clamped)}
              <span className="text-sm text-slate-400">%</span>
            </span>
          )}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-300 light:text-slate-700">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{empty ? emptyText : detail}</p>
      </div>
    </div>
  );
}
