import "server-only";
import { db } from "@/lib/db";
import { lowStockAt } from "@/lib/stock";

export type Notification = {
  id: string;
  severity: "high" | "medium";
  message: string;
  href: string;
};

export async function getNotifications(companyId: string): Promise<Notification[]> {
  const now = new Date();

  const [overdueInvoices, lowStock, branchCount, urgentTickets, pendingActions] = await Promise.all([
    db.invoice.findMany({
      where: {
        companyId,
        OR: [{ status: "OVERDUE" }, { status: "SENT", dueDate: { lt: now } }],
      },
      select: { id: true, invoiceNumber: true, customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    lowStockAt(companyId, null),
    db.branch.count({ where: { companyId, active: true } }),
    db.ticket.findMany({
      where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "HIGH" },
      select: { id: true, subject: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    db.aiAction.findMany({
      where: { companyId, status: "PENDING" },
      select: { id: true, summary: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);

  const notifications: Notification[] = [];

  for (const inv of overdueInvoices) {
    notifications.push({
      id: `invoice-${inv.id}`,
      severity: "high",
      message: `Invoice ${inv.invoiceNumber} for ${inv.customer.name} is overdue`,
      href: `/dashboard/invoicing/${inv.id}`,
    });
  }

  // Low stock is per branch; name the branch once there is more than one.
  for (const row of lowStock.slice(0, 5)) {
    const where = branchCount > 1 ? ` at ${row.branchName}` : "";
    notifications.push({
      id: `product-${row.productId}-${row.branchId}`,
      severity: "medium",
      message: `${row.productName} is low on stock${where} (${row.quantity} left)`,
      href: `/dashboard/inventory/${row.productId}`,
    });
  }

  for (const t of urgentTickets) {
    notifications.push({
      id: `ticket-${t.id}`,
      severity: "high",
      message: `High-priority ticket: ${t.subject}`,
      href: `/dashboard/support/${t.id}`,
    });
  }

  for (const a of pendingActions) {
    notifications.push({
      id: `ai-action-${a.id}`,
      severity: "medium",
      message: a.summary,
      href: `/dashboard/assistant`,
    });
  }

  return notifications;
}
