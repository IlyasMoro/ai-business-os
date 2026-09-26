import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { DEFAULT_MRP_SETTINGS, type MrpSettingsValues } from "@/lib/mrp-settings-presets";
import { explodeBom, runMrp, type BomEdge, type PlanRow } from "@/lib/mrp-math";

export const getMrpSettings = cache(async (companyId: string): Promise<MrpSettingsValues> => {
  const settings = await db.mrpSettings.findUnique({
    where: { companyId },
    select: { enabled: true, includePendingOrders: true, useSafetyStock: true, allowNegativeStock: true },
  });
  return settings ?? DEFAULT_MRP_SETTINGS;
});

function addTo(map: Map<string, number>, key: string, qty: number) {
  map.set(key, (map.get(key) ?? 0) + qty);
}

/** Loads everything the planning run needs for one company and runs it. */
export async function buildMrpPlan(companyId: string, settings: MrpSettingsValues): Promise<PlanRow[]> {
  const [products, bomLines, orderItems, purchaseItems, openWorkOrders, inTransit] = await Promise.all([
    db.product.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQty: true,
        reorderLevel: true,
        leadTimeDays: true,
        lotSize: true,
        preferredSupplierId: true,
      },
    }),
    db.bomLine.findMany({ where: { companyId }, select: { parentId: true, componentId: true, quantity: true } }),
    // Confirmed orders haven't left the building yet: stock is only taken
    // when they're fulfilled, so they're still demand to cover.
    db.orderItem.findMany({
      where: {
        order: {
          companyId,
          status: { in: settings.includePendingOrders ? ["PENDING", "CONFIRMED"] : ["CONFIRMED"] },
        },
      },
      select: { productId: true, quantity: true },
    }),
    // Draft purchase orders count as on order too, so a suggestion that
    // was already turned into a draft isn't suggested a second time.
    db.purchaseOrderItem.findMany({
      where: { purchaseOrder: { companyId, status: { in: ["DRAFT", "ORDERED"] } } },
      select: { productId: true, quantity: true },
    }),
    db.workOrder.findMany({
      where: { companyId, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      select: { productId: true, quantity: true },
    }),
    // Stock moving between branches has left stockQty but not the company,
    // so it counts as arriving, like an open purchase order.
    db.stockTransferItem.findMany({
      where: { transfer: { companyId, status: "SENT" } },
      select: { productId: true, quantity: true },
    }),
  ]);

  const bom: BomEdge[] = bomLines;
  const salesDemand = new Map<string, number>();
  for (const item of orderItems) addTo(salesDemand, item.productId, item.quantity);

  const scheduledReceipts = new Map<string, number>();
  for (const item of purchaseItems) addTo(scheduledReceipts, item.productId, item.quantity);
  for (const wo of openWorkOrders) addTo(scheduledReceipts, wo.productId, wo.quantity);
  for (const item of inTransit) addTo(scheduledReceipts, item.productId, item.quantity);

  const openWorkOrderDemand = new Map<string, number>();
  for (const wo of openWorkOrders) {
    const lines = bom.filter((b) => b.parentId === wo.productId);
    for (const { componentId, required } of explodeBom(lines, wo.quantity)) {
      addTo(openWorkOrderDemand, componentId, required);
    }
  }

  return runMrp({
    products: products.map((p) => ({ ...p, safetyStock: settings.useSafetyStock ? p.reorderLevel : 0 })),
    bom,
    salesDemand,
    scheduledReceipts,
    openWorkOrderDemand,
  });
}
