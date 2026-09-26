import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere } from "@/lib/branches";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { OrderItemForm } from "@/components/sales/order-item-form";
import { OrderStatusForm } from "@/components/sales/order-status-form";
import { deleteOrder, removeOrderItem } from "@/lib/actions/sales";
import { EdiSendButton } from "@/components/edi/edi-send-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { getReturnPolicy } from "@/lib/returns-policy";
import { isWithinReturnWindow, returnDeadline } from "@/lib/returns-math";

const statusTone = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  FULFILLED: "green",
  CANCELLED: "red",
} as const;

const returnStatusTone = {
  REQUESTED: "yellow",
  APPROVED: "blue",
  RECEIVED: "blue",
  REFUNDED: "green",
  REJECTED: "red",
} as const;

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const order = await db.order.findUnique({
    where: { id, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      customer: true,
      items: { include: { product: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
      returns: {
        select: { id: true, rmaNumber: true, status: true, refundAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) notFound();

  const returnPolicy = await getReturnPolicy(session.companyId);
  const shipped = await db.lotMovement.findMany({
    where: { orderId: order.id, companyId: session.companyId, kind: "SALE" },
    select: { quantity: true, lot: { select: { lotNumber: true, productId: true } } },
  });
  const fulfilledAt = order.fulfilledAt ?? order.createdAt;
  const deadline = returnDeadline(fulfilledAt, returnPolicy.windowDays);
  const canOpenReturn =
    returnPolicy.enabled && order.status === "FULFILLED" && isWithinReturnWindow(fulfilledAt, returnPolicy.windowDays);

  const products = await db.product.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true, sku: true, unitPrice: true, stockQty: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
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
              <StatusBadge status={order.status} tone={statusTone[order.status]} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              Created {order.createdAt.toLocaleDateString()}
              {order.customerPoNumber && (
                <>
                  {" · "}Customer PO <span className="font-mono">{order.customerPoNumber}</span>
                </>
              )}
              {" · "}
              {order.invoice ? (
                <Link href={`/dashboard/invoicing/${order.invoice.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                  Invoice {order.invoice.invoiceNumber} ({order.invoice.status})
                </Link>
              ) : (
                <span className="text-slate-500">No invoice generated yet</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {order.status === "FULFILLED" && (
              <EdiSendButton docType="856" recordId={order.id} customerId={order.customer.id} />
            )}
            <OrderStatusForm orderId={order.id} status={order.status} />
            <DeleteButton action={deleteOrder.bind(null, order.id)} />
          </div>
        </div>

        <div className="mt-4">
          <ErrorBanner code={error} />
        </div>

        <Card className="mt-2">
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
                      {shipped.some((m) => m.lot.productId === item.productId) && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Shipped from{" "}
                          {shipped
                            .filter((m) => m.lot.productId === item.productId)
                            .map((m, i) => (
                              <span key={i}>
                                {i > 0 && ", "}
                                <Link
                                  href={`/dashboard/inventory/trace?q=${encodeURIComponent(m.lot.lotNumber)}`}
                                  className="font-mono text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800"
                                >
                                  {m.lot.lotNumber}
                                </Link>
                                {-m.quantity > 1 && ` (${-m.quantity})`}
                              </span>
                            ))}
                        </p>
                      )}
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

        {order.status === "FULFILLED" && (returnPolicy.enabled || order.returns.length > 0) && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Returns</CardTitle>
              {canOpenReturn && (
                <Link
                  href={`/dashboard/returns/new?orderId=${order.id}`}
                  className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 light:border-blue-600/30 light:bg-blue-600/10 light:text-blue-700 light:hover:bg-blue-600/15"
                >
                  Create return
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {order.returns.length > 0 ? (
                <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                  {order.returns.map((rma) => (
                    <li key={rma.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/dashboard/returns/${rma.id}`} className="font-mono font-medium text-slate-50 light:text-slate-900 hover:text-blue-400">
                        {rma.rmaNumber}
                      </Link>
                      <span className="flex items-center gap-3">
                        <span className="font-mono tabular-nums text-slate-400">${rma.refundAmount.toFixed(2)}</span>
                        <StatusBadge status={rma.status} tone={returnStatusTone[rma.status]} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No returns for this order.</p>
              )}
              {returnPolicy.enabled && (
                <p className="mt-3 text-xs text-slate-500">
                  {deadline
                    ? canOpenReturn
                      ? `Returnable until ${deadline.toLocaleDateString()}.`
                      : `The return window closed on ${deadline.toLocaleDateString()}.`
                    : "This business accepts returns with no time limit."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <p className="mt-6">
          <Link href="/dashboard/sales" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to orders
          </Link>
        </p>
      </div>
    </div>
  );
}
