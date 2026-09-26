import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere } from "@/lib/branches";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PurchaseOrderItemForm } from "@/components/procurement/purchase-order-item-form";
import { PurchaseOrderStatusForm } from "@/components/procurement/purchase-order-status-form";
import { deletePurchaseOrder, removePurchaseOrderItem } from "@/lib/actions/procurement";
import { EdiSendButton } from "@/components/edi/edi-send-button";
import { BackButton } from "@/components/ui-dark/back-button";
import { BranchTag } from "@/components/layout/branch-tag";

const statusTone = {
  DRAFT: "slate",
  ORDERED: "blue",
  RECEIVED: "green",
  CANCELLED: "red",
} as const;

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const purchaseOrder = await db.purchaseOrder.findUnique({
    where: { id, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      branch: { select: { name: true } },
      supplier: true,
      items: { include: { product: true } },
    },
  });

  if (!purchaseOrder) notFound();

  const products = await db.product.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true, sku: true, cost: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/procurement" label="Back to purchase orders" />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
                Purchase order for {purchaseOrder.supplier.name}
              </h1>
              <StatusBadge status={purchaseOrder.status} tone={statusTone[purchaseOrder.status]} />
              <BranchTag name={purchaseOrder.branch?.name} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              Created {purchaseOrder.createdAt.toLocaleDateString()}
              {purchaseOrder.expectedDate && (
                <> · Expected {purchaseOrder.expectedDate.toLocaleDateString()}</>
              )}
              {purchaseOrder.receivedAt && (
                <>
                  {" "}
                  · Received {purchaseOrder.receivedAt.toLocaleDateString()}
                  {purchaseOrder.expectedDate && (
                    <span className={purchaseOrder.receivedAt <= purchaseOrder.expectedDate ? "text-emerald-400" : "text-red-400"}>
                      {" "}
                      ({purchaseOrder.receivedAt <= purchaseOrder.expectedDate ? "on time" : "late"})
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EdiSendButton docType="850" recordId={purchaseOrder.id} supplierId={purchaseOrder.supplierId} />
            {purchaseOrder.status !== "RECEIVED" &&
              purchaseOrder.status !== "CANCELLED" &&
              purchaseOrder.items.some((i) => i.product.trackingMode !== "NONE") && (
                <Link
                  href={`/dashboard/procurement/${purchaseOrder.id}/receive`}
                  className="whitespace-nowrap rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 light:border-blue-600/30 light:bg-blue-600/10 light:text-blue-700 light:hover:bg-blue-600/15"
                >
                  Receive with lots
                </Link>
              )}
            <PurchaseOrderStatusForm purchaseOrderId={purchaseOrder.id} status={purchaseOrder.status} />
            <DeleteButton action={deletePurchaseOrder.bind(null, purchaseOrder.id)} />
          </div>
        </div>

        <ErrorBanner code={error} />
        {purchaseOrder.autoCreated && purchaseOrder.status === "DRAFT" && (
          <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 light:text-amber-800">
            Drafted by automation because stock ran low. Nothing is ordered until an owner or admin checks it and moves it to
            Ordered, or deletes it.
          </p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            {purchaseOrder.items.length > 0 && (
              <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                {purchaseOrder.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-50 light:text-slate-900">{item.product.name}</p>
                      <p className="font-mono text-xs tabular-nums text-slate-500">
                        {item.quantity} × ${item.unitCost.toFixed(2)} = $
                        {(item.quantity * item.unitCost).toFixed(2)}
                      </p>
                    </div>
                    <DeleteButton
                      action={removePurchaseOrderItem.bind(null, purchaseOrder.id, item.id)}
                      confirmMessage="Remove this item?"
                      label=""
                    />
                  </li>
                ))}
              </ul>
            )}
            <PurchaseOrderItemForm purchaseOrderId={purchaseOrder.id} products={products} />
            <p className="mt-4 text-right font-mono text-sm font-semibold tabular-nums text-amber-400">
              Total: ${purchaseOrder.totalAmount.toFixed(2)}
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
