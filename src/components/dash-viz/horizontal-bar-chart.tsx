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
  /** `color` on a row overrides the chart colour for that bar, e.g. to
   * match each branch's card. */
  data: { label: string; value: number; color?: string }[];
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
          <span className="text-xs tabular-nums text-slate-500">{i + 1}</span>
          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-100 light:text-slate-800">
            {d.color && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />}
            <span className="truncate">{d.label}</span>
          </span>
          <span className="flex items-baseline gap-2 tabular-nums">
            <span className="text-sm text-slate-50 light:text-slate-900">{formatCompactCurrency(d.value)}</span>
            <span className="w-9 text-right text-xs text-slate-500">{sharePct(d.value, total)}</span>
          </span>
          <span className="col-start-2 col-end-4 block h-1.5 overflow-hidden rounded-full bg-white/[0.06] light:bg-slate-900/[0.07]">
            <span
              className="block h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: grown ? `${(d.value / max) * 100}%` : 0, backgroundColor: d.color ?? color, transitionDelay: `${i * 60}ms` }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
