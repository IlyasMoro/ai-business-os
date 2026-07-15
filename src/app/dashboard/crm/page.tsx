import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { VIZ } from "@/components/dash-viz/colors";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

const statusOrder = ["LEAD", "ACTIVE", "INACTIVE"] as const;
const statusColor: Record<(typeof statusOrder)[number], string> = {
  LEAD: VIZ.amber,
  ACTIVE: VIZ.emerald,
  INACTIVE: VIZ.muted,
};

function crmHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/crm?${qs}` : "/dashboard/crm";
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();

  const where: Prisma.CustomerWhereInput = {
    companyId: session.companyId,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { company: { contains: q } },
          ],
        }
      : {}),
  };

  const [customers, totalCount, statusGroups] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
    db.customer.groupBy({ by: ["status"], where: { companyId: session.companyId }, _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);

  const AT_RISK_DAYS = 60;
  const activeCustomerIds = customers.filter((c) => c.status === "ACTIVE").map((c) => c.id);
  const [lastOrders, lastInvoices] = await Promise.all([
    db.order.groupBy({ by: ["customerId"], where: { customerId: { in: activeCustomerIds } }, _max: { createdAt: true } }),
    db.invoice.groupBy({ by: ["customerId"], where: { customerId: { in: activeCustomerIds } }, _max: { createdAt: true } }),
  ]);
  const lastActivityMap = new Map<string, Date>();
  for (const row of [...lastOrders, ...lastInvoices]) {
    const at = row._max.createdAt;
    if (!at) continue;
    const existing = lastActivityMap.get(row.customerId);
    if (!existing || at > existing) lastActivityMap.set(row.customerId, at);
  }
  const atRiskCutoff = new Date(new Date().getTime() - AT_RISK_DAYS * 24 * 60 * 60 * 1000);
  const atRiskCustomerIds = new Set(
    Array.from(lastActivityMap.entries())
      .filter(([, lastAt]) => lastAt < atRiskCutoff)
      .map(([customerId]) => customerId)
  );

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} customer{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form method="GET" className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search customers..."
              defaultValue={q}
              className="w-full rounded-md border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white py-2 pl-9 pr-3 text-sm text-slate-50 light:text-slate-900 placeholder:text-slate-500 outline-none transition-colors focus:border-blue-500"
            />
          </form>
          <Link
            href="/dashboard/crm/new"
            className="inline-flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            New customer
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-6">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center">
          <DonutChart
            title="Customers by status"
            centerValue={String(totalAll)}
            centerLabel="total"
            slices={statusOrder.map((status) => ({
              label: status.charAt(0) + status.slice(1).toLowerCase(),
              value: statusMap.get(status) ?? 0,
              color: statusColor[status],
            }))}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        {customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q
              ? "No customers match your search."
              : "No customers yet. Add your first one to get started."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/crm/${customer.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{customer.company ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{customer.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: statusColor[customer.status] }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor[customer.status] }} />
                        {customer.status}
                      </span>
                      {atRiskCustomerIds.has(customer.id) && (
                        <span
                          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                          title={`No orders or invoices in the last ${AT_RISK_DAYS} days`}
                        >
                          At risk
                        </span>
                      )}
                    </div>
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
                  href={crmHref(page - 1, q)}
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
                  href={crmHref(page + 1, q)}
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
