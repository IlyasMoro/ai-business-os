import "server-only";
import { db } from "@/lib/db";
import { sendEmailForCompany } from "@/lib/email-for-company";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const STALE_TICKET_MS = 48 * 60 * 60 * 1000;
const STALE_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

async function runOverdueInvoiceReminders(companyId: string) {
  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - REMINDER_COOLDOWN_MS);

  const invoices = await db.invoice.findMany({
    where: {
      companyId,
      OR: [{ status: "OVERDUE" }, { status: "SENT", dueDate: { lt: now } }],
      AND: [{ OR: [{ lastReminderSentAt: null }, { lastReminderSentAt: { lt: cooldownCutoff } }] }],
    },
    include: { customer: { select: { name: true, email: true } } },
  });

  for (const invoice of invoices) {
    if (!invoice.customer.email) continue;
    try {
      await sendEmailForCompany(companyId, {
        to: invoice.customer.email,
        subject: "Payment reminder: outstanding invoice",
        html: `<p>Hi ${invoice.customer.name},</p><p>This is a friendly automated reminder that invoice ${invoice.invoiceNumber} for $${invoice.totalAmount.toFixed(2)} (due ${invoice.dueDate.toLocaleDateString()}) is still outstanding.</p><p>Please arrange payment at your earliest convenience.</p>`,
      });
      await db.invoice.update({
        where: { id: invoice.id },
        data: { lastReminderSentAt: now },
      });
    } catch (err) {
      console.error(`[automations] overdue reminder failed for invoice ${invoice.id}:`, err);
    }
  }
}

async function runLowStockReorder(companyId: string) {
  const lowStockProducts = await db.product.findMany({
    where: { companyId },
    select: { id: true, name: true, cost: true, stockQty: true, reorderLevel: true },
  });
  const needsReorder = lowStockProducts.filter((p) => p.stockQty <= p.reorderLevel);
  if (needsReorder.length === 0) return;

  const alreadyOnOrder = await db.purchaseOrderItem.findMany({
    where: {
      productId: { in: needsReorder.map((p) => p.id) },
      purchaseOrder: { companyId, status: { in: ["DRAFT", "ORDERED"] } },
    },
    select: { productId: true },
  });
  const alreadyOnOrderIds = new Set(alreadyOnOrder.map((i) => i.productId));
  const toOrder = needsReorder.filter((p) => !alreadyOnOrderIds.has(p.id));
  if (toOrder.length === 0) return;

  const supplier = await db.supplier.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!supplier) return;

  const purchaseOrder = await db.purchaseOrder.create({
    data: { companyId, supplierId: supplier.id },
  });

  await db.purchaseOrderItem.createMany({
    data: toOrder.map((p) => ({
      purchaseOrderId: purchaseOrder.id,
      productId: p.id,
      quantity: Math.max(1, p.reorderLevel * 2 - p.stockQty),
      unitCost: p.cost,
    })),
  });

  const items = await db.purchaseOrderItem.findMany({
    where: { purchaseOrderId: purchaseOrder.id },
    select: { quantity: true, unitCost: true },
  });
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  await db.purchaseOrder.update({ where: { id: purchaseOrder.id }, data: { totalAmount } });
}

async function runStaleTicketEscalation(companyId: string) {
  const cutoff = new Date(Date.now() - STALE_TICKET_MS);

  await db.ticket.updateMany({
    where: {
      companyId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      priority: { not: "HIGH" },
      createdAt: { lt: cutoff },
    },
    data: { priority: "HIGH" },
  });
}

async function runStaleLeadCleanup(companyId: string) {
  const cutoff = new Date(Date.now() - STALE_LEAD_MS);

  const staleLeads = await db.customer.findMany({
    where: {
      companyId,
      status: "LEAD",
      createdAt: { lt: cutoff },
      orders: { none: {} },
    },
    select: { id: true },
  });
  if (staleLeads.length === 0) return;

  await db.customer.updateMany({
    where: { id: { in: staleLeads.map((c) => c.id) } },
    data: { status: "INACTIVE" },
  });
}

export async function runAutomations() {
  const companies = await db.automationSettings.findMany({
    where: {
      OR: [
        { overdueInvoiceReminders: true },
        { lowStockReorder: true },
        { staleTicketEscalation: true },
        { staleLeadCleanup: true },
      ],
    },
  });

  for (const settings of companies) {
    try {
      if (settings.overdueInvoiceReminders) await runOverdueInvoiceReminders(settings.companyId);
      if (settings.lowStockReorder) await runLowStockReorder(settings.companyId);
      if (settings.staleTicketEscalation) await runStaleTicketEscalation(settings.companyId);
      if (settings.staleLeadCleanup) await runStaleLeadCleanup(settings.companyId);
    } catch (err) {
      console.error(`[automations] run failed for company ${settings.companyId}:`, err);
    }
  }

  return { companiesProcessed: companies.length };
}
