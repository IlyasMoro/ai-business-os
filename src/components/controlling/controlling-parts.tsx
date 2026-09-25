import Link from "next/link";
import { StatusBadge } from "@/components/ui-dark/badge";
import { VIZ } from "@/components/dash-viz/colors";
import { fiscalYearLabel, fiscalYearMonths, monthLabel, periodKey, type VarianceStatus } from "@/lib/controlling-math";

const TABS = [
  { href: "/dashboard/controlling", label: "Overview" },
  { href: "/dashboard/controlling/cost-centers", label: "Cost centers" },
  { href: "/dashboard/controlling/orders", label: "Internal orders" },
  { href: "/dashboard/controlling/allocations", label: "Allocations" },
  { href: "/dashboard/controlling/profitability", label: "Profitability" },
  { href: "/dashboard/controlling/settings", label: "Settings" },
];

export function ControllingTabs({ active }: { active: string }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-1 border-b border-white/[0.06] light:border-slate-200">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
            active === t.href
              ? "border-blue-500 font-medium text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

const statusColor: Record<VarianceStatus, string> = {
  UNDER: VIZ.emerald,
  NEAR: VIZ.amber,
  OVER: VIZ.red,
  NO_PLAN: VIZ.muted,
};
const statusText: Record<VarianceStatus, string> = {
  UNDER: "ON_TRACK",
  NEAR: "NEAR_LIMIT",
  OVER: "OVER_BUDGET",
  NO_PLAN: "NO_PLAN",
};

export function VarianceBadge({ status }: { status: VarianceStatus }) {
  return <StatusBadge status={statusText[status]} color={statusColor[status]} />;
}

/** Thin bar of budget used, capped visually at 100% with the overflow in red. */
export function UsageBar({ used, status }: { used: number | null; status: VarianceStatus }) {
  const pct = used === null ? 0 : Math.min(100, Math.round(used * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10 light:bg-slate-200">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: statusColor[status] }} />
      </div>
      <span className="w-12 text-right font-mono text-xs tabular-nums text-slate-400">{used === null ? "" : `${Math.round(used * 100)}%`}</span>
    </div>
  );
}

/** GET form picking a fiscal year and optionally one month of it. */
export function PeriodPicker({
  action,
  fiscalYear,
  month,
  startMonth,
  years,
}: {
  action: string;
  fiscalYear: number;
  month: string | null;
  startMonth: number;
  years: number[];
}) {
  const cls =
    "rounded-md border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white px-3 py-2 text-sm text-slate-50 light:text-slate-900";
  return (
    <form method="GET" action={action} className="flex flex-wrap items-center gap-2">
      <select name="fy" defaultValue={fiscalYear} className={cls} aria-label="Fiscal year">
        {years.map((y) => (
          <option key={y} value={y}>
            {fiscalYearLabel(y, startMonth)}
          </option>
        ))}
      </select>
      <select name="m" defaultValue={month ?? ""} className={cls} aria-label="Month">
        <option value="">Whole year</option>
        {fiscalYearMonths(fiscalYear, startMonth).map((p) => (
          <option key={periodKey(p)} value={periodKey(p)}>
            {monthLabel(p)}
          </option>
        ))}
      </select>
      <button type="submit" className={`${cls} hover:bg-white/5`}>
        Show
      </button>
    </form>
  );
}

export const money = (n: number) =>
  `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Percentages with a true minus sign, never a hyphen. */
export const percent = (n: number) => `${n < 0 ? "\u2212" : ""}${Math.abs(n)}%`;
