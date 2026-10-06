"use server";

import { startOfDay } from "date-fns";
import { markOverdueInvoices } from "@/lib/invoice-number";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole, requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere, resolveNewRecordBranch } from "@/lib/branches";
import { logAudit } from "@/lib/audit";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { computeInvoiceTotal, computeInvoiceSubtotal, computeInvoiceTax } from "@/lib/invoicing-math";
import { createDraftInvoiceForOrder } from "@/lib/invoice-from-order";
import { takeInvoiceNumber } from "@/lib/invoice-number";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import {
  canChangeInvoiceStatus,
  canDeleteInvoice,
  canEditInvoice,
  escapeHtml,
  amountBlocker,
  balanceDue,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/invoice-rules";
import { issueCreditNote, recordPayment, removeCreditNote, removePayment } from "@/lib/invoice-payments";
import {
  InvoiceSchema,
  InvoiceLineItemSchema,
  InvoiceDetailsSchema,
  InvoiceStatusValues,
  type InvoiceFormState,
  type InvoiceLineItemFormState,
} from "@/lib/validation/invoicing";
import { quantityError } from "@/lib/quantity";
import { formatQty } from "@/lib/quantity";

async function recomputeInvoiceTotal(invoiceId: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, select: { taxRate: true } });
  if (!invoice) return;

  const items = await db.invoiceLineItem.findMany({
    where: { invoiceId },
    select: { quantity: true, unitPrice: true },
  });
  const totalAmount = computeInvoiceTotal(items, invoice.taxRate);
  await db.invoice.update({ where: { id: invoiceId }, data: { totalAmount } });
}

/** "Create invoice" on a confirmed or fulfilled order (lib/invoice-from-order.ts). */
export async function createInvoiceFromOrder(orderId: string) {
  const session = await verifySession();

  // Access first: locked employees only reach their own branch's orders.
  const order = await db.order.findUnique({
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { id: true },
  });
  if (!order) redirect("/dashboard/sales");

  const result = await createDraftInvoiceForOrder(session.companyId, orderId, { userId: session.userId });
  if (!result.ok) redirect(result.reason === "blocked" ? `/dashboard/sales/${orderId}?error=order-invoice-blocked` : "/dashboard/sales");

  revalidatePath("/dashboard/invoicing");
  revalidatePath(`/dashboard/sales/${orderId}`);
  redirect(`/dashboard/invoicing/${result.invoiceId}`);
}

