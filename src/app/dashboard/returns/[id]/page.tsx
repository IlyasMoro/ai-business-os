import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ReturnItemForm } from "@/components/returns/return-item-form";
import { ReturnStatusActions } from "@/components/returns/return-status-actions";
import { deleteReturn, removeReturnItem } from "@/lib/actions/returns";
import { getReturnPolicy } from "@/lib/returns-policy";
import { computeRefund, isReturnEditable, returnableQuantity, shouldRestock } from "@/lib/returns-math";

const statusTone = {
  REQUESTED: "yellow",
  APPROVED: "blue",
  RECEIVED: "blue",
  REFUNDED: "green",
  REJECTED: "red",
} as const;

const conditionTone = { RESELLABLE: "green", DAMAGED: "red" } as const;

export default async function ReturnDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const rma = await db.returnAuthorization.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      order: {
        include: {
          customer: { select: { id: true, name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      },
      items: { include: { product: { select: { name: true, sku: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!rma) notFound();

  const policy = await getReturnPolicy(session.companyId);
  const editable = isReturnEditable(rma.status);

  // Units already claimed per order line by every return that wasn't rejected.
  const claimed = await db.returnItem.groupBy({
    by: ["orderItemId"],
    where: { orderItemId: { in: rma.order.items.map((i) => i.id) }, rma: { status: { not: "REJECTED" } } },
    _sum: { quantity: true },
  });
  const claimedMap = new Map(claimed.map((c) => [c.orderItemId, c._sum.quantity ?? 0]));
  const orderItems = rma.order.items.map((item) => ({
    id: item.id,
    name: item.product.name,
    sku: item.product.sku,
    remaining: returnableQuantity(item.quantity, claimedMap.get(item.id) ?? 0),
  }));

  const { subtotal, fee, refund } = computeRefund(rma.items, rma.restockingFeePercent);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold text-slate-50 light:text-slate-900">{rma.rmaNumber}</h1>
              <StatusBadge status={rma.status} tone={statusTone[rma.status]} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              <Link href={`/dashboard/crm/${rma.order.customer.id}`} className="hover:text-blue-400">
                {rma.order.customer.name}
              </Link>
              {" · "}
              <Link href={`/dashboard/sales/${rma.order.id}`} className="text-blue-400 hover:text-blue-300">
                View order
              </Link>
              {" · "}Opened {rma.createdAt.toLocaleDateString()}
              {rma.receivedAt && <> · Received {rma.receivedAt.toLocaleDateString()}</>}
              {rma.refundedAt && <> · Refunded {rma.refundedAt.toLocaleDateString()}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReturnStatusActions returnId={rma.id} status={rma.status} />
            {rma.status !== "RECEIVED" && rma.status !== "REFUNDED" && (
              <DeleteButton action={deleteReturn.bind(null, rma.id)} confirmMessage="Delete this return?" />
            )}
          </div>
        </div>

        <div className="mt-4">
          <ErrorBanner code={error} />
        </div>

        <Card className="mt-2">
          <CardHeader>
            <CardTitle>Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-50 light:text-slate-900">{rma.reason}</p>
            {rma.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400 light:text-slate-500">{rma.notes}</p>}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Items being returned</CardTitle>
          </CardHeader>
          <CardContent>
            {rma.items.length > 0 ? (
              <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                {rma.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <p className="flex items-center gap-2 font-medium text-slate-50 light:text-slate-900">
                        {item.product.name}
                        <StatusBadge status={item.condition} tone={conditionTone[item.condition]} />
                      </p>
                      <p className="font-mono text-xs tabular-nums text-slate-500">
                        {item.quantity} × ${item.unitPrice.toFixed(2)} = ${(item.quantity * item.unitPrice).toFixed(2)}
                        {" · "}
                        {shouldRestock(item.condition, policy.restockDamaged) ? "goes back into stock" : "written off"}
                      </p>
                    </div>
                    {editable && (
                      <DeleteButton
                        action={removeReturnItem.bind(null, rma.id, item.id)}
                        confirmMessage="Remove this item?"
                        label=""
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-slate-500">No items yet. Add the products the customer is sending back.</p>
            )}

            {editable && <ReturnItemForm returnId={rma.id} orderItems={orderItems} />}

            <dl className="mt-4 space-y-1 text-right font-mono text-sm tabular-nums">
              <div className="text-slate-400 light:text-slate-500">
                Subtotal: ${subtotal.toFixed(2)}
              </div>
              {rma.restockingFeePercent > 0 && (
                <div className="text-slate-400 light:text-slate-500">
                  Restocking fee ({rma.restockingFeePercent}%): ${fee.toFixed(2)}
                </div>
              )}
              <div className="font-semibold text-amber-400">Refund: ${refund.toFixed(2)}</div>
            </dl>
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/returns" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to returns
          </Link>
        </p>
      </div>
    </div>
  );
}
