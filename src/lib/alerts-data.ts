import "server-only";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { getInventorySettings } from "@/lib/lots";
import { expiryWarningCutoff, isExpired } from "@/lib/lot-math";
import { daysLate, daysSince, stalledBefore } from "@/lib/order-alerts";

/* Late orders and expiring stock, for the bell and the daily alert emails. */

export type LateOrders = {
  purchaseOrders: { id: string; poNumber: string; supplierName: string; daysLate: number }[];
  salesOrders: { id: string; orderNumber: string; customerName: string; daysWaiting: number }[];
};

/** Purchase orders placed but not received after their expected date, and
 * confirmed sales orders still not fulfilled after a week. Oldest first. */
export async function getLateOrders(companyId: string, take = 20): Promise<LateOrders> {
  const now = new Date();
  const [pos, sales] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { companyId, status: "ORDERED", expectedDate: { lt: startOfDay(now) } },
      select: { id: true, poNumber: true, expectedDate: true, supplier: { select: { name: true } } },
      orderBy: { expectedDate: "asc" },
      take,
    }),
    db.order.findMany({
      where: { companyId, status: "CONFIRMED", createdAt: { lt: stalledBefore(now) } },
      select: { id: true, orderNumber: true, createdAt: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take,
    }),
  ]);
  return {
    purchaseOrders: pos.map((p) => ({ id: p.id, poNumber: p.poNumber, supplierName: p.supplier.name, daysLate: daysLate(p.expectedDate!, now) })),
    salesOrders: sales.map((o) => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customer.name, daysWaiting: daysSince(o.createdAt, now) })),
  };
}

export type LotAlert = {
  lotId: string;
  productId: string;
  productName: string;
  lotNumber: string;
  quantity: number;
  branchName: string;
  expiresAt: Date;
  expired: boolean;
};

/** Lots with stock that have expired, or expire within the company's
 * warning window (Inventory settings). Soonest first. */
export async function getLotAlerts(companyId: string, take = 30): Promise<LotAlert[]> {
  const settings = await getInventorySettings(companyId);
  const lots = await db.stockLot.findMany({
    where: { companyId, quantity: { gt: 0 }, expiresAt: { not: null, lt: expiryWarningCutoff(settings.expiryWarningDays) } },
    select: {
      id: true,
      lotNumber: true,
      quantity: true,
      expiresAt: true,
      product: { select: { id: true, name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { expiresAt: "asc" },
    take,
  });
  return lots.map((l) => ({
    lotId: l.id,
    productId: l.product.id,
    productName: l.product.name,
    lotNumber: l.lotNumber,
    quantity: l.quantity,
    branchName: l.branch.name,
    expiresAt: l.expiresAt!,
    expired: isExpired(l),
  }));
}
