import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SupplierForm } from "@/components/procurement/supplier-form";
import { deleteSupplier } from "@/lib/actions/procurement";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await verifySession();

  const suppliers = await db.supplier.findMany({
    where: { companyId: session.companyId },
    orderBy: { name: "asc" },
    include: {
      purchaseOrders: {
        where: { receivedAt: { not: null } },
        select: { createdAt: true, receivedAt: true, expectedDate: true },
      },
    },
  });

  const supplierStats = suppliers.map((supplier) => {
    const received = supplier.purchaseOrders;
    const leadTimes = received.map((po) =>
      Math.max(0, (po.receivedAt!.getTime() - po.createdAt.getTime()) / (24 * 60 * 60 * 1000))
    );
    const avgLeadTimeDays =
      leadTimes.length > 0 ? leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length : null;

    const withExpected = received.filter((po) => po.expectedDate);
    const onTimeCount = withExpected.filter((po) => po.receivedAt! <= po.expectedDate!).length;
    const onTimeRate = withExpected.length > 0 ? (onTimeCount / withExpected.length) * 100 : null;

    return { ...supplier, avgLeadTimeDays, onTimeRate, receivedCount: received.length };
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/dashboard/procurement"
          className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600"
        >
          ← Back to purchase orders
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <ErrorBanner code={error} />
        <SupplierForm />
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        {suppliers.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No suppliers yet. Add your first one above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Avg. lead time</th>
                <th className="px-5 py-3 font-medium">On-time rate</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {supplierStats.map((supplier) => (
                <tr key={supplier.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-50 light:text-slate-900">{supplier.name}</td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{supplier.email ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{supplier.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">
                    {supplier.avgLeadTimeDays === null
                      ? "—"
                      : `${supplier.avgLeadTimeDays.toFixed(1)} days (${supplier.receivedCount} received)`}
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">
                    {supplier.onTimeRate === null ? "—" : `${supplier.onTimeRate.toFixed(0)}%`}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <DeleteButton
                      action={deleteSupplier.bind(null, supplier.id)}
                      confirmMessage="Delete this supplier? Their purchase orders will also be deleted."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
