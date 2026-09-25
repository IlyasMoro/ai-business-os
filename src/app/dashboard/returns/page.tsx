import Link from "next/link";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { VIZ } from "@/components/dash-viz/colors";
import { StatusBadge } from "@/components/ui-dark/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { getReturnPolicy } from "@/lib/returns-policy";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { ReturnStatusValues, type ReturnStatus } from "@/lib/returns-math";
import { Plus, Search, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";

const statusColor: Record<ReturnStatus, string> = {
  REQUESTED: VIZ.amber,
  APPROVED: VIZ.blue,
  RECEIVED: VIZ.blue,
  REFUNDED: VIZ.emerald,
  REJECTED: VIZ.red,
};

function returnsHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/returns?${qs}` : "/dashboard/returns";
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; error?: string }>;
}) {
  const { page: pageParam, q, error } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();
  const policy = await getReturnPolicy(session.companyId);
  const canManagePolicy = hasRole(session, ["OWNER", "ADMIN"]);

  const where: Prisma.ReturnAuthorizationWhereInput = {
    companyId: session.companyId,
    ...(q
      ? {
          OR: [
            { rmaNumber: { contains: q, mode: "insensitive" } },
            { order: { customer: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [returns, totalCount, statusGroups] = await Promise.all([
    db.returnAuthorization.findMany({
      where,
      include: { order: { select: { id: true, customer: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.returnAuthorization.count({ where }),
    db.returnAuthorization.groupBy({
      by: ["status"],
      where: { companyId: session.companyId },
      _count: { _all: true },
      _sum: { refundAmount: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const refunded = statusGroups.find((g) => g.status === "REFUNDED")?._sum.refundAmount ?? 0;
  const openCount = (statusMap.get("REQUESTED") ?? 0) + (statusMap.get("APPROVED") ?? 0) + (statusMap.get("RECEIVED") ?? 0);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Returns</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} return{totalCount === 1 ? "" : "s"}
            {" · "}
            {policy.windowDays > 0 ? `${policy.windowDays} day window` : "No time limit"}
            {policy.restockingFeePercent > 0 && ` · ${policy.restockingFeePercent}% restocking fee`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form method="GET" className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search RMA or customer..."
              defaultValue={q}
              className="w-full rounded-md border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white py-2 pl-9 pr-3 text-sm text-slate-50 light:text-slate-900 placeholder:text-slate-500 outline-none transition-colors focus:border-blue-500"
            />
          </form>
          {canManagePolicy && (
            <Link
              href="/dashboard/returns/policy"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-white/[0.06] light:border-slate-200 px-4 py-2 text-sm font-medium text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
            >
              <Settings2 className="h-4 w-4" />
              Return policy
            </Link>
          )}
          {policy.enabled && (
            <Link
              href="/dashboard/returns/new"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              New return
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ErrorBanner code={error} />
        {!policy.enabled && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Returns are turned off for this company, so no new returns can be opened.
            {canManagePolicy && (
              <>
                {" "}
                <Link href="/dashboard/returns/policy" className="underline hover:text-amber-200">
                  Change the return policy
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
            <p className="text-sm text-slate-400 light:text-slate-500">Refunded to customers</p>
            <p className="mt-2 text-2xl font-semibold text-red-400">
              <AnimatedCounter value={refunded} prefix="$" decimals={0} />
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
            <p className="text-sm text-slate-400 light:text-slate-500">Open returns</p>
            <p className="mt-2 text-2xl font-semibold text-amber-400">{openCount}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-6 lg:col-span-2">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
            <DonutChart
              title="Returns by status"
              centerValue={String(totalAll)}
              centerLabel="returns"
              slices={ReturnStatusValues.map((status) => ({
                label: status.charAt(0) + status.slice(1).toLowerCase(),
                value: statusMap.get(status) ?? 0,
                color: statusColor[status],
              }))}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        {returns.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q ? "No returns match your search." : "No returns yet. Open one from a fulfilled order."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">RMA</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Refund</th>
                <th className="px-5 py-3 font-medium">Opened</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((rma) => (
                <tr key={rma.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/returns/${rma.id}`}
                      className="font-mono font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {rma.rmaNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{rma.order.customer.name}</td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{rma.reason}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={rma.status} color={statusColor[rma.status]} />
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-slate-300 light:text-slate-600">
                    {formatCompactCurrency(rma.refundAmount)}
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{rma.createdAt.toLocaleDateString()}</td>
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
                  href={returnsHref(page - 1, q)}
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
                  href={returnsHref(page + 1, q)}
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
