"use client";

import { useEffect, useState } from "react";

/**
 * One share row: swatch, label, count and percentage over a thin bar.
 * Matches the donut legend; the track follows the theme.
 */
export function AllocationBar({
  label,
  count,
  pct,
  color,
}: {
  label: string;
  count: number;
  pct: number;
  color: string;
}) {
  const [width, setWidth] = useState(0);
  const clamped = Math.max(0, Math.min(100, pct));

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  return (
    <li className={count === 0 ? "opacity-45" : undefined}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-center gap-2 text-slate-300 light:text-slate-700">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
          <span className="truncate">{label}</span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2 font-mono tabular-nums">
          <span className="text-slate-200 light:text-slate-800">{count.toLocaleString()}</span>
          <span className="w-9 text-right text-[11px] text-slate-500">{Math.round(clamped)}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/[0.06] light:bg-slate-900/[0.07]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </li>
  );
}
