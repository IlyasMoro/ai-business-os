import "server-only";
import { db } from "@/lib/db";
import { lowStockAt } from "@/lib/stock";

export async function getBusinessSnapshot(companyId: string) {
  const [customerCount, openOrderCount, lowStock, outstandingInvoiceCount, openTicketCount, activeProjectCount] =
    await Promise.all([
      db.customer.count({ where: { companyId } }),
      db.order.count({ where: { companyId, status: { in: ["PENDING", "CONFIRMED"] } } }),
      lowStockAt(companyId, null),
      db.invoice.count({ where: { companyId, status: { in: ["SENT", "OVERDUE"] } } }),
      db.ticket.count({ where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.project.count({ where: { companyId, status: "ACTIVE" } }),
    ]);

  // A product counts once, however many branches are short of it.
  const lowStockCount = new Set(lowStock.map((r) => r.productId)).size;

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
    `${snapshot.lowStockCount} products low on stock at one or more branches`,
    `${snapshot.outstandingInvoiceCount} outstanding invoices (sent or overdue)`,
    `${snapshot.openTicketCount} open support tickets`,
    `${snapshot.activeProjectCount} active projects`,
  ]
    .map((line) => `- ${line}`)
    .join("\n");
}
