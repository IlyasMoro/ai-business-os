"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { computeInvoiceTotal } from "@/lib/invoicing-math";
import {
  InvoiceSchema,
  InvoiceLineItemSchema,
  InvoiceStatusValues,
  type InvoiceFormState,
  type InvoiceLineItemFormState,
} from "@/lib/validation/invoicing";

async function recomputeInvoiceTotal(invoiceId: string) {
  const items = await db.invoiceLineItem.findMany({
    where: { invoiceId },
    select: { quantity: true, unitPrice: true },
  });
  const totalAmount = computeInvoiceTotal(items);
  await db.invoice.update({ where: { id: invoiceId }, data: { totalAmount } });
}

async function nextInvoiceNumber(companyId: string) {
  const count = await db.invoice.count({ where: { companyId } });
  return `INV-${String(count + 1).padStart(4, "0")}`;
}

export async function createInvoice(
  _state: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const session = await verifySession();

  const validated = InvoiceSchema.safeParse({
    customerId: formData.get("customerId"),
    dueDate: formData.get("dueDate"),
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

  const invoiceNumber = await nextInvoiceNumber(session.companyId);

  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      customerId: customer.id,
      companyId: session.companyId,
      dueDate,
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
    where: { id: invoiceId, companyId: session.companyId },
    select: { status: true, totalAmount: true },
  });
  if (!current) return;

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
            description: `Payment for invoice ${invoiceId}`,
            invoiceId,
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
    where: { id: invoiceId, companyId: session.companyId },
    include: {
      customer: { select: { name: true, email: true } },
      companyRef: { select: { name: true } },
      lineItems: true,
    },
  });
  if (!invoice) redirect("/dashboard/invoicing?error=invalid");
  if (!invoice.customer.email) redirect(`/dashboard/invoicing/${invoiceId}?error=no-email`);

  const lineItemsHtml = invoice.lineItems
    .map(
      (item) =>
        `<tr><td>${item.description}</td><td>${item.quantity}</td><td>$${item.unitPrice.toFixed(2)}</td><td>$${(item.quantity * item.unitPrice).toFixed(2)}</td></tr>`
    )
    .join("");

  try {
    await sendEmailForCompany(session.companyId, {
      to: invoice.customer.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${invoice.companyRef.name}`,
      html: `<p>Hi ${invoice.customer.name},</p><p>Please find your invoice ${invoice.invoiceNumber} below, due ${invoice.dueDate.toLocaleDateString()}.</p><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr>${lineItemsHtml}</table><p><strong>Total: $${invoice.totalAmount.toFixed(2)}</strong></p><p>Thank you.</p>`,
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

  await db.invoice.delete({
    where: { id: invoiceId, companyId: session.companyId },
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
    where: { id: invoiceId, companyId: session.companyId },
    select: { id: true },
  });
  if (!invoice) {
    return { message: "Invoice not found." };
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

  await db.invoiceLineItem.delete({
    where: { id: itemId, invoice: { companyId: session.companyId } },
  });

  await recomputeInvoiceTotal(invoiceId);

  revalidatePath(`/dashboard/invoicing/${invoiceId}`);
}
