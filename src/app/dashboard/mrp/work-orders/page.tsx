import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/ui-dark/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { getMrpSettings } from "@/lib/mrp";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonStyles } from "@/components/ui-dark/button";

const statusTone = {
  PLANNED: "slate",
  IN_PROGRESS: "yellow",
  COMPLETED: "green",
  CANCELLED: "red",
} as const;

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const { page: pageParam, error } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();
  const settings = await getMrpSettings(session.companyId);

  const where = { companyId: session.companyId };
  const [workOrders, totalCount] = await Promise.all([
    db.workOrder.findMany({
      where,
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.workOrder.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Work orders</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} work order{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        {settings.enabled && (
          <Link
            href="/dashboard/mrp/work-orders/new"
            className={buttonStyles("primary", "md", "self-start")}
          >
            <Plus className="h-4 w-4" />
            New work order
          </Link>
        )}
      </div>

      <div className="mt-4">
        <ErrorBanner code={error} />
      </div>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {workOrders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No work orders yet. Create one here or from a Make suggestion on the Planning page.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Work order</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 text-right font-medium">Quantity</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <tr key={wo.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/mrp/work-orders/${wo.id}`}
                      className="font-mono font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {wo.woNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{wo.product.name}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{wo.quantity}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={wo.status} tone={statusTone[wo.status]} />
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{wo.dueDate?.toLocaleDateString() ?? "Not set"}</td>
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
              {page > 1 && (
                <Link
                  href={`/dashboard/mrp/work-orders?page=${page - 1}`}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/dashboard/mrp/work-orders?page=${page + 1}`}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 hover:bg-white/5"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-6">
        <Link href="/dashboard/mrp" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
          ← Back to planning
        </Link>
      </p>
    </div>
  );
}
