import "server-only";
import { db } from "@/lib/db";
import { systemBranchId } from "@/lib/branches";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { stockRows } from "@/lib/stock";
import { planRestock } from "@/lib/stock-levels";
import { formatTransferNumber, nextTransferSequence } from "@/lib/transfer-rules";
import { computePurchaseOrderTotal } from "@/lib/procurement-math";
import { getBusinessReportData } from "@/lib/business-report-data";
import { generateBusinessReportPdf } from "@/lib/report-pdf";
import { isReportDue } from "@/lib/report-schedule";
import { sendWebhookNotification } from "@/lib/webhook";
import { getCustomerOutstandingBalance } from "@/lib/customer-balance";
import { isApproachingCreditLimit } from "@/lib/credit-math";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const STALE_TICKET_MS = 48 * 60 * 60 * 1000;
const STALE_LEAD_MS = 30 * 24 * 60 * 60 * 1000;
const LOCK_ID = "automations";
const LOCK_LEASE_MS = 10 * 60 * 1000;

async function runOverdueInvoiceReminders(companyId: string, webhookUrl: string | null) {
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
      await sendWebhookNotification(
        webhookUrl,
        `Payment reminder sent to ${invoice.customer.name} for invoice ${invoice.invoiceNumber} ($${invoice.totalAmount.toFixed(2)})`,
        { event: "overdue_invoice_reminder", invoiceNumber: invoice.invoiceNumber, customer: invoice.customer.name, amount: invoice.totalAmount }
      );
    } catch (err) {
      console.error(`[automations] overdue reminder failed for invoice ${invoice.id}:`, err);
    }
  }
}

async function runLowStockReorder(companyId: string, webhookUrl: string | null) {
  // Restock low branches: first from other branches' spare stock (draft
  // transfers), then buy what is still missing (draft purchase orders, one
  // per branch). Everything is a draft marked autoCreated, so nothing moves
  // or is ordered until an owner or admin approves it.
  const rows = await stockRows(companyId, null);
  if (rows.length === 0) return;
  const mainBranchId = await systemBranchId(companyId);

  // Stock already on its way to a branch (an open transfer or purchase
  // order) is not asked for twice. Older orders without a branch count as
  // the main branch's.
  const [openTransfers, openOrders] = await Promise.all([
    db.stockTransferItem.findMany({
      where: { transfer: { companyId, status: { in: ["DRAFT", "SENT"] } } },
      select: { productId: true, transfer: { select: { toBranchId: true } } },
    }),
    db.purchaseOrderItem.findMany({
      where: { purchaseOrder: { companyId, status: { in: ["DRAFT", "ORDERED"] } } },
      select: { productId: true, purchaseOrder: { select: { branchId: true } } },
    }),
  ]);
  const skip = new Set([
    ...openTransfers.map((i) => `${i.transfer.toBranchId}:${i.productId}`),
    ...openOrders.map((i) => `${i.purchaseOrder.branchId ?? mainBranchId}:${i.productId}`),
  ]);

  const plan = planRestock(rows, skip);
  if (plan.transfers.length === 0 && plan.purchases.size === 0) return;

  const names = new Map(rows.map((r) => [r.productId, r.productName]));
  const branchNames = new Map(rows.map((r) => [r.branchId, r.branchName]));

  if (plan.transfers.length > 0) {
    const existing = await db.stockTransfer.findMany({ where: { companyId }, select: { transferNumber: true } });
    let sequence = nextTransferSequence(existing.map((t) => t.transferNumber));
    for (const route of plan.transfers) {
      const to = branchNames.get(route.toBranchId) ?? "a branch";
      const transfer = await db.stockTransfer.create({
        data: {
          companyId,
          transferNumber: formatTransferNumber(sequence++),
          fromBranchId: route.fromBranchId,
          toBranchId: route.toBranchId,
          autoCreated: true,
          note: `Suggested by automation: ${route.lines.map((l) => names.get(l.productId)).join(", ")} low at ${to}.`,
          items: { create: route.lines },
        },
        select: { id: true, transferNumber: true },
      });
      await sendWebhookNotification(
        webhookUrl,
        `Transfer ${transfer.transferNumber} suggested: ${branchNames.get(route.fromBranchId)} to ${to}, awaiting approval`,
        { event: "low_stock_transfer_suggested", transferId: transfer.id, from: branchNames.get(route.fromBranchId), to }
      );
    }
  }

  if (plan.purchases.size === 0) return;
  const supplier = await db.supplier.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!supplier) return;

  for (const [branchId, lines] of plan.purchases) {
    const products = await db.product.findMany({
      where: { id: { in: lines.map((l) => l.productId) }, companyId },
      select: { id: true, name: true, cost: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = lines
      .filter((l) => byId.has(l.productId))
      .map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: byId.get(l.productId)!.cost }));
    if (items.length === 0) continue;

    const totalAmount = computePurchaseOrderTotal(items);
    const purchaseOrder = await db.purchaseOrder.create({
      data: { companyId, supplierId: supplier.id, branchId, totalAmount, autoCreated: true, items: { create: items } },
      select: { id: true, branch: { select: { name: true } } },
    });

    const itemNames = items.map((i) => byId.get(i.productId)!.name);
    const where = purchaseOrder.branch ? ` at ${purchaseOrder.branch.name}` : "";
    await sendWebhookNotification(
      webhookUrl,
      `Reorder drafted${where} for ${itemNames.length} low stock product${itemNames.length === 1 ? "" : "s"}: ${itemNames.join(", ")}, awaiting approval`,
      { event: "low_stock_reorder", products: itemNames, purchaseOrderId: purchaseOrder.id, branch: purchaseOrder.branch?.name ?? null, totalAmount }
    );
  }
}

