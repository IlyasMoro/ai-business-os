import type { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";
import { Sparkline } from "./sparkline";

export function KpiCard({
  label,
  value,
  prefix,
  suffix,
  decimals,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: LucideIcon;
  color: string;
  trend: number[];
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </p>
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
