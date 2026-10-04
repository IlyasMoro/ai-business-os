"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole, requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere, resolveNewRecordBranch } from "@/lib/branches";
import { logAudit } from "@/lib/audit";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { computeInvoiceTotal, computeInvoiceSubtotal, computeInvoiceTax } from "@/lib/invoicing-math";
import { invoiceBlocker } from "@/lib/order-rules";
import { takeInvoiceNumber } from "@/lib/invoice-number";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import {
  canChangeInvoiceStatus,
  canDeleteInvoice,
  canEditInvoice,
  escapeHtml,
  statusAfterUndoPayment,
} from "@/lib/invoice-rules";
import {
  InvoiceSchema,
  InvoiceLineItemSchema,
  InvoiceStatusValues,
  type InvoiceFormState,
  type InvoiceLineItemFormState,
} from "@/lib/validation/invoicing";

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

/** Draft invoice from a confirmed or fulfilled order: its lines at the
 * order's prices, the company's default tax rate, due in 30 days, the same
 * customer and branch, and linked to the order (Invoice.orderId is unique,
 * so a double click can't make two). */
export async function createInvoiceFromOrder(orderId: string) {
  const session = await verifySession();

  const order = await db.order.findUnique({
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
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
  if (!order) redirect("/dashboard/sales");
  if (order.invoice) redirect(`/dashboard/invoicing/${order.invoice.id}`);
  if (invoiceBlocker({ status: order.status, hasInvoice: false, itemCount: order.items.length })) {
    redirect(`/dashboard/sales/${orderId}?error=order-invoice-blocked`);
  }

  const company = await db.company.findUnique({ where: { id: session.companyId }, select: { defaultTaxRate: true } });
  const taxRate = company?.defaultTaxRate ?? 0;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  let invoiceId: string;
  try {
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: await takeInvoiceNumber(db, session.companyId),
        customerId: order.customerId,
        companyId: session.companyId,
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
    // Someone else invoiced it a moment ago: open that invoice instead.
    const existing = await db.invoice.findUnique({ where: { orderId }, select: { id: true } });
    if (existing) redirect(`/dashboard/invoicing/${existing.id}`);
    throw e;
  }

  await logAudit(session.companyId, session.userId, "invoice.created_from_order", "Invoice", invoiceId, { order: order.orderNumber });
  revalidatePath("/dashboard/invoicing");
  revalidatePath(`/dashboard/sales/${orderId}`);
  redirect(`/dashboard/invoicing/${invoiceId}`);
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
    select: { status: true, invoiceNumber: true, totalAmount: true, branchId: true },
  });
  if (!current) return;
  // Only allowed steps (lib/invoice-rules.ts). Leaving Paid goes through
  // undoInvoicePayment; Overdue is set by the sweep.
  if (!canChangeInvoiceStatus(current.status, nextStatus)) return;

  // Marking PAID is what actually books the income — without this, revenue
  // recorded on the invoice never shows up in Accounting/the P&L.
  const isNewlyPaid = nextStatus === "PAID" && current.status !== "PAID";

  await db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: nextStatus },
    });

    if (isNewlyPaid) {
      const alreadyLinked = await tx.transaction.findFirst({
        where: { invoiceId },
        select: { id: true },
      });
      if (!alreadyLinked) {
        await tx.transaction.create({
          data: {
            companyId: session.companyId,
            type: "INCOME",
            category: "Invoice payment",
            amount: current.totalAmount,
            description: `Payment for invoice ${current.invoiceNumber}`,
            invoiceId,
            // Income belongs to the branch that raised the invoice.
            branchId: current.branchId,
          },
        });
      }
    }
  });

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
      lineItems: true,
    },
  });
  if (!invoice) redirect("/dashboard/invoicing?error=invalid");
  if (!invoice.customer.email) redirect(`/dashboard/invoicing/${invoiceId}?error=no-email`);

  // Everything typed by people (descriptions, names) is escaped before it
  // goes into the email's HTML.
  const lineItemsHtml = invoice.lineItems
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>$${item.unitPrice.toFixed(2)}</td><td>$${(item.quantity * item.unitPrice).toFixed(2)}</td></tr>`
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
    companyName: invoice.companyRef.name,
    customerName: invoice.customer.name,
    customerEmail: invoice.customer.email,
    lineItems: invoice.lineItems,
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

/** Takes a paid invoice back to unpaid: removes the income its payment
 * booked in Accounting and returns it to Sent, or Overdue when past due.
 * Owners and admins only, as it changes the books. */
export async function undoInvoicePayment(invoiceId: string) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`/dashboard/invoicing/${invoiceId}?error=forbidden`);

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { status: true, dueDate: true },
  });
  if (!invoice || invoice.status !== "PAID") redirect(`/dashboard/invoicing/${invoiceId}`);

  const nextStatus = statusAfterUndoPayment(invoice.dueDate);
  const removed = await db.$transaction(async (tx) => {
    const { count } = await tx.transaction.deleteMany({
      where: { invoiceId, companyId: session.companyId, type: "INCOME", category: "Invoice payment" },
    });
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: nextStatus } });
    return count;
  });

  await logAudit(session.companyId, session.userId, "invoice.payment_undone", "Invoice", invoiceId, {
    status: nextStatus,
    incomeRemoved: removed,
  });
  revalidatePath(`/dashboard/invoicing/${invoiceId}`);
  revalidatePath("/dashboard/invoicing");
  revalidatePath("/dashboard/accounting");
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
    select: { id: true, status: true },
  });
  if (!invoice) {
    return { message: "Invoice not found." };
  }
  if (!canEditInvoice(invoice.status)) {
    return { message: "A paid invoice can't change. Undo the payment first." };
  }

  const { productId, ...rest } = validated.data;

  if (productId) {
    const product = await db.product.findUnique({
      where: { id: productId, companyId: session.companyId },
      select: { id: true },
    });
    if (!product) {
      return { errors: { productId: ["Select a valid product."] } };
    }
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
    where: { id: itemId, invoiceId, invoice: { companyId: session.companyId, status: { not: "PAID" }, ...(await lockedWhere()) } },
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
