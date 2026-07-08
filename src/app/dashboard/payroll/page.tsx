import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { Sparkline } from "@/components/dash-viz/sparkline";
import { ErrorBanner } from "@/components/ui/error-banner";
import { VIZ } from "@/components/dash-viz/colors";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

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
    select: { totalAmount: true },
  });
  const payrollTrend = recentRuns.map((r) => r.totalAmount).reverse();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <ErrorBanner code={error} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Payroll</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalCount} payroll run{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/dashboard/payroll/new"
          className="inline-flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
        >
          <Plus className="h-4 w-4" />
          New payroll run
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5 lg:col-span-1">
          <p className="text-sm text-slate-400">Total paid</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">
            <AnimatedCounter value={totalPaid} prefix="$" decimals={0} />
          </p>
          {payrollTrend.length > 1 && (
            <div className="mt-3">
              <Sparkline data={payrollTrend} color={VIZ.emerald} width={180} height={32} />
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-6 lg:col-span-2">
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

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#111111]">
        {payrollRuns.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No payroll runs yet. Create your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-slate-500">
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
                      className="font-medium text-slate-50 hover:text-blue-400"
                    >
                      {run.periodStart.toLocaleDateString()} – {run.periodEnd.toLocaleDateString()}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: statusColor[run.status] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor[run.status] }} />
                      {run.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-slate-300">
                    {formatCompactCurrency(run.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={payrollHref(page - 1)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={payrollHref(page + 1)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/5"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700">
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
