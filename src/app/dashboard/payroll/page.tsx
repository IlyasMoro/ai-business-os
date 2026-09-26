import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { TrendChart } from "@/components/dash-viz/trend-chart";
import { ChangeBadge } from "@/components/dash-viz/change-badge";
import { format } from "date-fns";
import { ErrorBanner } from "@/components/ui/error-banner";
import { VIZ } from "@/components/dash-viz/colors";
import { StatusBadge } from "@/components/ui-dark/badge";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, ChevronLeft, ChevronRight, Download, Banknote } from "lucide-react";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";

const statusOrder = ["DRAFT", "PROCESSED", "PAID"] as const;
const statusColor: Record<(typeof statusOrder)[number], string> = {
  DRAFT: VIZ.muted,
  PROCESSED: VIZ.blue,
  PAID: VIZ.emerald,
};

function payrollHref(page: number) {
  return page > 1 ? `/dashboard/payroll?page=${page}` : "/dashboard/payroll";
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const { page: pageParam, error } = await searchParams;
  const page = parsePage(pageParam);
  const session = await requireRole(["OWNER", "ADMIN"]);

  const where = { companyId: session.companyId };

  const [payrollRuns, totalCount, statusGroups] = await Promise.all([
    db.payrollRun.findMany({
      where,
      orderBy: { periodStart: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.payrollRun.count({ where }),
    db.payrollRun.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const totalPaid = statusGroups.find((g) => g.status === "PAID")?._sum.totalAmount ?? 0;

  const recentRuns = await db.payrollRun.findMany({
    where,
    orderBy: { periodEnd: "desc" },
    take: 6,
    select: { totalAmount: true, periodEnd: true },
  });
  const runsOldestFirst = [...recentRuns].reverse();
  const payrollTrend = runsOldestFirst.map((r) => r.totalAmount);
  const trendPoints = runsOldestFirst.map((r) => ({
    label: format(r.periodEnd, "MMM d"),
    longLabel: `Run ending ${format(r.periodEnd, "d MMMM yyyy")}`,
    value: r.totalAmount,
  }));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <ErrorBanner code={error} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Payroll runs</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} payroll run{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/payroll"
            className={buttonStyles("secondary")}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link
            href="/dashboard/payroll/new"
            className={buttonStyles("primary")}
          >
            <Plus className="h-4 w-4" />
            New payroll run
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-white/[0.09] light:border-white/80 p-5 lg:col-span-1 glass">
          <p className="text-sm text-slate-400 light:text-slate-500">Total paid</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-400 light:text-emerald-700">
            <AnimatedCounter value={totalPaid} prefix="$" decimals={0} />
          </p>
          <div className="mt-2">
            <ChangeBadge values={payrollTrend} period="previous run" />
          </div>
          {payrollTrend.length > 1 ? (
            <div className="mt-4 flex-1">
              <TrendChart data={trendPoints} color={VIZ.emerald} currency title="Payroll total per run, last 6 runs" />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No activity in the last 6 months yet.</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-6 lg:col-span-2 glass">
          <div className="flex justify-center">
            <DonutChart
              title="Payroll runs by status"
              centerValue={String(totalAll)}
              centerLabel="runs"
              slices={statusOrder.map((status) => ({
                label: status.charAt(0) + status.slice(1).toLowerCase(),
                value: statusMap.get(status) ?? 0,
                color: statusColor[status],
              }))}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {payrollRuns.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payroll runs yet"
            description="Create a payroll run to pay your employees for a period."
            action={{ href: "/dashboard/payroll/new", label: "New payroll run" }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {payrollRuns.map((run) => (
                <tr key={run.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/payroll/${run.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {run.periodStart.toLocaleDateString()} – {run.periodEnd.toLocaleDateString()}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={run.status} color={statusColor[run.status]} />
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-slate-300 light:text-slate-600">
                    {formatCompactCurrency(run.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] light:border-slate-200 px-5 py-3">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={payrollHref(page - 1)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700 light:text-slate-300">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={payrollHref(page + 1)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700 light:text-slate-300">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
