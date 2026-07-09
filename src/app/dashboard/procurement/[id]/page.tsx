import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PurchaseOrderItemForm } from "@/components/procurement/purchase-order-item-form";
import { PurchaseOrderStatusForm } from "@/components/procurement/purchase-order-status-form";
import { deletePurchaseOrder, removePurchaseOrderItem } from "@/lib/actions/procurement";

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
    where: { id, companyId: session.companyId },
    include: {
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
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
                Purchase order for {purchaseOrder.supplier.name}
              </h1>
              <Badge tone={statusTone[purchaseOrder.status]}>{purchaseOrder.status}</Badge>
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              Created {purchaseOrder.createdAt.toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PurchaseOrderStatusForm purchaseOrderId={purchaseOrder.id} status={purchaseOrder.status} />
            <DeleteButton action={deletePurchaseOrder.bind(null, purchaseOrder.id)} />
          </div>
        </div>

        <ErrorBanner code={error} />

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

        <p className="mt-6">
          <Link href="/dashboard/procurement" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to purchase orders
          </Link>
        </p>
      </div>
    </div>
  );
}
