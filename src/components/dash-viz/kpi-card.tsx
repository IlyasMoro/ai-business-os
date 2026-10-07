import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";
import { Sparkline } from "./sparkline";
import { SpotlightCard } from "./spotlight-card";
import { CURRENCY_PREFIX } from "@/lib/utils";

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
  trend = [],
  trendLabels,
  change,
  progress,
  hint,
  href,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: LucideIcon;
  color: string;
  /** Money over time: drawn as a sparkline. Leave out for counts. */
  trend?: number[];
  /** Month names for the sparkline tooltip, one per trend point. */
  trendLabels?: string[];
  change?: KpiChange;
  /** Part of a goal or limit (budget used, invoices collected): a thin bar
   * in the tile's colour with a short label. */
  progress?: { pct: number; label: string };
  /** One short line under the number, e.g. "3 need a reorder". */
  hint?: string;
  /** Makes the whole tile a link to the list behind the number. */
  href?: string;
}) {
  const tile = (
    <SpotlightCard color={color} className="h-full rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
      {/* Thin lit strip along the top edge in the card's accent colour. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 light:text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-50 light:text-slate-900">
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </p>
          {change && <ChangeBadge change={change} />}
          {hint && <p className="mt-1 text-xs text-slate-400 light:text-slate-500">{hint}</p>}
        </div>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1a`, color, boxShadow: `0 0 18px -4px ${color}66` }}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {/* No line for a series that is all zero: it would only draw the floor. */}
      {trend.length > 1 && trend.some((v) => v !== 0) && (
        <div className="mt-4">
          <Sparkline data={trend} color={color} labels={trendLabels} currency={prefix === CURRENCY_PREFIX} title={`${label} by month`} />
        </div>
      )}
      {progress && (
        <div className="mt-4">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/[0.07] light:bg-slate-200"
            role="progressbar"
            aria-valuenow={Math.round(progress.pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progress.label}
          >
            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%`, backgroundColor: color }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 light:text-slate-500">{progress.label}</p>
        </div>
      )}
    </SpotlightCard>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&>div]:h-full">
      {tile}
    </Link>
  ) : (
    tile
  );
}

function ChangeBadge({ change }: { change: KpiChange }) {
  const { pct, label, goodIsUp = true } = change;

  if (pct === null) {
    return <p className="mt-1 text-xs text-slate-500">New this period</p>;
  }
  // Rounded to 0%: nothing moved, so no arrow and no good or bad colour.
  if (Math.round(pct) === 0) {
    return <p className="mt-1 text-xs text-slate-500">Same as last month</p>;
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
