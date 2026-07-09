import "server-only";
import { db } from "@/lib/db";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { needsReorder, computeReorderQuantity } from "@/lib/automation-rules";
import { computePurchaseOrderTotal } from "@/lib/procurement-math";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const STALE_TICKET_MS = 48 * 60 * 60 * 1000;
const STALE_LEAD_MS = 30 * 24 * 60 * 60 * 1000;
const LOCK_ID = "automations";
const LOCK_LEASE_MS = 10 * 60 * 1000;

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
  const lowStock = lowStockProducts.filter((p) => needsReorder(p.stockQty, p.reorderLevel));
  if (lowStock.length === 0) return;

  const alreadyOnOrder = await db.purchaseOrderItem.findMany({
    where: {
      productId: { in: lowStock.map((p) => p.id) },
      purchaseOrder: { companyId, status: { in: ["DRAFT", "ORDERED"] } },
    },
    select: { productId: true },
  });
  const alreadyOnOrderIds = new Set(alreadyOnOrder.map((i) => i.productId));
  const toOrder = lowStock.filter((p) => !alreadyOnOrderIds.has(p.id));
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
      quantity: computeReorderQuantity(p.stockQty, p.reorderLevel),
      unitCost: p.cost,
    })),
  });

  const items = await db.purchaseOrderItem.findMany({
    where: { purchaseOrderId: purchaseOrder.id },
    select: { quantity: true, unitCost: true },
  });
  const totalAmount = computePurchaseOrderTotal(items);
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

async function acquireLock(): Promise<boolean> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LOCK_LEASE_MS);

  // Atomic conditional update: only succeeds if no one holds the lease, or
  // the previous holder's lease expired (e.g. it crashed mid-run). Using a
  // row + WHERE condition rather than a Postgres advisory lock, since
  // advisory locks are tied to a specific DB connection, and Prisma's
  // pooling doesn't guarantee the acquire/release pair share one — a leaked
  // lock could block every future run.
  const claimed = await db.runLock.updateMany({
    where: { id: LOCK_ID, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: leaseUntil },
  });
  if (claimed.count > 0) return true;

  // First run ever: the singleton row doesn't exist yet. Creating it IS
  // claiming the lock (a fresh row has never been locked).
  try {
    await db.runLock.create({ data: { id: LOCK_ID, lockedUntil: leaseUntil } });
    return true;
  } catch {
    // Row was created by a concurrent caller between the updateMany and
    // this create — that caller holds the lock, not us.
    return false;
  }
}

async function releaseLock(): Promise<void> {
  await db.runLock.update({ where: { id: LOCK_ID }, data: { lockedUntil: null } });
}

export async function runAutomations() {
  if (!(await acquireLock())) {
    return { companiesProcessed: 0, skipped: true };
  }

  try {
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
  } finally {
    await releaseLock();
  }
}
