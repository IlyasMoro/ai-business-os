import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchPicker } from "@/lib/branches";
import { OrderForm } from "@/components/sales/order-form";
import { createOrder } from "@/lib/actions/sales";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function NewOrderPage() {
  const session = await verifySession();
  const branches = await branchPicker();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/sales" label="Back to orders" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New order</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <OrderForm branches={branches} action={createOrder} customers={customers} submitLabel="Create order" />
        </div>
      </div>
    </div>
  );
}
