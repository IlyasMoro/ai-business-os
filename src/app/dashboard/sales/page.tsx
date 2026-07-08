import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { VIZ } from "@/components/dash-viz/colors";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

const statusOrder = ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;
const statusColor: Record<(typeof statusOrder)[number], string> = {
  PENDING: VIZ.amber,
  CONFIRMED: VIZ.blue,
  FULFILLED: VIZ.emerald,
  CANCELLED: VIZ.red,
};

function salesHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/sales?${qs}` : "/dashboard/sales";
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();

  const where: Prisma.OrderWhereInput = {
    companyId: session.companyId,
    ...(q ? { customer: { name: { contains: q } } } : {}),
  };

  const [orders, totalCount, statusGroups] = await Promise.all([
    db.order.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { companyId: session.companyId }, _count: { _all: true }, _sum: { totalAmount: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const totalValue = statusGroups.reduce((s, g) => s + (g._sum.totalAmount ?? 0), 0);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-[#0B1120] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Sales</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalCount} order{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form method="GET" className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search by customer..."
              defaultValue={q}
              className="w-full rounded-md border border-white/[0.06] bg-[#1A2238] py-2 pl-9 pr-3 text-sm text-slate-50 placeholder:text-slate-500 outline-none transition-colors focus:border-blue-500"
            />
          </form>
          <Link
            href="/dashboard/sales/new"
            className="inline-flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            New order
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] bg-[#1A2238] p-5 lg:col-span-1">
          <p className="text-sm text-slate-400">Total order value</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">
            <AnimatedCounter value={totalValue} prefix="$" decimals={0} />
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#1A2238] p-6 lg:col-span-2">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
            <DonutChart
              title="Orders by status"
              centerValue={String(totalAll)}
              centerLabel="orders"
              slices={statusOrder.map((status) => ({
                label: status.charAt(0) + status.slice(1).toLowerCase(),
                value: statusMap.get(status) ?? 0,
                color: statusColor[status],
              }))}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#1A2238]">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q ? "No orders match your search." : "No orders yet. Create your first one to get started."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/sales/${order.id}`}
                      className="font-medium text-slate-50 hover:text-blue-400"
                    >
                      {order.customer.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: statusColor[order.status] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor[order.status] }} />
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-slate-300">
                    {formatCompactCurrency(order.totalAmount)}
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {order.createdAt.toLocaleDateString()}
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
                  href={salesHref(page - 1, q)}
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
                  href={salesHref(page + 1, q)}
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
