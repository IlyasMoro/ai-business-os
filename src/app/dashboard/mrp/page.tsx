import Link from "next/link";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui-dark/badge";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { buildMrpPlan, getMrpSettings } from "@/lib/mrp";
import { createPurchaseOrdersFromPlan, createWorkOrderFromPlan } from "@/lib/actions/mrp";
import { ClipboardList, Settings2, ShoppingCart, Wrench, TriangleAlert } from "lucide-react";

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; show?: string }>;
}) {
  const { error, show } = await searchParams;
  const session = await verifySession();
  const settings = await getMrpSettings(session.companyId);
  const canManage = hasRole(session, ["OWNER", "ADMIN"]);

  if (!settings.enabled) {
    return (
      <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Planning</h1>
        <p className="mt-4 max-w-2xl rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Planning is turned off for this company.
          {canManage && (
            <>
              {" "}
              <Link href="/dashboard/mrp/settings" className="underline hover:text-amber-200">
                Change the planning settings
              </Link>
            </>
          )}
        </p>
      </div>
    );
  }

  const [rows, suppliers, openWorkOrders] = await Promise.all([
    buildMrpPlan(session.companyId, settings),
    db.supplier.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true } }),
    db.workOrder.count({ where: { companyId: session.companyId, status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
  ]);
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const suggestions = rows.filter((r) => r.plannedQty > 0);
  const toBuy = suggestions.filter((r) => r.action === "BUY");
  const toMake = suggestions.filter((r) => r.action === "MAKE");
  const buyWithSupplier = toBuy.filter((r) => r.preferredSupplierId);
  const showAll = show === "all";
  const visible = showAll ? rows.filter((r) => r.salesDemand + r.componentDemand + r.onOrder + r.onHand > 0 || r.plannedQty > 0) : suggestions;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Planning</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Demand from {settings.includePendingOrders ? "pending and confirmed" : "confirmed"} orders
            {settings.useSafetyStock ? ", keeping reorder levels as safety stock" : ", no safety stock"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/mrp/work-orders"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-white/[0.06] light:border-slate-200 px-4 py-2 text-sm font-medium text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
          >
            <ClipboardList className="h-4 w-4" />
            Work orders
          </Link>
          {canManage && (
            <Link
              href="/dashboard/mrp/settings"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-white/[0.06] light:border-slate-200 px-4 py-2 text-sm font-medium text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
            >
              <Settings2 className="h-4 w-4" />
              Settings
            </Link>
          )}
          {buyWithSupplier.length > 0 && (
            <form action={createPurchaseOrdersFromPlan.bind(null, null)}>
              <SubmitButton pendingText="Creating...">Create all purchase orders</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ErrorBanner code={error} />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
          <p className="flex items-center gap-2 text-sm text-slate-400 light:text-slate-500">
            <ShoppingCart className="h-4 w-4" /> Items to buy
          </p>
          <p className="mt-2 text-2xl font-semibold text-blue-400">{toBuy.length}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
          <p className="flex items-center gap-2 text-sm text-slate-400 light:text-slate-500">
            <Wrench className="h-4 w-4" /> Items to make
          </p>
          <p className="mt-2 text-2xl font-semibold text-purple-400">{toMake.length}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
          <p className="flex items-center gap-2 text-sm text-slate-400 light:text-slate-500">
            <ClipboardList className="h-4 w-4" /> Open work orders
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-400">{openWorkOrders}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 text-sm">
        <Link
          href="/dashboard/mrp"
          className={showAll ? "text-slate-500 hover:text-slate-300" : "font-medium text-blue-400"}
        >
          Suggestions ({suggestions.length})
        </Link>
        <Link
          href="/dashboard/mrp?show=all"
          className={showAll ? "font-medium text-blue-400" : "text-slate-500 hover:text-slate-300"}
        >
          Full plan
        </Link>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {showAll
              ? "No products have demand or stock yet."
              : "Nothing to buy or make. Stock and open orders cover all demand."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 text-right font-medium" title="Open sales orders">Sales</th>
                <th className="px-4 py-3 text-right font-medium" title="Needed to build other products">Components</th>
                <th className="px-4 py-3 text-right font-medium">On hand</th>
                <th className="px-4 py-3 text-right font-medium" title="Open purchase orders and work orders">On order</th>
                <th className="px-4 py-3 text-right font-medium">Safety</th>
                <th className="px-4 py-3 text-right font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Ready by</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {visible.map((row) => (
                <tr key={row.productId} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 font-sans">
                    <Link
                      href={`/dashboard/inventory/${row.productId}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-slate-500">{row.sku}</p>
                  </td>
                  <td className="px-4 py-3 font-sans">
                    <Badge tone={row.action === "MAKE" ? "purple" : "blue"}>{row.action === "MAKE" ? "Make" : "Buy"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 light:text-slate-600">{row.salesDemand}</td>
                  <td className="px-4 py-3 text-right text-slate-300 light:text-slate-600">{row.componentDemand}</td>
                  <td className="px-4 py-3 text-right text-slate-300 light:text-slate-600">{row.onHand}</td>
                  <td className="px-4 py-3 text-right text-slate-300 light:text-slate-600">{row.onOrder}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{row.safetyStock}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.plannedQty > 0 ? "text-amber-400" : "text-slate-600"}`}>
                    {row.plannedQty > 0 ? row.plannedQty : "0"}
                  </td>
                  <td className="px-4 py-3 font-sans text-slate-400 light:text-slate-500">
                    {row.plannedQty > 0 ? (
                      <>
                        {row.availableBy.toLocaleDateString()}
                        <p className="text-xs text-slate-500">{row.leadTimeDays} day lead time</p>
                      </>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-sans">
                    {row.plannedQty > 0 && row.action === "MAKE" && (
                      <form action={createWorkOrderFromPlan.bind(null, row.productId)}>
                        <SubmitButton variant="secondary" pendingText="Creating..." className="whitespace-nowrap">
                          Create work order
                        </SubmitButton>
                      </form>
                    )}
                    {row.plannedQty > 0 && row.action === "BUY" && row.preferredSupplierId && (
                      <form action={createPurchaseOrdersFromPlan.bind(null, row.productId)}>
                        <SubmitButton variant="secondary" pendingText="Creating..." className="whitespace-nowrap">
                          Order from {supplierName.get(row.preferredSupplierId) ?? "supplier"}
                        </SubmitButton>
                      </form>
                    )}
                    {row.plannedQty > 0 && row.action === "BUY" && !row.preferredSupplierId && (
                      <Link
                        href={`/dashboard/inventory/${row.productId}`}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-amber-400 hover:text-amber-300"
                      >
                        <TriangleAlert className="h-3.5 w-3.5" />
                        Set a supplier
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Plan = sales + components + safety, minus on hand and on order, rounded up to the lot size. Made products pass
        their plan down to their components.
      </p>
    </div>
  );
}