export async function createInvoice(
  _state: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const session = await verifySession();

  const validated = InvoiceSchema.safeParse({
    customerId: formData.get("customerId"),
    dueDate: formData.get("dueDate"),
    taxRate: formData.get("taxRate"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const customer = await db.customer.findUnique({
    where: { id: validated.data.customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return { errors: { customerId: ["Select a valid customer."] } };
  }

  const dueDate = new Date(validated.data.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return { errors: { dueDate: ["Enter a valid date."] } };
  }

  const invoiceNumber = await takeInvoiceNumber(db, session.companyId);

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      customerId: customer.id,
      companyId: session.companyId,
      branchId: await resolveNewRecordBranch(formData),
      dueDate,
      taxRate: validated.data.taxRate,
    },
  });

  revalidatePath("/dashboard/invoicing");
  redirect(`/dashboard/invoicing/${invoice.id}`);
}

export async function updateInvoiceStatus(invoiceId: string, formData: FormData) {
  const session = await verifySession();

  const status = formData.get("status");
  if (
    typeof status !== "string" ||
    !InvoiceStatusValues.includes(status as (typeof InvoiceStatusValues)[number])
  ) {
    return;
  }
  const nextStatus = status as (typeof InvoiceStatusValues)[number];

  const current = await db.invoice.findUnique({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { status: true, invoiceNumber: true, totalAmount: true, amountPaid: true, amountCredited: true, branchId: true },
  });
  if (!current) return;
  // Only allowed steps (lib/invoice-rules.ts). Leaving Paid goes through
  // removing payments; Overdue is set by the sweep.
  if (!canChangeInvoiceStatus(current.status, nextStatus)) return;
  // Back to draft only before any money or credit is recorded.
  if (nextStatus === "DRAFT" && current.amountPaid + current.amountCredited > 0) return;

  if (nextStatus === "PAID") {
    // "Mark paid" is a payment of whatever is still owed, dated today; it
    // books that income (lib/invoice-payments.ts).
    const owed = balanceDue(current);
    await db.$transaction(async (tx) => {
      if (owed > 0) {
        await recordPayment(tx, {
          companyId: session.companyId,
          invoice: { id: invoiceId, invoiceNumber: current.invoiceNumber, branchId: current.branchId },
          amount: owed,
          paidAt: new Date(),
          method: "OTHER",
          userId: session.userId,
        });
      } else {
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
      }
    });
  } else {
    await db.invoice.update({ where: { id: invoiceId }, data: { status: nextStatus } });
  }

  await logAudit(session.companyId, session.userId, "invoice.status_changed", "Invoice", invoiceId, {
    status,
  });

  revalidatePath(`/dashboard/invoicing/${invoiceId}`);
  revalidatePath("/dashboard/invoicing");
  revalidatePath("/dashboard/accounting");
}

export async function sendInvoiceEmail(invoiceId: string) {
  const session = await verifySession();

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      customer: { select: { name: true, email: true } },
      companyRef: { select: { name: true, logoData: true, logoMimeType: true } },
      lineItems: { include: { product: { select: { unit: true } } } },
    },
  });
  if (!invoice) redirect("/dashboard/invoicing?error=invalid");
  if (!invoice.customer.email) redirect(`/dashboard/invoicing/${invoiceId}?error=no-email`);

  // Everything typed by people (descriptions, names) is escaped before it
  // goes into the email's HTML.
  const lineItemsHtml = invoice.lineItems
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.description)}</td><td>${formatQty(item.quantity, item.product?.unit)}</td><td>$${item.unitPrice.toFixed(2)}</td><td>$${(item.quantity * item.unitPrice).toFixed(2)}</td></tr>`
    )
    .join("");
  // Sending a draft makes it Sent, so the attached PDF says so too.
  const pdf = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    taxRate: invoice.taxRate,
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    amountCredited: invoice.amountCredited,
    companyName: invoice.companyRef.name,
    customerName: invoice.customer.name,
    customerEmail: invoice.customer.email,
    lineItems: invoice.lineItems.map((l) => ({ ...l, unit: l.product?.unit })),
    logoData: invoice.companyRef.logoData ? new Uint8Array(invoice.companyRef.logoData) : undefined,
    logoMimeType: invoice.companyRef.logoMimeType,
  });

  const subtotal = computeInvoiceSubtotal(invoice.lineItems);
  const taxAmount = computeInvoiceTax(subtotal, invoice.taxRate);
  const totalsHtml =
    invoice.taxRate > 0
      ? `<p>Subtotal: $${subtotal.toFixed(2)}<br/>Tax (${invoice.taxRate}%): $${taxAmount.toFixed(2)}<br/><strong>Total: $${invoice.totalAmount.toFixed(2)}</strong></p>`
      : `<p><strong>Total: $${invoice.totalAmount.toFixed(2)}</strong></p>`;

  try {
    await sendEmailForCompany(session.companyId, {
      to: invoice.customer.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${invoice.companyRef.name}`,
      html: `<p>Hi ${escapeHtml(invoice.customer.name)},</p><p>Please find invoice ${invoice.invoiceNumber} attached as a PDF and summarised below, due ${invoice.dueDate.toLocaleDateString()}.</p><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr>${lineItemsHtml}</table>${totalsHtml}<p>Thank you.</p>`,
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: Buffer.from(pdf) }],
    });
  } catch (err) {
    console.error(`[invoicing] send failed for invoice ${invoiceId}:`, err);
    redirect(`/dashboard/invoicing/${invoiceId}?error=send-failed`);
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      sentAt: new Date(),
      status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
    },
  });

  await logAudit(session.companyId, session.userId, "invoice.sent", "Invoice", invoiceId, {});

  revalidatePath(`/dashboard/invoicing/${invoiceId}`);
  revalidatePath("/dashboard/invoicing");
}

export async function deleteInvoice(invoiceId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/invoicing?error=forbidden");
  }

  // Never while income is booked against it, or Accounting would keep money
  // with no invoice behind it.
  const existing = await db.invoice.findUnique({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { status: true, _count: { select: { transactions: true } } },
  });
  if (!existing) redirect("/dashboard/invoicing");
  if (!canDeleteInvoice({ status: existing.status, hasBookedIncome: existing._count.transactions > 0 })) {
    redirect(`/dashboard/invoicing/${invoiceId}?error=invoice-delete-blocked`);
  }

  await db.invoice.delete({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
  });

  revalidatePath("/dashboard/invoicing");
  redirect("/dashboard/invoicing");
}

