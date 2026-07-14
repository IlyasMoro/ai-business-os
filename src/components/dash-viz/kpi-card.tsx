import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";
import { Sparkline } from "./sparkline";

export type KpiChange = {
  /** Percentage change vs the previous period. Null when the previous
   * period was zero, so a percentage would be meaningless (shown as
   * "New" instead). */
  pct: number | null;
  /** Whether an increase is good news for this particular metric — for
   * most metrics it is, but for something like "Outstanding invoices"
   * a rise is bad, so the badge color should invert. */
  goodIsUp?: boolean;
  label: string;
};

export function KpiCard({
  label,
  value,
  prefix,
  suffix,
  decimals,
  icon: Icon,
  color,
  trend,
  change,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: LucideIcon;
  color: string;
  trend: number[];
  change?: KpiChange;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 light:text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-50 light:text-slate-900">
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </p>
          {change && <ChangeBadge change={change} />}
        </div>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {trend.length > 1 && (
        <div className="mt-4">
          <Sparkline data={trend} color={color} width={200} height={36} />
        </div>
      )}
    </div>
  );
}

function ChangeBadge({ change }: { change: KpiChange }) {
  const { pct, label, goodIsUp = true } = change;

  if (pct === null) {
    return <p className="mt-1 text-xs text-slate-500">New this period</p>;
  }

  const isUp = pct >= 0;
  const isGood = isUp === goodIsUp;
  const Arrow = isUp ? ArrowUp : ArrowDown;

  return (
    <p
      className={`mt-1 flex items-center gap-1 text-xs ${isGood ? "text-emerald-400" : "text-red-400"}`}
    >
      <Arrow className="h-3 w-3" />
      {Math.abs(pct).toFixed(0)}% {label}
    </p>
  );
}
