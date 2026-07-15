import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { OrderItemForm } from "@/components/sales/order-item-form";
import { OrderStatusForm } from "@/components/sales/order-status-form";
import { deleteOrder, removeOrderItem } from "@/lib/actions/sales";

const statusTone = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  FULFILLED: "green",
  CANCELLED: "red",
} as const;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const order = await db.order.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      items: { include: { product: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });

  if (!order) notFound();

  const products = await db.product.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true, sku: true, unitPrice: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
                Order for{" "}
                <Link href={`/dashboard/crm/${order.customer.id}`} className="hover:text-blue-400">
                  {order.customer.name}
                </Link>
              </h1>
              <Badge tone={statusTone[order.status]}>{order.status}</Badge>
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              Created {order.createdAt.toLocaleDateString()}
              {" · "}
              {order.invoice ? (
                <Link href={`/dashboard/invoicing/${order.invoice.id}`} className="text-blue-400 hover:text-blue-300">
                  Invoice {order.invoice.invoiceNumber} ({order.invoice.status})
                </Link>
              ) : (
                <span className="text-slate-500">No invoice generated yet</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusForm orderId={order.id} status={order.status} />
            <DeleteButton action={deleteOrder.bind(null, order.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            {order.items.length > 0 && (
              <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-50 light:text-slate-900">{item.product.name}</p>
                      <p className="font-mono text-xs tabular-nums text-slate-500">
                        {item.quantity} × ${item.unitPrice.toFixed(2)} = $
                        {(item.quantity * item.unitPrice).toFixed(2)}
                      </p>
                    </div>
                    <DeleteButton
                      action={removeOrderItem.bind(null, order.id, item.id)}
                      confirmMessage="Remove this item?"
                      label=""
                    />
                  </li>
                ))}
              </ul>
            )}
            <OrderItemForm orderId={order.id} products={products} />
            <p className="mt-4 text-right font-mono text-sm font-semibold tabular-nums text-amber-400">
              Total: ${order.totalAmount.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/sales" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to orders
          </Link>
        </p>
      </div>
    </div>
  );
}
