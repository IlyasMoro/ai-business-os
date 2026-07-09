"use client";

import { useEffect, useState } from "react";
import { VIZ } from "./colors";

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const [width, setWidth] = useState(0);
  const clamped = Math.max(0, Math.min(100, pct));

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400 light:text-slate-500">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-slate-300 light:text-slate-600">{Math.round(clamped)}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ backgroundColor: VIZ.border }}>
        <div
          className="h-1.5 rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function DualProgressBar({
  completionPct,
  secondaryPct,
  secondaryLabel = "Timeline",
  secondaryCritical = false,
}: {
  completionPct: number;
  secondaryPct: number;
  secondaryLabel?: string;
  secondaryCritical?: boolean;
}) {
  return (
    <div className="flex w-full max-w-56 flex-col gap-2">
      <Bar label="Completion" pct={completionPct} color={VIZ.amber} />
      <Bar label={secondaryLabel} pct={secondaryPct} color={secondaryCritical ? VIZ.red : VIZ.blue} />
    </div>
  );
}
