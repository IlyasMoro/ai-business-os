import "server-only";
import { db } from "@/lib/db";

export type Notification = {
  id: string;
  severity: "high" | "medium";
  message: string;
  href: string;
};

export async function getNotifications(companyId: string): Promise<Notification[]> {
  const now = new Date();

  const [overdueInvoices, products, urgentTickets, pendingActions] = await Promise.all([
    db.invoice.findMany({
      where: {
        companyId,
        OR: [{ status: "OVERDUE" }, { status: "SENT", dueDate: { lt: now } }],
      },
      select: { id: true, invoiceNumber: true, customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    db.product.findMany({
      where: { companyId },
      select: { id: true, name: true, stockQty: true, reorderLevel: true },
    }),
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

  for (const p of products.filter((p) => p.stockQty <= p.reorderLevel).slice(0, 5)) {
    notifications.push({
      id: `product-${p.id}`,
      severity: "medium",
      message: `${p.name} is low on stock (${p.stockQty} left)`,
      href: `/dashboard/inventory/${p.id}`,
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
