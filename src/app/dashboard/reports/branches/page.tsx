import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, ArrowDown, ArrowUp, Lightbulb, Store, TrendingDown, TrendingUp, Trophy, Wallet, Percent } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { getBranchPerformance, PERIOD_DAYS, EXPIRING_DAYS } from "@/lib/branch-performance-data";
import type { Insight, ScoredBranch } from "@/lib/branch-performance";
import { KpiCard } from "@/components/dash-viz/kpi-card";
import { BranchBarChart } from "@/components/dash-viz/branch-bar-chart";
import { HorizontalBarChart } from "@/components/dash-viz/horizontal-bar-chart";
import { VIZ } from "@/components/dash-viz/colors";
import { Badge } from "@/components/ui-dark/badge";
import { BackButton } from "@/components/ui-dark/back-button";
import { cn, formatCurrency, CURRENCY_PREFIX } from "@/lib/utils";

export const metadata = { title: "Branch performance" };

const SORTS = {
  score: { label: "Score", value: (b: ScoredBranch) => b.score },
  revenue: { label: "Revenue", value: (b: ScoredBranch) => b.revenue },
  growth: { label: "Growth", value: (b: ScoredBranch) => b.growthPct ?? -Infinity },
  margin: { label: "Margin", value: (b: ScoredBranch) => b.marginPct ?? -Infinity },
} as const;
type SortKey = keyof typeof SORTS;

const money = (n: number) => formatCurrency(n, { cents: false });

const INSIGHT_STYLE: Record<Insight["tone"], { icon: typeof Lightbulb; className: string }> = {
  good: { icon: TrendingUp, className: "text-emerald-400 bg-emerald-500/10 light:text-emerald-700" },
  bad: { icon: TrendingDown, className: "text-red-400 bg-red-500/10 light:text-red-700" },
  warn: { icon: AlertTriangle, className: "text-amber-400 bg-amber-500/10 light:text-amber-700" },
  info: { icon: Lightbulb, className: "text-blue-400 bg-blue-500/10 light:text-blue-700" },
};

/* Each branch keeps one colour everywhere on the page (cards, score bars,
   chart), in branch order, from the validated categorical palette (dark
   surface steps; adjacent pairs pass the colourblind checks). Status is
   shown by the badge and label, never by the branch colour. */
const BRANCH_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const OTHER_COLOR = "#64748b";

const STATUS = {
  top: { label: "Top performer", tone: "green" as const, color: VIZ.emerald },
  steady: { label: "On track", tone: "blue" as const, color: VIZ.blue },
  attention: { label: "Needs attention", tone: "yellow" as const, color: VIZ.amber },
};

/**
 * Every branch side by side: who leads, who grows, who slips and what needs
 * doing today. Scores and findings are worked out automatically from sales,
 * costs, invoices and stock (lib/branch-performance.ts).
 */