async function runStaleTicketEscalation(companyId: string, webhookUrl: string | null) {
  const cutoff = new Date(Date.now() - STALE_TICKET_MS);

  const staleTickets = await db.ticket.findMany({
    where: {
      companyId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      priority: { not: "HIGH" },
      createdAt: { lt: cutoff },
    },
    select: { id: true, subject: true },
  });
  if (staleTickets.length === 0) return;

  await db.ticket.updateMany({
    where: { id: { in: staleTickets.map((t) => t.id) } },
    data: { priority: "HIGH" },
  });

  for (const ticket of staleTickets) {
    await sendWebhookNotification(webhookUrl, `Ticket escalated to HIGH priority: "${ticket.subject}"`, {
      event: "ticket_escalated",
      subject: ticket.subject,
      ticketId: ticket.id,
    });
  }
}

async function runStaleLeadCleanup(companyId: string, webhookUrl: string | null) {
  const cutoff = new Date(Date.now() - STALE_LEAD_MS);

  const staleLeads = await db.customer.findMany({
    where: {
      companyId,
      status: "LEAD",
      createdAt: { lt: cutoff },
      orders: { none: {} },
    },
    select: { id: true, name: true },
  });
  if (staleLeads.length === 0) return;

  await db.customer.updateMany({
    where: { id: { in: staleLeads.map((c) => c.id) } },
    data: { status: "INACTIVE" },
  });

  await sendWebhookNotification(
    webhookUrl,
    `${staleLeads.length} stale lead${staleLeads.length === 1 ? "" : "s"} marked inactive: ${staleLeads.map((c) => c.name).join(", ")}`,
    { event: "stale_leads_cleaned", count: staleLeads.length, leads: staleLeads.map((c) => c.name) }
  );
}

/** Proactive counterpart to the credit check in src/lib/actions/sales.ts.
 * That check only blocks an order at the moment someone tries to confirm
 * it, so without this a business only finds out a customer is over their
 * limit when a real order gets rejected. This warns Owners and Admins
 * once a customer's outstanding balance reaches CREDIT_WARNING_THRESHOLD
 * of their limit, same cooldown convention as the overdue reminder above,
 * so it will not fire again for the same customer within 24 hours. */
