"use client";

import { useEffect, useState } from "react";
import { formatCompactCurrency } from "@/lib/utils";
import { VIZ } from "./colors";

export function HorizontalBarChart({
  data,
  color = VIZ.blue,
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="truncate text-slate-300">{d.label}</span>
            <span className="ml-2 shrink-0 font-mono tabular-nums text-slate-400">{formatCompactCurrency(d.value)}</span>
          </div>
          <div className="h-2 rounded-full" style={{ backgroundColor: VIZ.border }}>
            <div
              className="h-2 rounded-full transition-[width] duration-700 ease-out"
              style={{ width: grown ? `${(d.value / max) * 100}%` : 0, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