export async function addInvoiceLineItem(
  invoiceId: string,
  _state: InvoiceLineItemFormState,
  formData: FormData
): Promise<InvoiceLineItemFormState> {
  const session = await verifySession();

  const validated = InvoiceLineItemSchema.safeParse({
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    productId: formData.get("productId") || undefined,
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { id: true, status: true, amountPaid: true, amountCredited: true },
  });
  if (!invoice) {
    return { message: "Invoice not found." };
  }
  if (!canEditInvoice(invoice.status, invoice)) {
    return { message: "This invoice has payments or credit notes recorded, so its lines are locked. Remove them first." };
  }

  const { productId, ...rest } = validated.data;

  if (productId) {
    const product = await db.product.findUnique({
      where: { id: productId, companyId: session.companyId },
      select: { id: true, unit: true },
    });
    if (!product) {
      return { errors: { productId: ["Select a valid product."] } };
    }
    // A free text line (a service, hours) may take decimals; a product line
    // follows the product's own unit.
    const unitError = quantityError(rest.quantity, product.unit);
    if (unitError) return { errors: { quantity: [unitError] } };
  }

  await db.invoiceLineItem.create({
    data: { ...rest, invoiceId, productId: productId || undefined },
  });

  await recomputeInvoiceTotal(invoiceId);

  revalidatePath(`/dashboard/invoicing/${invoiceId}`);
  return undefined;
}

export async function removeInvoiceLineItem(invoiceId: string, itemId: string) {
  const session = await verifySession();

  // deleteMany: does nothing (rather than an error page) on a paid invoice.
  await db.invoiceLineItem.deleteMany({
    where: {
      id: itemId,
      invoiceId,
      invoice: { companyId: session.companyId, status: { not: "PAID" }, amountPaid: 0, amountCredited: 0, ...(await lockedWhere()) },
    },
  });

  await recomputeInvoiceTotal(invoiceId);

  revalidatePath(`/dashboard/invoicing/${invoiceId}`);
}

export async function updateDefaultTaxRate(formData: FormData) {
  const session = await requireRole(["OWNER"]);

  const taxRate = Number(formData.get("defaultTaxRate"));
  if (!Number.isFinite(taxRate) || taxRate < 0) {
    redirect("/dashboard/billing?error=invalid");
  }

  await db.company.update({ where: { id: session.companyId }, data: { defaultTaxRate: taxRate } });

  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?tax=updated");
}

