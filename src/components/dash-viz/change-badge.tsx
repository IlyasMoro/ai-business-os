import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { periodChange } from "@/lib/chart-math";

/**
 * "+50% vs last month" beside a headline number. Direction is carried by
 * an arrow and a sign, not colour alone. `goodIsUp` flips the colours for
 * figures where a fall is good news (costs).
 */
export function ChangeBadge({
  values,
  period = "last month",
  goodIsUp = true,
}: {
  values: number[];
  period?: string;
  goodIsUp?: boolean;
}) {
  const change = periodChange(values);
  if (change.kind === "none") return null;

  const base = "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums";
  if (change.kind === "from-zero") {
    return (
      <span className={`${base} border-white/10 text-slate-300 light:border-slate-300 light:text-slate-600`}>
        <ArrowUpRight className="h-3 w-3" />
        up from zero vs {period}
      </span>
    );
  }

  const good = change.direction === "flat" ? null : (change.direction === "up") === goodIsUp;
  const tone =
    good === null
      ? "border-white/10 text-slate-300 light:border-slate-300 light:text-slate-600"
      : good
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 light:text-emerald-700"
        : "border-red-500/30 bg-red-500/10 text-red-300 light:text-red-700";
  const Icon = change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span className={`${base} ${tone}`}>
      <Icon className="h-3 w-3" />
      {change.pct > 0 ? "+" : ""}
      {change.pct}% vs {period}
    </span>
  );
}
