"use client";

import { useEffect, useState } from "react";
import { formatCompactCurrency } from "@/lib/utils";
import { sharePct } from "@/lib/chart-math";
import { VIZ } from "./colors";

/**
 * A ranked list of amounts (top categories, products, customers): rank,
 * name, value and share of the list's total, over a thin bar scaled to the
 * largest. Same look as the customer ranking on Reports.
 */
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
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ol className="space-y-3">
      {data.map((d, i) => (
        <li key={d.label} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
          <span className="font-mono text-xs tabular-nums text-slate-500">{i + 1}</span>
          <span className="truncate text-sm text-slate-100 light:text-slate-800">{d.label}</span>
          <span className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-sm text-slate-50 light:text-slate-900">{formatCompactCurrency(d.value)}</span>
            <span className="w-9 text-right text-[11px] text-slate-500">{sharePct(d.value, total)}</span>
          </span>
          <span className="col-start-2 col-end-4 block h-1.5 overflow-hidden rounded-full bg-white/[0.06] light:bg-slate-900/[0.07]">
            <span
              className="block h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: grown ? `${(d.value / max) * 100}%` : 0, backgroundColor: color, transitionDelay: `${i * 60}ms` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