/** Due date and tax rate of an unpaid invoice; the total follows the tax. */
export async function updateInvoiceDetails(invoiceId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/invoicing/${invoiceId}`;
  const parsed = InvoiceDetailsSchema.safeParse({ dueDate: formData.get("dueDate"), taxRate: formData.get("taxRate") });
  if (!parsed.success) redirect(`${back}?error=invalid`);

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { status: true, amountPaid: true, amountCredited: true },
  });
  if (!invoice) redirect("/dashboard/invoicing");
  if (!canEditInvoice(invoice.status, invoice)) redirect(`${back}?error=invoice-paid-locked`);

  await db.invoice.update({
    where: { id: invoiceId },
    data: { dueDate: new Date(parsed.data.dueDate), taxRate: parsed.data.taxRate },
  });
  await recomputeInvoiceTotal(invoiceId);
  // A new due date can make an overdue invoice current again, and back.
  await db.invoice.updateMany({
    where: { id: invoiceId, status: "OVERDUE", dueDate: { gte: startOfDay(new Date()) } },
    data: { status: "SENT" },
  });
  await markOverdueInvoices(session.companyId);

  await logAudit(session.companyId, session.userId, "invoice.details_changed", "Invoice", invoiceId, parsed.data);
  revalidatePath(back);
  revalidatePath("/dashboard/invoicing");
  redirect(back);
}

/** One line of an unpaid invoice: description, quantity and price. */
export async function updateInvoiceLineItem(invoiceId: string, itemId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/invoicing/${invoiceId}`;
  const parsed = InvoiceLineItemSchema.omit({ productId: true }).safeParse({
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) redirect(`${back}?error=invalid`);

  const { count } = await db.invoiceLineItem.updateMany({
    where: {
      id: itemId,
      invoiceId,
      invoice: { companyId: session.companyId, status: { not: "PAID" }, amountPaid: 0, amountCredited: 0, ...(await lockedWhere()) },
    },
    data: parsed.data,
  });
  if (count === 0) redirect(`${back}?error=invoice-paid-locked`);
  await recomputeInvoiceTotal(invoiceId);
  revalidatePath(back);
  redirect(back);
}

// ---------- Payments and credit notes ----------

class SettlementRejected extends Error {}

/** Records money received against an invoice (part or all of what's owed). */
export async function recordInvoicePayment(invoiceId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/invoicing/${invoiceId}`;
  const amount = Number(formData.get("amount"));
  const paidAtRaw = String(formData.get("paidAt") ?? "");
  const method = String(formData.get("method") ?? "") as PaymentMethod;
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 100);
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw) ? new Date(paidAtRaw) : null;
  if (!paidAt || paidAt.getTime() > Date.now()) redirect(`${back}?why=${encodeURIComponent("Enter the date it was paid, today or earlier.")}`);
  if (!PAYMENT_METHODS.some((m) => m.id === method)) redirect(`${back}?error=invalid`);

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { id: true, invoiceNumber: true, branchId: true },
  });
  if (!invoice) redirect("/dashboard/invoicing");

  try {
    await db.$transaction(async (tx) => {
      // Checked inside the transaction so two people can't both take the last of it.
      const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { totalAmount: true, amountPaid: true, amountCredited: true } });
      const blocker = amountBlocker(amount, balanceDue(current), "payment");
      if (blocker) throw new SettlementRejected(blocker);
      await recordPayment(tx, { companyId: session.companyId, invoice, amount, paidAt, method, reference, userId: session.userId });
    });
  } catch (e) {
    if (e instanceof SettlementRejected) redirect(`${back}?why=${encodeURIComponent(e.message)}`);
    throw e;
  }
  await logAudit(session.companyId, session.userId, "invoice.payment_recorded", "Invoice", invoiceId, { amount, method });
  revalidatePath(back);
  revalidatePath("/dashboard/invoicing");
  revalidatePath("/dashboard/accounting");
  redirect(back);
}

/** Removes a payment and the income it booked. Owners and admins only. */
export async function deleteInvoicePayment(invoiceId: string, paymentId: string) {
  const session = await verifySession();
  const back = `/dashboard/invoicing/${invoiceId}`;
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) }, select: { id: true } });
  if (!invoice) redirect("/dashboard/invoicing");

  const result = await db.$transaction((tx) => removePayment(tx, session.companyId, invoiceId, paymentId));
  if (result) await logAudit(session.companyId, session.userId, "invoice.payment_removed", "Invoice", invoiceId, { status: result.status });
  revalidatePath(back);
  revalidatePath("/dashboard/invoicing");
  revalidatePath("/dashboard/accounting");
  redirect(back);
}

/** A credit note: lowers what the customer owes, books nothing. Owners and admins only. */
export async function createCreditNote(invoiceId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/invoicing/${invoiceId}`;
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!reason) redirect(`${back}?why=${encodeURIComponent("Give the credit note a reason the customer will see.")}`);

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) }, select: { id: true } });
  if (!invoice) redirect("/dashboard/invoicing");

  let creditNumber = "";
  try {
    await db.$transaction(async (tx) => {
      const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { totalAmount: true, amountPaid: true, amountCredited: true } });
      const blocker = amountBlocker(amount, balanceDue(current), "credit note");
      if (blocker) throw new SettlementRejected(blocker);
      creditNumber = (await issueCreditNote(tx, { companyId: session.companyId, invoiceId, amount, reason, userId: session.userId })).creditNumber;
    });
  } catch (e) {
    if (e instanceof SettlementRejected) redirect(`${back}?why=${encodeURIComponent(e.message)}`);
    throw e;
  }
  await logAudit(session.companyId, session.userId, "invoice.credit_note_issued", "Invoice", invoiceId, { creditNumber, amount });
  revalidatePath(back);
  revalidatePath("/dashboard/invoicing");
  redirect(back);
}

export async function deleteCreditNote(invoiceId: string, creditNoteId: string) {
  const session = await verifySession();
  const back = `/dashboard/invoicing/${invoiceId}`;
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) }, select: { id: true } });
  if (!invoice) redirect("/dashboard/invoicing");

  const result = await db.$transaction((tx) => removeCreditNote(tx, session.companyId, invoiceId, creditNoteId));
  if (result) await logAudit(session.companyId, session.userId, "invoice.credit_note_removed", "Invoice", invoiceId, {});
  revalidatePath(back);
  revalidatePath("/dashboard/invoicing");
  redirect(back);
}
