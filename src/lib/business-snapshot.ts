import "server-only";
import { db } from "@/lib/db";

export async function getBusinessSnapshot(companyId: string) {
  const [customerCount, openOrderCount, products, outstandingInvoiceCount, openTicketCount, activeProjectCount] =
    await Promise.all([
      db.customer.count({ where: { companyId } }),
      db.order.count({ where: { companyId, status: { in: ["PENDING", "CONFIRMED"] } } }),
      db.product.findMany({ where: { companyId }, select: { stockQty: true, reorderLevel: true } }),
      db.invoice.count({ where: { companyId, status: { in: ["SENT", "OVERDUE"] } } }),
      db.ticket.count({ where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.project.count({ where: { companyId, status: "ACTIVE" } }),
    ]);

  const lowStockCount = products.filter((p) => p.stockQty <= p.reorderLevel).length;

  return {
    customerCount,
    openOrderCount,
    lowStockCount,
    outstandingInvoiceCount,
    openTicketCount,
    activeProjectCount,
  };
}

export type BusinessSnapshot = Awaited<ReturnType<typeof getBusinessSnapshot>>;

export function formatSnapshotForPrompt(snapshot: BusinessSnapshot) {
  return [
    `${snapshot.customerCount} total customers`,
    `${snapshot.openOrderCount} open orders (pending or confirmed)`,
    `${snapshot.lowStockCount} products low on stock`,
    `${snapshot.outstandingInvoiceCount} outstanding invoices (sent or overdue)`,
    `${snapshot.openTicketCount} open support tickets`,
    `${snapshot.activeProjectCount} active projects`,
  ]
    .map((line) => `- ${line}`)
    .join("\n");
}
