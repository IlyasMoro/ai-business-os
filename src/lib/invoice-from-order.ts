import "server-only";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { computeInvoiceTotal } from "@/lib/invoicing-math";
import { takeInvoiceNumber } from "@/lib/invoice-number";
import { invoiceBlocker } from "@/lib/order-rules";

export type InvoiceFromOrderResult =
  | { ok: true; invoiceId: string; created: boolean }
  | { ok: false; reason: "not-found" | "blocked" };

/**
 * Draft invoice for a confirmed or fulfilled order: its lines at the order's
 * prices, the company's default tax rate, due in 30 days, the same customer
 * and branch, linked to the order. Used by the "Create invoice" button and by
 * the "draft invoice on fulfil" automation. Invoice.orderId is unique, so an
 * order never gets two; an existing invoice is returned instead. Callers
 * check the person's access to the order first.
 */
export async function createDraftInvoiceForOrder(
  companyId: string,
  orderId: string,
  /** The person who asked, or who fulfilled the order for the automation. */
  opts: { userId: string; automatic?: boolean }
): Promise<InvoiceFromOrderResult> {
  const order = await db.order.findFirst({
    where: { id: orderId, companyId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerId: true,
      branchId: true,
      invoice: { select: { id: true } },
      items: { select: { quantity: true, unitPrice: true, productId: true, product: { select: { name: true } } } },
    },
  });
  if (!order) return { ok: false, reason: "not-found" };
  if (order.invoice) return { ok: true, invoiceId: order.invoice.id, created: false };
  if (invoiceBlocker({ status: order.status, hasInvoice: false, itemCount: order.items.length })) return { ok: false, reason: "blocked" };

  const company = await db.company.findUnique({ where: { id: companyId }, select: { defaultTaxRate: true } });
  const taxRate = company?.defaultTaxRate ?? 0;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  let invoiceId: string;
  try {
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: await takeInvoiceNumber(db, companyId),
        customerId: order.customerId,
        companyId,
        branchId: order.branchId,
        orderId: order.id,
        dueDate,
        taxRate,
        totalAmount: computeInvoiceTotal(order.items, taxRate),
        lineItems: {
          create: order.items.map((item) => ({
            description: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productId: item.productId,
          })),
        },
      },
      select: { id: true },
    });
    invoiceId = invoice.id;
  } catch (e) {
    // Invoiced a moment ago by someone else: use that one.
    const existing = await db.invoice.findUnique({ where: { orderId }, select: { id: true } });
    if (existing) return { ok: true, invoiceId: existing.id, created: false };
    throw e;
  }

  await logAudit(companyId, opts.userId, "invoice.created_from_order", "Invoice", invoiceId, {
    order: order.orderNumber,
    ...(opts.automatic ? { automatic: true } : {}),
  });
  return { ok: true, invoiceId, created: true };
}