export default async function BranchPerformancePage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { sort: sortParam } = await searchParams;
  const sort: SortKey = sortParam && sortParam in SORTS ? (sortParam as SortKey) : "score";
  const { branches, branchOrder, insights, monthLabels, months, periodStart } = await getBranchPerformance(session.companyId);
  // Colour follows the branch, not its rank: assigned in the stable branch order.
  const colorOf = new Map(branchOrder.map((id, i) => [id, BRANCH_COLORS[i] ?? OTHER_COLOR]));
  const inBranchOrder = branchOrder.map((id) => branches.find((b) => b.id === id)!).filter(Boolean);

  const revenue = branches.reduce((s, b) => s + b.revenue, 0);
  const revenuePrev = branches.reduce((s, b) => s + b.revenuePrev, 0);
  const net = branches.reduce((s, b) => s + b.net, 0);
  const attention = branches.filter((b) => b.status === "attention").length;
  const sorted = [...branches].sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a));
  const growth = revenuePrev > 0 ? ((revenue - revenuePrev) / revenuePrev) * 100 : null;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <BackButton href="/dashboard/reports" label="Reports" />
      <div className="mt-2">
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Branch performance</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          The last {PERIOD_DAYS} days ({format(periodStart, "d MMM")} to today) against the {PERIOD_DAYS} days before. Worked out automatically from
          sales, costs, invoices and stock.
        </p>
      </div>

      {branches.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-white/[0.09] p-8 text-center text-sm text-slate-400 glass light:border-white/80">
          No active branches yet. Add branches under Administration to compare them here.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={`Revenue, last ${PERIOD_DAYS} days`}
              value={revenue}
              prefix={CURRENCY_PREFIX}
              icon={Wallet}
              color={VIZ.emerald}
              change={{ pct: growth, label: "vs the 30 days before" }}
            />
            <KpiCard label="Net profit" value={net} prefix={CURRENCY_PREFIX} icon={TrendingUp} color={net >= 0 ? VIZ.blue : VIZ.red} hint="Revenue less costs, all branches" />
            <KpiCard
              label="Margin"
              value={revenue > 0 ? Math.round((net / revenue) * 100) : 0}
              suffix="%"
              icon={Percent}
              color={VIZ.blue}
              hint="Share of revenue kept as profit"
            />
            <KpiCard
              label="Branches needing attention"
              value={attention}
              icon={AlertTriangle}
              color={attention > 0 ? VIZ.amber : VIZ.emerald}
              hint={attention > 0 ? `${attention} of ${branches.length} branches have an issue` : `All ${branches.length} branches on track`}
            />
          </div>

          <section className="mt-6 rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-50 light:text-slate-900">
              <Lightbulb className="h-4 w-4 text-blue-400 light:text-blue-700" />
              What stands out
            </h2>
            <ul className="mt-4 space-y-2.5">
              {insights.map((insight, i) => {
                const style = INSIGHT_STYLE[insight.tone];
                return (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-200 light:text-slate-700">
                    <span className={cn("mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md", style.className)}>
                      <style.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="leading-6">{insight.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.09] glass light:border-white/80">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-50 light:text-slate-900">
                <Trophy className="h-4 w-4 text-amber-400 light:text-amber-700" />
                Ranking
              </h2>
              <div className="flex items-center gap-1 text-xs" role="group" aria-label="Sort branches by">
                <span className="mr-1 text-slate-400 light:text-slate-500">Sort by</span>
                {(Object.keys(SORTS) as SortKey[]).map((key) => (
                  <Link
                    key={key}
                    href={key === "score" ? "/dashboard/reports/branches" : `/dashboard/reports/branches?sort=${key}`}
                    aria-current={sort === key ? "true" : undefined}
                    className={cn(
                      "rounded-full px-3 py-1 font-medium transition-colors",
                      sort === key ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/[0.06] light:text-slate-600 light:hover:bg-slate-100"
                    )}
                  >
                    {SORTS[key].label}
                  </Link>
                ))}
              </div>
            </div>
            <table className="mt-3 w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-slate-400 light:border-slate-200 light:text-slate-500">
                  <th className="px-5 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Branch</th>
                  <th className="px-3 py-2.5 font-medium">Score</th>
                  <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2.5 text-right font-medium">Growth</th>
                  <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                  <th className="px-3 py-2.5 text-right font-medium">Avg order</th>
                  <th className="px-3 py-2.5 text-right font-medium">Per person</th>
                  <th className="px-3 py-2.5 text-right font-medium">Overdue</th>
                  <th className="px-5 py-2.5 text-right font-medium">Expiring</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b, i) => (
                  <tr key={b.id} className="border-b border-white/[0.04] last:border-0 light:border-slate-100">
                    <td className="px-5 py-3 tabular-nums text-slate-400 light:text-slate-500">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-50 light:text-slate-900">{b.name}</span>
                        <Badge tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Badge>
                      </div>
                      {b.flags.length > 0 && <p className="mt-1 text-xs text-amber-300 light:text-amber-700">{b.flags.join(" · ")}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07] light:bg-slate-200">
                          <span className="block h-full rounded-full" style={{ width: `${b.score}%`, backgroundColor: colorOf.get(b.id) }} />
                        </span>
                        <span className="tabular-nums text-slate-300 light:text-slate-600">{b.score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-50 light:text-slate-900">{money(b.revenue)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {b.growthPct === null ? (
                        <span className="text-slate-500">New</span>
                      ) : (
                        <span className={cn("inline-flex items-center gap-0.5", b.growthPct >= 0 ? "text-emerald-400 light:text-emerald-700" : "text-red-400 light:text-red-700")}>
                          {b.growthPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {Math.abs(b.growthPct).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className={cn("px-3 py-3 text-right tabular-nums", b.net < 0 ? "text-red-400 light:text-red-700" : "text-slate-300 light:text-slate-700")}>
                      {b.marginPct === null ? "No sales" : `${b.marginPct.toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-300 light:text-slate-700">{b.avgOrder === null ? "No orders" : money(b.avgOrder)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-300 light:text-slate-700">
                      {b.revenuePerEmployee === null ? "No staff" : money(b.revenuePerEmployee)}
                    </td>
                    <td className={cn("px-3 py-3 text-right tabular-nums", b.overdue > 0 ? "text-amber-300 light:text-amber-700" : "text-slate-500")}>
                      {b.overdue > 0 ? money(b.overdue) : "None"}
                    </td>
                    <td className={cn("px-5 py-3 text-right tabular-nums", b.expiring > 0 ? "text-amber-300 light:text-amber-700" : "text-slate-500")}>
                      {b.expiring > 0 ? money(b.expiring) : "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 pb-4 pt-2 text-xs text-slate-500">
              Score out of 100, against the other branches: margin 35%, growth 30%, size 15%, and 20% for running clean (little overdue money, expiring stock
              or empty shelves). Expiring means within {EXPIRING_DAYS} days.
            </p>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {inBranchOrder.map((b) => (
              <KpiCard
                key={b.id}
                label={b.name}
                value={b.revenue}
                prefix={CURRENCY_PREFIX}
                icon={Store}
                color={colorOf.get(b.id)!}
                trend={b.revenueByMonth}
                trendLabels={monthLabels}
                progress={{ pct: b.sharePct, label: `${b.sharePct.toFixed(0)}% of company revenue · ${STATUS[b.status].label}` }}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
          <section className="rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80 xl:col-span-2">
            <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Who is ahead</h2>
            <p className="mb-4 mt-1 text-xs text-slate-400 light:text-slate-500">Revenue in the last {PERIOD_DAYS} days, biggest first.</p>
            <HorizontalBarChart
              data={[...branches].sort((a, b) => b.revenue - a.revenue).map((b) => ({ label: b.name, value: b.revenue, color: colorOf.get(b.id) }))}
            />
          </section>
          <section className="rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80 xl:col-span-3">
            <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Revenue by branch, month by month</h2>
            <p className="mb-4 mt-1 text-xs text-slate-400 light:text-slate-500">
              Last {months.length} months. The percentage on each bar is that branch&apos;s share of the month&apos;s revenue; hover a month for the amounts.
            </p>
            <BranchBarChart
              months={months}
              partialLast
              series={inBranchOrder.map((b) => ({ id: b.id, name: b.name, color: colorOf.get(b.id)!, values: b.revenueByMonth }))}
            />
          </section>
          </div>
        </>
      )}
    </div>
  );
}
