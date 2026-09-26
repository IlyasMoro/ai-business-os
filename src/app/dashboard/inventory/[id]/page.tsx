import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { LinkButton, Button } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { deleteProduct, applyReorderSuggestion, setBranchReorderLevel } from "@/lib/actions/inventory";
import { effectiveReorderLevel, isLowAtBranch } from "@/lib/stock-levels";
import { removeBomLine } from "@/lib/actions/mrp";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BomLineForm } from "@/components/mrp/bom-line-form";
import { PlanningFieldsForm } from "@/components/mrp/planning-fields-form";
import { getMrpSettings } from "@/lib/mrp";
import { getInventorySettings } from "@/lib/lots";
import { isExpired, isExpiringSoon } from "@/lib/lot-math";
import { setProductTracking } from "@/lib/actions/lots";
import { Select, Label, Input } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";
import { Pencil } from "lucide-react";

const SALES_LOOKBACK_DAYS = 90;
const DEFAULT_LEAD_TIME_DAYS = 14;
const SAFETY_FACTOR = 1.5;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; why?: string }>;
}) {
  const { id } = await params;
  const { error, saved, why } = await searchParams;
  const session = await verifySession();

  const product = await db.product.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      bomComponents: {
        include: { component: { select: { id: true, name: true, sku: true, cost: true, stockQty: true } } },
        orderBy: { component: { name: "asc" } },
      },
      usedInBoms: { include: { parent: { select: { id: true, name: true } } } },
    },
  });

  if (!product) notFound();

  const mrpSettings = await getMrpSettings(session.companyId);
  const inventory = await getInventorySettings(session.companyId);
  const lots =
    product.trackingMode === "NONE"
      ? []
      : await db.stockLot.findMany({
          where: { productId: product.id, quantity: { gt: 0 } },
          orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
          include: { branch: { select: { name: true } } },
          take: 200,
        });

  // Stock per branch. Everyone can see every branch's count (so staff can
  // point customers to another shop); only owners and admins set levels.
  const branches = await db.branch.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      stock: { where: { productId: product.id }, select: { quantity: true, reorderLevel: true } },
    },
  });
  const branchStock = branches
    .filter((b) => b.active || b.stock.length > 0)
    .map((b) => {
      const row = b.stock[0];
      const level = { reorderLevel: row?.reorderLevel ?? null, productReorderLevel: product.reorderLevel };
      return {
        id: b.id,
        name: b.name,
        stocked: !!row,
        quantity: row?.quantity ?? 0,
        reorderLevel: row?.reorderLevel ?? null,
        effectiveLevel: effectiveReorderLevel(level),
        low: !!row && isLowAtBranch({ quantity: row.quantity, ...level }),
      };
    });
  const multiBranch = branchStock.length > 1;
  const lowAnywhere = branchStock.some((b) => b.low);
  const canSetLevels = hasRole(session, ["OWNER", "ADMIN"]);
  const [otherProducts, suppliers] = mrpSettings.enabled
    ? await Promise.all([
        db.product.findMany({
          where: { companyId: session.companyId, id: { not: product.id } },
          select: { id: true, name: true, sku: true },
          orderBy: { name: "asc" },
        }),
        db.supplier.findMany({
          where: { companyId: session.companyId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];
  const rolledUpCost = product.bomComponents.reduce((sum, line) => sum + line.quantity * line.component.cost, 0);

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
      : product.leadTimeDays > 0
        ? product.leadTimeDays
        : DEFAULT_LEAD_TIME_DAYS;

  const suggestedReorderLevel =
    dailyVelocity > 0 ? Math.max(1, Math.ceil(dailyVelocity * avgLeadTimeDays * SAFETY_FACTOR)) : null;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="max-w-3xl">
        {error === "in-use" ? (
          <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            This product can&apos;t be deleted because it&apos;s used in an order, a bill of materials, or a work order.
          </p>
        ) : (
          <ErrorBanner code={error} />
        )}
        {why && (
          <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{why}</p>
        )}
        {saved && (
          <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Saved.
          </p>
        )}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{product.name}</h1>
              {lowAnywhere && (
                <Badge tone="red">{multiBranch ? `Low at ${branchStock.filter((b) => b.low).map((b) => b.name).join(", ")}` : "Low stock"}</Badge>
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

        {multiBranch && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Stock by branch</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                    <th className="py-2 font-medium">Branch</th>
                    <th className="py-2 text-right font-medium">On hand</th>
                    <th className="py-2 pl-6 font-medium">Reorder level</th>
                  </tr>
                </thead>
                <tbody>
                  {branchStock.map((b) => (
                    <tr key={b.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="py-2 text-slate-50 light:text-slate-900">
                        {b.name}
                        {b.low && <Badge tone="red" className="ml-2">Low</Badge>}
                        {!b.stocked && <span className="ml-2 text-xs text-slate-500">not stocked</span>}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{b.quantity}</td>
                      <td className="py-2 pl-6">
                        {canSetLevels ? (
                          <form action={setBranchReorderLevel.bind(null, product.id, b.id)} className="flex items-center gap-2">
                            <Input
                              name="reorderLevel"
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={b.reorderLevel ?? ""}
                              placeholder={`${product.reorderLevel} (default)`}
                              aria-label={`Reorder level at ${b.name}`}
                              className="w-32"
                            />
                            <SubmitButton pendingText="Saving..." variant="secondary">
                              Save
                            </SubmitButton>
                          </form>
                        ) : (
                          <span className="font-mono tabular-nums text-slate-300 light:text-slate-600">
                            {b.effectiveLevel}
                            {b.reorderLevel === null && <span className="ml-1 text-xs text-slate-500">(default)</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {suggestedReorderLevel !== null && suggestedReorderLevel !== product.reorderLevel && (
          <Card className="mt-6 border-amber-500/30">
            <CardContent className="flex items-center justify-between gap-4 pt-5">
              <p className="text-sm text-slate-300 light:text-slate-600">
                Based on {unitsSoldRecently} units sold in the last {SALES_LOOKBACK_DAYS} days (
                {dailyVelocity.toFixed(2)}/day) and an average {avgLeadTimeDays.toFixed(0)} day supplier lead
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
            <CardTitle>Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={setProductTracking.bind(null, product.id)} className="grid items-end gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="trackingMode">Track this product by</Label>
                <Select id="trackingMode" name="trackingMode" defaultValue={product.trackingMode}>
                  <option value="NONE">Quantity only</option>
                  <option value="LOT">Lot number</option>
                  <option value="SERIAL">Serial number (one per unit)</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <SettingToggle
                  name="tracksExpiry"
                  label="Track expiry dates"
                  description="Ask for an expiry date when receiving, and pick by it if your rule is first expiring first out."
                  defaultChecked={product.tracksExpiry}
                />
              </div>
              <div className="sm:col-span-3">
                <SubmitButton variant="secondary" pendingText="Saving...">
                  Save tracking
                </SubmitButton>
                <p className="mt-2 text-xs text-slate-500">
                  Stock already on hand becomes an opening lot when tracking starts.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {product.trackingMode !== "NONE" && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{product.trackingMode === "SERIAL" ? "Serials on hand" : "Lots on hand"}</CardTitle>
              <span className="text-xs text-slate-500">
                Picked {inventory.pickingRule === "FEFO" ? "first expiring first" : "oldest first"}
              </span>
            </CardHeader>
            <CardContent>
              {lots.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing on hand.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                  {lots.map((lot) => (
                    <li key={lot.id} className="flex items-center justify-between py-2 text-sm">
                      <Link
                        href={`/dashboard/inventory/trace?q=${encodeURIComponent(lot.lotNumber)}`}
                        className="font-mono text-slate-50 hover:text-blue-400 light:text-slate-900"
                      >
                        {lot.lotNumber}
                      </Link>
                      <span className="flex items-center gap-3">
                        {multiBranch && <span className="text-xs text-slate-400">{lot.branch.name}</span>}
                        {lot.expiresAt && (
                          <span className="text-xs text-slate-400">Expires {lot.expiresAt.toLocaleDateString()}</span>
                        )}
                        {isExpired(lot) ? (
                          <Badge tone="red">Expired</Badge>
                        ) : isExpiringSoon(lot, inventory.expiryWarningDays) ? (
                          <Badge tone="yellow">Expires soon</Badge>
                        ) : null}
                        <span className="font-mono tabular-nums text-slate-300">{lot.quantity}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {mrpSettings.enabled && (
          <>
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Planning</CardTitle>
              </CardHeader>
              <CardContent>
                <PlanningFieldsForm
                  productId={product.id}
                  leadTimeDays={product.leadTimeDays}
                  lotSize={product.lotSize}
                  preferredSupplierId={product.preferredSupplierId}
                  suppliers={suppliers}
                />
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Bill of materials</CardTitle>
                <Badge tone={product.bomComponents.length > 0 ? "purple" : "slate"}>
                  {product.bomComponents.length > 0 ? "Made in house" : "Bought in"}
                </Badge>
              </CardHeader>
              <CardContent>
                {product.bomComponents.length > 0 ? (
                  <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                    {product.bomComponents.map((line) => (
                      <li key={line.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <Link
                            href={`/dashboard/inventory/${line.component.id}`}
                            className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                          >
                            {line.component.name}
                          </Link>
                          <p className="font-mono text-xs tabular-nums text-slate-500">
                            {line.quantity} per unit × ${line.component.cost.toFixed(2)} · {line.component.stockQty} in stock
                          </p>
                        </div>
                        <DeleteButton
                          action={removeBomLine.bind(null, product.id, line.id)}
                          confirmMessage="Remove this component?"
                          label=""
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-4 text-sm text-slate-500">
                    No components. Add some to make this product in house with work orders.
                  </p>
                )}
                <BomLineForm productId={product.id} components={otherProducts} />
                {product.bomComponents.length > 0 && (
                  <p className="mt-4 text-right font-mono text-sm tabular-nums text-slate-400 light:text-slate-500">
                    Component cost per unit: <span className="font-semibold text-amber-400">${rolledUpCost.toFixed(2)}</span>
                  </p>
                )}
                {product.usedInBoms.length > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Used in:{" "}
                    {product.usedInBoms.map((line, i) => (
                      <span key={line.id}>
                        {i > 0 && ", "}
                        <Link href={`/dashboard/inventory/${line.parent.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                          {line.parent.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
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
