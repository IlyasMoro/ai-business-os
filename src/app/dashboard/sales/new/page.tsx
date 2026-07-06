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
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New order</h1>
      <div className="mt-6">
        <OrderForm action={createOrder} customers={customers} submitLabel="Create order" />
      </div>
    </div>
  );
}
