import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/branches";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { RingGauge } from "@/components/dash-viz/ring-gauge";
import { HorizontalBarChart } from "@/components/dash-viz/horizontal-bar-chart";
import { VIZ } from "@/components/dash-viz/colors";
import { StatusBadge } from "@/components/ui-dark/badge";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, Search, ChevronLeft, ChevronRight, Download, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";
import { fieldStyles } from "@/components/ui-dark/input";

const statusOrder = ["DRAFT", "SENT", "PAID", "OVERDUE"] as const;
const statusColor: Record<(typeof statusOrder)[number], string> = {
  DRAFT: VIZ.muted,
  SENT: VIZ.blue,
  PAID: VIZ.emerald,
  OVERDUE: VIZ.red,
};

function invoicingHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/invoicing?${qs}` : "/dashboard/invoicing";
}

export default async function InvoicingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();
  const inBranch = await branchWhere();

  const where: Prisma.InvoiceWhereInput = {
    companyId: session.companyId,
    ...inBranch,
    ...(q
      ? {
          OR: [
            { invoiceNumber: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [invoices, totalCount, statusGroups] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.invoice.count({ where }),
    db.invoice.groupBy({ by: ["status"], where: { companyId: session.companyId, ...inBranch }, _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const paidCount = statusMap.get("PAID") ?? 0;
  const sentCount = statusMap.get("SENT") ?? 0;
  const overdueCount = statusMap.get("OVERDUE") ?? 0;
  const collectibleTotal = paidCount + sentCount + overdueCount;
  const collectionRate = collectibleTotal > 0 ? (paidCount / collectibleTotal) * 100 : null;

  const outstandingInvoices = await db.invoice.findMany({
    where: { companyId: session.companyId, ...inBranch, status: { in: ["SENT", "OVERDUE"] } },
    include: { customer: { select: { name: true } } },
  });
  const outstandingByCustomer = new Map<string, number>();
  for (const inv of outstandingInvoices) {
    outstandingByCustomer.set(
      inv.customer.name,
      (outstandingByCustomer.get(inv.customer.name) ?? 0) + inv.totalAmount
    );
  }
  const topOutstanding = Array.from(outstandingByCustomer.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} invoice{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <form method="GET" className="relative w-full min-w-48 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search by number or customer..."
              defaultValue={q}
              className={fieldStyles("pl-9")}
            />
          </form>
          <a
            href="/api/export/invoices"
            className={buttonStyles("secondary")}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link
            href="/dashboard/invoicing/new"
            className={buttonStyles("primary")}
          >
            <Plus className="h-4 w-4" />
            New invoice
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 p-6 glass">
        <div className="flex flex-col items-center justify-around gap-8 sm:flex-row sm:items-start">
          <DonutChart
            title="Invoices by status"
            centerValue={String(totalAll)}
            centerLabel="invoices"
            slices={statusOrder.map((status) => ({
              label: status.charAt(0) + status.slice(1).toLowerCase(),
              value: statusMap.get(status) ?? 0,
              color: statusColor[status],
            }))}
          />
          <RingGauge
            label="Collection rate"
            pct={collectionRate}
            detail={`${paidCount} of ${collectibleTotal} paid`}
            emptyText="No invoices sent yet"
          />
        </div>
      </div>

      {topOutstanding.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 p-6 glass">
          <h2 className="mb-4 text-sm font-semibold text-slate-50 light:text-slate-900">Outstanding by customer</h2>
          <HorizontalBarChart data={topOutstanding} color={VIZ.red} />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={q ? "No invoices match your search" : "No invoices yet"}
            description={q ? "Try a different search term, or clear it to see everything." : "Create an invoice to bill a customer and track payment."}
            action={q ? { href: "/dashboard/invoicing", label: "Clear search", variant: "secondary" } : { href: "/dashboard/invoicing/new", label: "New invoice" }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Due date</th>
                <th className="px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/invoicing/${invoice.id}`}
                      className="font-mono text-sm text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{invoice.customer.name}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={invoice.status} color={statusColor[invoice.status]} />
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">
                    {invoice.dueDate.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-amber-400">
                    {formatCompactCurrency(invoice.totalAmount)}
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
                  href={invoicingHref(page - 1, q)}
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
                  href={invoicingHref(page + 1, q)}
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
