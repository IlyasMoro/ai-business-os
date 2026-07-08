"use client";

import { useEffect, useState } from "react";
import { formatCompactCurrency } from "@/lib/utils";
import { VIZ } from "./colors";

export type GroupedBarDatum = {
  label: string;
  a: number; // e.g. income
  b: number; // e.g. expense
};

export function GroupedBarChart({
  data,
  aLabel,
  bLabel,
  height = 160,
}: {
  data: GroupedBarDatum[];
  aLabel: string;
  bLabel: string;
  height?: number;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VIZ.blue }} />
          {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VIZ.amber }} />
          {bLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VIZ.red }} />
          {bLabel} over {aLabel}
        </span>
      </div>
      <div className="flex items-end gap-4" style={{ height }}>
        {data.map((d) => {
          const over = d.b > d.a;
          const aH = (d.a / max) * (height - 24);
          const bH = (d.b / max) * (height - 24);
          return (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-full items-end gap-1">
                <div className="group relative flex flex-col items-center justify-end">
                  {d.a > 0 && (
                    <span className="mb-1 font-mono text-[10px] tabular-nums text-slate-500">
                      {formatCompactCurrency(d.a)}
                    </span>
                  )}
                  <div
                    className="w-4 rounded-t transition-[height] duration-700 ease-out"
                    style={{ height: grown ? aH : 0, backgroundColor: VIZ.blue }}
                  />
                </div>
                <div className="group relative flex flex-col items-center justify-end">
                  {d.b > 0 && (
                    <span className="mb-1 font-mono text-[10px] tabular-nums text-slate-500">
                      {formatCompactCurrency(d.b)}
                    </span>
                  )}
                  <div
                    className="w-4 rounded-t transition-[height] duration-700 ease-out"
                    style={{ height: grown ? bH : 0, backgroundColor: over ? VIZ.red : VIZ.amber }}
                  />
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-500">{d.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
