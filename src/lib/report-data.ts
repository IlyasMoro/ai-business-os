import "server-only";
import { db } from "@/lib/db";
import { salesSummary, stockValue } from "@/lib/report-math";

export const SALES_REPORT_DAYS = 90;

/** Stock value at cost, for one branch or the whole company. */
export async function getStockValueReport(companyId: string, branchId: string | null) {
  const rows = await db.branchStock.findMany({
    where: { companyId, ...(branchId ? { branchId } : {}), quantity: { gt: 0 } },
    select: {
      quantity: true,
      branchId: true,
      productId: true,
      branch: { select: { name: true } },
      product: { select: { name: true, cost: true } },
    },
  });
  const report = stockValue(
    rows.map((r) => ({
      branchId: r.branchId,
      branchName: r.branch.name,
      productId: r.productId,
      productName: r.product.name,
      quantity: r.quantity,
      cost: r.product.cost,
    }))
  );
  const missingCost = new Set(rows.filter((r) => r.product.cost === 0).map((r) => r.productId)).size;
  return { ...report, missingCost };
}

/** Sales from orders fulfilled in the last 90 days, for one branch or all. */
export async function getSalesReport(companyId: string, branchId: string | null) {
  const since = new Date(Date.now() - SALES_REPORT_DAYS * 24 * 60 * 60 * 1000);
  const items = await db.orderItem.findMany({
    where: { order: { companyId, status: "FULFILLED", fulfilledAt: { gte: since }, ...(branchId ? { branchId } : {}) } },
    select: { orderId: true, productId: true, quantity: true, unitPrice: true, product: { select: { name: true } } },
  });
  return salesSummary(items.map((i) => ({ orderId: i.orderId, productId: i.productId, productName: i.product.name, quantity: i.quantity, unitPrice: i.unitPrice })));
}
