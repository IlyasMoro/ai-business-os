import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { OrderForm } from "@/components/sales/order-form";
import { createOrder } from "@/lib/actions/sales";

export default async function NewOrderPage() {
  const session = await verifySession();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New order</h1>
      <div className="mt-6">
        <OrderForm action={createOrder} customers={customers} submitLabel="Create order" />
      </div>
    </div>
  );
}
