import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { sendOrderConfirmation } from "@/lib/actions/sales";
import { buttonStyles } from "@/components/ui-dark/button";
import { notFound } from "next/navigation";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { stockBranchFor } from "@/lib/stock";
import { lockedWhere } from "@/lib/branches";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { OrderItemForm } from "@/components/sales/order-item-form";
import { OrderStatusForm } from "@/components/sales/order-status-form";
import { deleteOrder, removeOrderItem, updateOrderItem } from "@/lib/actions/sales";
import { Input } from "@/components/ui-dark/input";
import { createInvoiceFromOrder } from "@/lib/actions/invoicing";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { canDelete, canEditLines, invoiceBlocker } from "@/lib/order-rules";
import { EdiSendButton } from "@/components/edi/edi-send-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { getReturnPolicy } from "@/lib/returns-policy";
import { isWithinReturnWindow, returnDeadline } from "@/lib/returns-math";
import { BackButton } from "@/components/ui-dark/back-button";
import { BranchTag } from "@/components/layout/branch-tag";
import { formatQty, qtyStep } from "@/lib/quantity";

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
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { id } = await params;
  const { error, sent } = await searchParams;
  const session = await verifySession();

  const order = await db.order.findUnique({
    where: { id, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      branch: { select: { name: true } },
      customer: true,
      items: { include: { product: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
      quote: { select: { id: true, quoteNumber: true } },
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

  const editable = canEditLines(order.status);
  const canPrice = hasRole(session, ["OWNER", "ADMIN"]);
  const canInvoice = invoiceBlocker({ status: order.status, hasInvoice: Boolean(order.invoice), itemCount: order.items.length }) === null;

  // "In stock" means at this order's branch, where it will ship from.
  const stockBranchId = await stockBranchFor(session.companyId, order.branchId);
  const products = (
    await db.product.findMany({
      where: { companyId: session.companyId },
      select: {
        id: true,
        name: true,
        sku: true,
        unitPrice: true,
        unit: true,
        branchStock: { where: { branchId: stockBranchId }, select: { quantity: true } },
      },
      orderBy: { name: "asc" },
    })
  ).map(({ branchStock, ...p }) => ({ ...p, stockQty: branchStock[0]?.quantity ?? 0 }));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/sales" label="Back to orders" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
                <span className="font-mono">{order.orderNumber}</span>
                <span className="text-slate-500"> · </span>
                <Link href={`/dashboard/crm/${order.customer.id}`} className="hover:text-blue-400">
                  {order.customer.name}
                </Link>
              </h1>
              <StatusBadge status={order.status} tone={statusTone[order.status]} />
              <BranchTag name={order.branch?.name} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              Created {formatDate(order.createdAt)}
              {order.confirmationSentAt && <> · Confirmation emailed {formatDate(order.confirmationSentAt)}</>}
              {order.quote && (
                <>
                  {" · from quote "}
                  <Link href={`/dashboard/quotes/${order.quote.id}`} className="font-mono text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                    {order.quote.quoteNumber}
                  </Link>
                </>
              )}
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
                <span className="text-slate-500">Not invoiced yet</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {order.status !== "CANCELLED" && order.items.length > 0 && (
              <form action={sendOrderConfirmation.bind(null, order.id)}>
                <SubmitButton variant="secondary" pendingText="Sending...">
                  {order.confirmationSentAt ? "Resend confirmation" : "Email confirmation"}
                </SubmitButton>
              </form>
            )}
            <a href={`/api/orders/${order.id}/pdf`} target="_blank" rel="noreferrer" className={buttonStyles("secondary", "sm")}>
              PDF
            </a>
            {order.status === "FULFILLED" && (
              <EdiSendButton docType="856" recordId={order.id} customerId={order.customer.id} />
            )}
            {canInvoice && (
              <form action={createInvoiceFromOrder.bind(null, order.id)}>
                <SubmitButton pendingText="Creating...">Create invoice</SubmitButton>
              </form>
            )}
            <OrderStatusForm orderId={order.id} status={order.status} />
            {canDelete(order.status) && <DeleteButton action={deleteOrder.bind(null, order.id)} />}
          </div>
        </div>

        <div className="mt-4">
          {sent && (
          <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
            Emailed with the PDF attached.
          </p>
        )}
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
                  <li key={item.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-50 light:text-slate-900">{item.product.name}</p>
                      <p className="text-xs tabular-nums text-slate-500">
                        {formatQty(item.quantity, item.product.unit)} × {formatCurrency(item.unitPrice)} ={" "}
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </p>
                      {editable && (
                        <details className="mt-1">
                          <summary className="cursor-pointer list-none text-xs font-medium text-blue-400 hover:text-blue-300 light:text-blue-700">Edit</summary>
                          <form action={updateOrderItem.bind(null, order.id, item.id)} className="mt-2 flex flex-wrap items-end gap-2">
                            <Input name="quantity" type="number" min="0.001" step={qtyStep(item.product.unit)} defaultValue={item.quantity} required aria-label="Quantity" className="w-24" />
                            {canPrice && (
                              <Input name="unitPrice" type="number" min="0" step="0.01" defaultValue={item.unitPrice} aria-label="Unit price" className="w-28" />
                            )}
                            <SubmitButton variant="secondary" pendingText="Saving...">
                              Save
                            </SubmitButton>
                          </form>
                        </details>
                      )}
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
                    {editable && (
                      <DeleteButton
                        action={removeOrderItem.bind(null, order.id, item.id)}
                        confirmMessage="Remove this item?"
                        label=""
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable ? (
              <OrderItemForm orderId={order.id} products={products} />
            ) : (
              order.status !== "CANCELLED" && (
                <p className="text-xs text-slate-500">
                  Items are locked once an order is confirmed, so it keeps the credit and stock checks it passed.
                  {order.status === "CONFIRMED" && " Move it back to pending to change them."}
                </p>
              )
            )}
            <p className="mt-4 text-right text-sm font-semibold tabular-nums text-amber-400 light:text-amber-800">
              Total: {formatCurrency(order.totalAmount)}
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
                      <Link href={`/dashboard/returns/${rma.id}`} className="font-mono font-semibold text-slate-50 light:text-slate-900 hover:text-blue-400">
                        {rma.rmaNumber}
                      </Link>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums text-slate-400">{formatCurrency(rma.refundAmount)}</span>
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
                      ? `Returnable until ${formatDate(deadline)}.`
                      : `The return window closed on ${formatDate(deadline)}.`
                    : "This business accepts returns with no time limit."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
