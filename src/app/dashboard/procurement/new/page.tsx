import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { PurchaseOrderForm } from "@/components/procurement/purchase-order-form";
import { ErrorBanner } from "@/components/ui/error-banner";

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await verifySession();

  const suppliers = await db.supplier.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New purchase order</h1>
      <div className="mt-6 max-w-xl">
        <ErrorBanner code={error} />
        <PurchaseOrderForm suppliers={suppliers} />
      </div>
    </div>
  );
}
