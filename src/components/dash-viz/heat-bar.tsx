"use client";

import { useEffect, useState } from "react";
import { VIZ } from "./colors";

export function HeatBar({
  label,
  deltaPct,
  maxAbsPct = 50,
}: {
  label: string;
  deltaPct: number;
  maxAbsPct?: number;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const clamped = Math.max(-maxAbsPct, Math.min(maxAbsPct, deltaPct));
  const pctOfHalf = (Math.abs(clamped) / maxAbsPct) * 50;
  const positive = clamped >= 0;
  const color = positive ? VIZ.emerald : VIZ.red;

  return (
    <li className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-sm text-slate-300 light:text-slate-600">{label}</span>
      <div className="relative h-3 flex-1 rounded-full" style={{ backgroundColor: VIZ.border }}>
        <span
          aria-hidden
          className="absolute top-0 h-full w-px bg-slate-600"
          style={{ left: "50%" }}
        />
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-700 ease-out"
          style={{
            backgroundColor: color,
            left: positive ? "50%" : `${50 - (grown ? pctOfHalf : 0)}%`,
            width: grown ? `${pctOfHalf}%` : 0,
          }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums" style={{ color }}>
        {positive ? "+" : ""}
        {clamped.toFixed(1)}%
      </span>
    </li>
  );
}
