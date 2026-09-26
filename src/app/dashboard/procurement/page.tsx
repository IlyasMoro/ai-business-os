import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/branches";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { TrendChart } from "@/components/dash-viz/trend-chart";
import { ChangeBadge } from "@/components/dash-viz/change-badge";
import { VIZ } from "@/components/dash-viz/colors";
import { Badge, StatusBadge } from "@/components/ui-dark/badge";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { Plus, Search, ChevronLeft, ChevronRight, Download, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";
import { fieldStyles } from "@/components/ui-dark/input";

const statusOrder = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const;
const statusColor: Record<(typeof statusOrder)[number], string> = {
  DRAFT: VIZ.muted,
  ORDERED: VIZ.blue,
  RECEIVED: VIZ.emerald,
  CANCELLED: VIZ.red,
};

function procurementHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/procurement?${qs}` : "/dashboard/procurement";
}

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();
  const inBranch = await branchWhere();

  const where: Prisma.PurchaseOrderWhereInput = {
    companyId: session.companyId,
    ...inBranch,
    ...(q ? { supplier: { name: { contains: q } } } : {}),
  };

  const [purchaseOrders, totalCount, statusGroups] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.purchaseOrder.count({ where }),
    db.purchaseOrder.groupBy({
      by: ["status"],
      where: { companyId: session.companyId, ...inBranch },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const totalValue = statusGroups.reduce((s, g) => s + (g._sum.totalAmount ?? 0), 0);

  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
  const purchaseOrdersForTrend = await db.purchaseOrder.findMany({
    where: { companyId: session.companyId, ...inBranch, createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true, totalAmount: true },
  });
  const monthlyValueTrend = Array.from({ length: 6 }).map((_, i) => {
    const monthStart = startOfMonth(subMonths(new Date(), 5 - i));
    const monthEnd = endOfMonth(monthStart);
    return purchaseOrdersForTrend
      .filter((po) => po.createdAt >= monthStart && po.createdAt <= monthEnd)
      .reduce((s, po) => s + po.totalAmount, 0);
  });

  const trendPoints = monthlyValueTrend.map((value, i) => {
    const month = subMonths(new Date(), 5 - i);
    return { label: format(month, "MMM"), longLabel: format(month, "MMMM yyyy"), value };
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Purchase orders</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} purchase order{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <form method="GET" className="relative w-full min-w-48 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search by supplier..."
              defaultValue={q}
              className={fieldStyles("pl-9")}
            />
          </form>
          <Link
            href="/dashboard/procurement/suppliers"
            className={buttonStyles("secondary")}
          >
            Suppliers
          </Link>
          <a
            href="/api/export/purchase-orders"
            className={buttonStyles("secondary")}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link
            href="/dashboard/procurement/new"
            className={buttonStyles("primary")}
          >
            <Plus className="h-4 w-4" />
            New purchase order
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-white/[0.09] light:border-white/80 p-5 lg:col-span-1 glass">
          <p className="text-sm text-slate-400 light:text-slate-500">Total PO value</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-400 light:text-emerald-700">
            <AnimatedCounter value={totalValue} prefix="$" decimals={0} />
          </p>
          <div className="mt-2">
            <ChangeBadge values={monthlyValueTrend} period="last month" />
          </div>
          {monthlyValueTrend.some((v) => v > 0) ? (
            <div className="mt-4 flex-1">
              <TrendChart data={trendPoints} color={VIZ.emerald} currency title="Purchase order value by month, last 6 months" />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No activity in the last 6 months yet.</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-6 lg:col-span-2 glass">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
            <DonutChart
              title="Purchase orders by status"
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

      <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {purchaseOrders.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={q ? "No purchase orders match your search" : "No purchase orders yet"}
            description={q ? "Try a different search term, or clear it to see everything." : "Create a purchase order to buy stock from a supplier."}
            action={q ? { href: "/dashboard/procurement", label: "Clear search", variant: "secondary" } : { href: "/dashboard/procurement/new", label: "New purchase order" }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/procurement/${po.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {po.supplier.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={po.status} color={statusColor[po.status]} />
                      {po.autoCreated && po.status === "DRAFT" && <Badge tone="yellow">Needs approval</Badge>}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-slate-300 light:text-slate-600">
                    {formatCompactCurrency(po.totalAmount)}
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{po.createdAt.toLocaleDateString()}</td>
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
                  href={procurementHref(page - 1, q)}
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
                  href={procurementHref(page + 1, q)}
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
