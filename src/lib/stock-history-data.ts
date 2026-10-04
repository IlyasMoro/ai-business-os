import "server-only";
import { db } from "@/lib/db";
import type { StockAdjustmentReason, StockMovementKind } from "@/lib/stock-history";

export type StockHistoryRow = {
  id: string;
  kind: StockMovementKind;
  delta: number;
  quantityAfter: number;
  reason: StockAdjustmentReason | null;
  note: string | null;
  createdAt: Date;
  branchName: string;
  userName: string | null;
  /** The record behind the movement, ready to link: "SO-0012" and its page. */
  source: { label: string; href: string } | null;
};

/** A product's latest stock movements, newest first, with the order,
 * purchase order, transfer, return or work order behind each one. */
export async function getStockHistory(companyId: string, productId: string, take = 50): Promise<StockHistoryRow[]> {
  const rows = await db.stockMovement.findMany({
    where: { companyId, productId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      kind: true,
      delta: true,
      quantityAfter: true,
      reason: true,
      note: true,
      createdAt: true,
      orderId: true,
      purchaseOrderId: true,
      transferId: true,
      returnId: true,
      workOrderId: true,
      branch: { select: { name: true } },
      user: { select: { name: true } },
    },
  });

  const ids = (key: "orderId" | "transferId" | "returnId" | "workOrderId") =>
    [...new Set(rows.map((r) => r[key]).filter((v): v is string => Boolean(v)))];
  const [orders, transfers, returns, workOrders] = await Promise.all([
    db.order.findMany({ where: { companyId, id: { in: ids("orderId") } }, select: { id: true, orderNumber: true } }),
    db.stockTransfer.findMany({ where: { companyId, id: { in: ids("transferId") } }, select: { id: true, transferNumber: true } }),
    db.returnAuthorization.findMany({ where: { companyId, id: { in: ids("returnId") } }, select: { id: true, rmaNumber: true } }),
    db.workOrder.findMany({ where: { companyId, id: { in: ids("workOrderId") } }, select: { id: true, woNumber: true } }),
  ]);
  const name = <T extends { id: string }>(list: T[], id: string | null, pick: (t: T) => string) => {
    const found = id ? list.find((x) => x.id === id) : undefined;
    return found ? pick(found) : null;
  };

  return rows.map((r) => {
    // A return also carries its order; the return is the more useful link.
    let source: StockHistoryRow["source"] = null;
    const rma = name(returns, r.returnId, (x) => x.rmaNumber);
    const order = name(orders, r.orderId, (x) => x.orderNumber);
    const transfer = name(transfers, r.transferId, (x) => x.transferNumber);
    const wo = name(workOrders, r.workOrderId, (x) => x.woNumber);
    if (rma && r.returnId) source = { label: rma, href: `/dashboard/returns/${r.returnId}` };
    else if (order && r.orderId) source = { label: order, href: `/dashboard/sales/${r.orderId}` };
    else if (transfer && r.transferId) source = { label: transfer, href: `/dashboard/transfers/${r.transferId}` };
    else if (wo && r.workOrderId) source = { label: wo, href: `/dashboard/mrp/work-orders/${r.workOrderId}` };
    else if (r.purchaseOrderId) source = { label: "Purchase order", href: `/dashboard/procurement/${r.purchaseOrderId}` };

    return {
      id: r.id,
      kind: r.kind,
      delta: r.delta,
      quantityAfter: r.quantityAfter,
      reason: r.reason,
      note: r.note,
      createdAt: r.createdAt,
      branchName: r.branch.name,
      userName: r.user?.name ?? null,
      source,
    };
  });
}