async function runCreditLimitWarnings(companyId: string, webhookUrl: string | null) {
  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - REMINDER_COOLDOWN_MS);

  const candidates = await db.customer.findMany({
    where: {
      companyId,
      creditLimit: { not: null },
      OR: [{ creditWarningSentAt: null }, { creditWarningSentAt: { lt: cooldownCutoff } }],
    },
    select: { id: true, name: true, creditLimit: true },
  });
  if (candidates.length === 0) return;

  const recipients = await db.user.findMany({
    where: { companyId, role: { in: ["OWNER", "ADMIN"] } },
    select: { email: true, name: true },
  });

  for (const customer of candidates) {
    const outstandingBalance = await getCustomerOutstandingBalance(customer.id);
    if (!isApproachingCreditLimit(outstandingBalance, customer.creditLimit)) continue;

    const percent = Math.round((outstandingBalance / customer.creditLimit!) * 100);

    for (const recipient of recipients) {
      try {
        await sendEmailForCompany(companyId, {
          to: recipient.email,
          subject: `Credit limit alert: ${customer.name}`,
          html: `<p>Hi ${recipient.name},</p><p>${customer.name} now owes $${outstandingBalance.toFixed(2)} against a credit limit of $${customer.creditLimit!.toFixed(2)}, ${percent}% of their limit. The next order that would push them over will be blocked automatically until this is resolved.</p><p>Consider following up for payment, or raising their limit if that fits the relationship.</p>`,
        });
      } catch (err) {
        console.error(`[automations] credit limit warning email failed for ${recipient.email}:`, err);
      }
    }

    await db.customer.update({ where: { id: customer.id }, data: { creditWarningSentAt: now } });

    await sendWebhookNotification(
      webhookUrl,
      `Credit limit alert: ${customer.name} is at ${percent}% of their $${customer.creditLimit!.toFixed(2)} limit ($${outstandingBalance.toFixed(2)} owed)`,
      { event: "credit_limit_warning", customer: customer.name, outstandingBalance, creditLimit: customer.creditLimit, percent }
    );
  }
}

/** Emails the same PDF business report the Reports page can generate
 * on demand (src/app/api/reports/pdf) to every Owner/Admin at the company,
 * then stamps lastReportSentAt so the next due check starts a fresh
 * interval — same notify-once-per-period convention as the reminder/
 * escalation rules above. */
async function sendScheduledReport(companyId: string) {
  const [company, recipients] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    db.user.findMany({
      where: { companyId, role: { in: ["OWNER", "ADMIN"] } },
      select: { email: true, name: true },
    }),
  ]);
  if (!company || recipients.length === 0) return;

  const data = await getBusinessReportData(companyId, company.name);
  const pdfBytes = await generateBusinessReportPdf(data);
  const attachment = { filename: `business-report-${new Date().toISOString().slice(0, 10)}.pdf`, content: Buffer.from(pdfBytes) };

  for (const recipient of recipients) {
    try {
      await sendEmailForCompany(companyId, {
        to: recipient.email,
        subject: `${company.name}: scheduled business report`,
        html: `<p>Hi ${recipient.name},</p><p>Attached is your scheduled business report: revenue, expenses, and order/invoice status for the trailing 6 months.</p>`,
        attachments: [attachment],
      });
    } catch (err) {
      console.error(`[automations] scheduled report email failed for ${recipient.email}:`, err);
    }
  }

  await db.automationSettings.update({ where: { companyId }, data: { lastReportSentAt: new Date() } });
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
          { creditLimitWarnings: true },
          { reportFrequency: { not: "OFF" } },
        ],
      },
    });

    for (const settings of companies) {
      try {
        if (settings.overdueInvoiceReminders) await runOverdueInvoiceReminders(settings.companyId, settings.webhookUrl);
        if (settings.lowStockReorder) await runLowStockReorder(settings.companyId, settings.webhookUrl);
        if (settings.staleTicketEscalation) await runStaleTicketEscalation(settings.companyId, settings.webhookUrl);
        if (settings.staleLeadCleanup) await runStaleLeadCleanup(settings.companyId, settings.webhookUrl);
        if (settings.creditLimitWarnings) await runCreditLimitWarnings(settings.companyId, settings.webhookUrl);
        if (isReportDue(settings.reportFrequency, settings.lastReportSentAt)) {
          await sendScheduledReport(settings.companyId);
        }
      } catch (err) {
        console.error(`[automations] run failed for company ${settings.companyId}:`, err);
      }
    }

    return { companiesProcessed: companies.length };
  } finally {
    await releaseLock();
  }
}
