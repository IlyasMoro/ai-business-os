"use client";

import { useEffect, useId, useState } from "react";
import { VIZ, thresholdColor } from "./colors";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function RingGauge({
  label,
  pct,
  goodIsHigh = true,
  size = 120,
  strokeWidth = 10,
}: {
  label: string;
  pct: number;
  goodIsHigh?: boolean;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = thresholdColor(clamped, goodIsHigh);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const [animatedPct, setAnimatedPct] = useState(() => (prefersReducedMotion() ? clamped : 0));
  const filterId = useId();

  useEffect(() => {
    if (animatedPct === clamped) return;
    const raf = requestAnimationFrame(() => setAnimatedPct(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped, animatedPct]);

  const offset = circumference - (animatedPct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={VIZ.border}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            filter={`url(#${filterId})`}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-2xl font-semibold tabular-nums text-white">
            {Math.round(clamped)}%
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">{label}</p>
    </div>
  );
}
