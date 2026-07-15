import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { LinkButton, Button } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { deleteProduct, applyReorderSuggestion } from "@/lib/actions/inventory";
import { Pencil } from "lucide-react";

const SALES_LOOKBACK_DAYS = 90;
const DEFAULT_LEAD_TIME_DAYS = 14;
const SAFETY_FACTOR = 1.5;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const product = await db.product.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!product) notFound();

  const since = new Date(new Date().getTime() - SALES_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [salesHistory, purchaseHistory] = await Promise.all([
    db.orderItem.findMany({
      where: { productId: product.id, order: { status: { not: "CANCELLED" } } },
      include: { order: { include: { customer: { select: { id: true, name: true } } } } },
      orderBy: { order: { createdAt: "desc" } },
      take: 10,
    }),
    db.purchaseOrderItem.findMany({
      where: { productId: product.id },
      include: { purchaseOrder: { include: { supplier: { select: { id: true, name: true } } } } },
      orderBy: { purchaseOrder: { createdAt: "desc" } },
      take: 10,
    }),
  ]);

  const recentSoldQty = await db.orderItem.aggregate({
    where: { productId: product.id, order: { status: { not: "CANCELLED" }, createdAt: { gte: since } } },
    _sum: { quantity: true },
  });
  const unitsSoldRecently = recentSoldQty._sum.quantity ?? 0;
  const dailyVelocity = unitsSoldRecently / SALES_LOOKBACK_DAYS;

  const receivedPurchases = purchaseHistory.filter((item) => item.purchaseOrder.receivedAt);
  const avgLeadTimeDays =
    receivedPurchases.length > 0
      ? receivedPurchases.reduce(
          (s, item) =>
            s +
            Math.max(
              0,
              (item.purchaseOrder.receivedAt!.getTime() - item.purchaseOrder.createdAt.getTime()) /
                (24 * 60 * 60 * 1000)
            ),
          0
        ) / receivedPurchases.length
      : DEFAULT_LEAD_TIME_DAYS;

  const suggestedReorderLevel =
    dailyVelocity > 0 ? Math.max(1, Math.ceil(dailyVelocity * avgLeadTimeDays * SAFETY_FACTOR)) : null;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="max-w-3xl">
        {error === "in-use" && (
          <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            This product can&apos;t be deleted because it&apos;s used in an existing order.
          </p>
        )}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{product.name}</h1>
              {product.stockQty <= product.reorderLevel && (
                <Badge tone="red">Low stock</Badge>
              )}
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">{product.sku}</p>
          </div>
          <div className="flex items-center gap-2">
            <LinkButton href={`/dashboard/inventory/${product.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </LinkButton>
            <DeleteButton action={deleteProduct.bind(null, product.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Cost</p>
              <p className="font-mono tabular-nums text-slate-50 light:text-slate-900">${product.cost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Unit price</p>
              <p className="font-mono tabular-nums text-slate-50 light:text-slate-900">${product.unitPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Stock quantity</p>
              <p className="font-mono tabular-nums text-slate-50 light:text-slate-900">{product.stockQty}</p>
            </div>
            <div>
              <p className="text-slate-500">Reorder level</p>
              <p className="font-mono tabular-nums text-slate-50 light:text-slate-900">{product.reorderLevel}</p>
            </div>
            {product.description && (
              <div className="col-span-2">
                <p className="text-slate-500">Description</p>
                <p className="whitespace-pre-wrap text-slate-50 light:text-slate-900">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {suggestedReorderLevel !== null && suggestedReorderLevel !== product.reorderLevel && (
          <Card className="mt-6 border-amber-500/30">
            <CardContent className="flex items-center justify-between gap-4 pt-5">
              <p className="text-sm text-slate-300 light:text-slate-600">
                Based on {unitsSoldRecently} units sold in the last {SALES_LOOKBACK_DAYS} days (
                {dailyVelocity.toFixed(2)}/day) and an average {avgLeadTimeDays.toFixed(0)}-day supplier lead
                time, a reorder level of{" "}
                <span className="font-mono font-semibold text-amber-400">{suggestedReorderLevel}</span> would
                keep you covered.
              </p>
              <form action={applyReorderSuggestion.bind(null, product.id, suggestedReorderLevel)}>
                <Button type="submit" variant="secondary" size="sm">
                  Apply
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Sales history</CardTitle>
          </CardHeader>
          <CardContent>
            {salesHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No sales yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {salesHistory.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      href={`/dashboard/sales/${item.order.id}`}
                      className="text-slate-300 light:text-slate-600 hover:text-blue-400"
                    >
                      {item.order.customer.name} · {item.order.createdAt.toLocaleDateString()}
                    </Link>
                    <span className="font-mono tabular-nums text-slate-500">
                      {item.quantity} × ${item.unitPrice.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Purchase history</CardTitle>
          </CardHeader>
          <CardContent>
            {purchaseHistory.length === 0 ? (
              <p className="text-sm text-slate-500">No purchases yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {purchaseHistory.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      href={`/dashboard/procurement/${item.purchaseOrder.id}`}
                      className="text-slate-300 light:text-slate-600 hover:text-blue-400"
                    >
                      {item.purchaseOrder.supplier.name} · {item.purchaseOrder.createdAt.toLocaleDateString()}
                    </Link>
                    <span className="font-mono tabular-nums text-slate-500">
                      {item.quantity} × ${item.unitCost.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/inventory" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to inventory
          </Link>
        </p>
      </div>
    </div>
  );
}
