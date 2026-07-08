"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
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

  await db.invoice.update({
    where: { id: invoiceId, companyId: session.companyId },
    data: { status: status as (typeof InvoiceStatusValues)[number] },
  });

  await logAudit(session.companyId, session.userId, "invoice.status_changed", "Invoice", invoiceId, {
    status,
  });

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
