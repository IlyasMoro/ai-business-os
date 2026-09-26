import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchPicker } from "@/lib/branches";
import { PurchaseOrderForm } from "@/components/procurement/purchase-order-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await verifySession();
  const branches = await branchPicker();

  const suppliers = await db.supplier.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/procurement" label="Back to purchase orders" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New purchase order</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ErrorBanner code={error} />
          <PurchaseOrderForm branches={branches} suppliers={suppliers} />
        </div>
      </div>
    </div>
  );
}
