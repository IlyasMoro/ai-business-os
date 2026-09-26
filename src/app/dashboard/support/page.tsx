import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AllocationBar } from "@/components/dash-viz/allocation-bar";
import { VIZ } from "@/components/dash-viz/colors";
import { StatusBadge } from "@/components/ui-dark/badge";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, Search, ChevronLeft, ChevronRight, Download, LifeBuoy } from "lucide-react";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";
import { fieldStyles } from "@/components/ui-dark/input";

const statusOrder = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const statusColor: Record<(typeof statusOrder)[number], string> = {
  OPEN: VIZ.blue,
  IN_PROGRESS: VIZ.amber,
  RESOLVED: VIZ.emerald,
  CLOSED: VIZ.muted,
};

const priorityOrder = ["LOW", "MEDIUM", "HIGH"] as const;
const priorityColor: Record<(typeof priorityOrder)[number], string> = {
  LOW: VIZ.muted,
  MEDIUM: VIZ.amber,
  HIGH: VIZ.red,
};

function supportHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/support?${qs}` : "/dashboard/support";
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();

  const where: Prisma.TicketWhereInput = {
    companyId: session.companyId,
    ...(q
      ? {
          OR: [
            { subject: { contains: q } },
            { customer: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [tickets, totalCount, statusGroups, priorityGroups] = await Promise.all([
    db.ticket.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.ticket.count({ where }),
    db.ticket.groupBy({ by: ["status"], where: { companyId: session.companyId }, _count: { _all: true } }),
    db.ticket.groupBy({ by: ["priority"], where: { companyId: session.companyId }, _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const statusMap = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const totalAll = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const priorityMap = new Map(priorityGroups.map((g) => [g.priority, g._count._all]));
  const totalPriority = priorityGroups.reduce((s, g) => s + g._count._all, 0) || 1;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Tickets</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} ticket{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <form method="GET" className="relative w-full min-w-48 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search by subject or customer..."
              defaultValue={q}
              className={fieldStyles("pl-9")}
            />
          </form>
          <a
            href="/api/export/tickets"
            className={buttonStyles("secondary")}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link
            href="/dashboard/support/new"
            className={buttonStyles("primary")}
          >
            <Plus className="h-4 w-4" />
            New ticket
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-6 glass">
          <div className="flex justify-center">
            <DonutChart
              title="Tickets by status"
              centerValue={String(totalAll)}
              centerLabel="tickets"
              slices={statusOrder.map((status) => ({
                label: status.charAt(0) + status.slice(1).toLowerCase().replace("_", " "),
                value: statusMap.get(status) ?? 0,
                color: statusColor[status],
              }))}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-6 glass">
          <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Tickets by priority</h2>
          {priorityGroups.every((g) => g._count._all === 0) ? (
            <p className="mt-4 text-xs text-slate-500">No tickets yet. Priorities show here once tickets come in.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {priorityOrder.map((priority) => (
                <AllocationBar
                  key={priority}
                  label={priority.charAt(0) + priority.slice(1).toLowerCase()}
                  count={priorityMap.get(priority) ?? 0}
                  pct={((priorityMap.get(priority) ?? 0) / totalPriority) * 100}
                  color={priorityColor[priority]}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {tickets.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title={q ? "No tickets match your search" : "No tickets yet"}
            description={q ? "Try a different search term, or clear it to see everything." : "Create a ticket to track a customer question or issue."}
            action={q ? { href: "/dashboard/support", label: "Clear search", variant: "secondary" } : { href: "/dashboard/support/new", label: "New ticket" }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/support/${ticket.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{ticket.customer.name}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={ticket.status} color={statusColor[ticket.status]} />
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-xs"
                      style={{
                        borderColor: `${priorityColor[ticket.priority]}40`,
                        backgroundColor: `${priorityColor[ticket.priority]}1a`,
                        color: priorityColor[ticket.priority],
                      }}
                    >
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">
                    {ticket.createdAt.toLocaleDateString()}
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
                  href={supportHref(page - 1, q)}
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
                  href={supportHref(page + 1, q)}
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
