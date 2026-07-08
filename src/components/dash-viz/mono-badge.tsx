import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { VIZ } from "./colors";

export function MonoTrendBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  const color = positive ? VIZ.emerald : VIZ.red;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs tabular-nums"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}1a`, color }}
    >
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}
