"use client";

import { useEffect, useState } from "react";
import { VIZ } from "./colors";

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
    <li>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-300 light:text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="font-mono tabular-nums text-slate-400 light:text-slate-500">
          {count} · {Math.round(clamped)}%
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ backgroundColor: VIZ.border }}>
        <div
          className="h-2 rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </li>
  );
}
