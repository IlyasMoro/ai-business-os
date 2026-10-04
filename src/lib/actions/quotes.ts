"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { lockedWhere, resolveNewRecordBranch } from "@/lib/branches";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { Prisma } from "@/generated/prisma/client";
import { defaultValidUntil, acceptBlocker, isEditable, nextQuoteNumber, quoteTotal } from "@/lib/quotes";
import { isOpenStage } from "@/lib/crm-pipeline";

/* Quotes: priced offers to a customer that become an order once accepted.
   Every record is scoped to the signed-in company (and a locked employee's
   branch); ids from forms are checked before use. */

const LIST = "/dashboard/quotes";

export type QuoteItemFormState = { errors?: { productId?: string[]; quantity?: string[]; unitPrice?: string[] }; message?: string } | undefined;

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

function dateOrNull(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function findQuote(companyId: string, quoteId: string) {
  return db.quote.findFirst({
    where: { id: quoteId, companyId, ...(await lockedWhere()) },
    select: { id: true, status: true, validUntil: true, customerId: true, dealId: true, ownerId: true, quoteNumber: true },
  });
}

function revalidateQuote(quoteId: string, customerId: string, dealId?: string | null) {
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${quoteId}`);
  revalidatePath(`/dashboard/crm/${customerId}`);
  if (dealId) revalidatePath(`/dashboard/crm/deals/${dealId}`);
}

async function recomputeTotal(quoteId: string) {
  const items = await db.quoteItem.findMany({ where: { quoteId }, select: { quantity: true, unitPrice: true } });
  await db.quote.update({ where: { id: quoteId }, data: { totalAmount: quoteTotal(items) } });
}

/** Creates the quote with the next free number. Two people creating quotes
 * at the same moment can pick the same number; the unique index catches
 * that and the second one simply tries the next number. */
async function createWithNumber(companyId: string, data: Omit<Prisma.QuoteUncheckedCreateInput, "quoteNumber" | "companyId">) {
  for (let attempt = 0; ; attempt++) {
    const numbers = await db.quote.findMany({ where: { companyId }, select: { quoteNumber: true } });
    try {
      return await db.quote.create({ data: { ...data, companyId, quoteNumber: nextQuoteNumber(numbers.map((n) => n.quoteNumber)) } });
    } catch (e) {
      if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
}

// ---------- Create and edit ----------

export async function createQuote(formData: FormData) {
  const session = await verifySession();
  const customerId = text(formData, "customerId");
  const customer = customerId
    ? await db.customer.findFirst({ where: { id: customerId, companyId: session.companyId }, select: { id: true } })
    : null;
  if (!customer) redirect(`${LIST}/new?error=invalid`);

  const dealId = text(formData, "dealId");
  const deal = dealId
    ? await db.deal.findFirst({ where: { id: dealId, companyId: session.companyId, customerId: customer.id }, select: { id: true } })
    : null;

  const quote = await createWithNumber(session.companyId, {
    customerId: customer.id,
    dealId: deal?.id ?? null,
    ownerId: session.userId,
    branchId: await resolveNewRecordBranch(formData),
    validUntil: dateOrNull(text(formData, "validUntil")) ?? defaultValidUntil(),
    notes: text(formData, "notes")?.slice(0, 5000) ?? null,
  });
  await logAudit(session.companyId, session.userId, "quote.created", "Quote", quote.id, { quoteNumber: quote.quoteNumber });
  revalidateQuote(quote.id, customer.id, deal?.id);
  redirect(`${LIST}/${quote.id}`);
}

export async function updateQuoteDetails(quoteId: string, formData: FormData) {
  const session = await verifySession();
  const quote = await findQuote(session.companyId, quoteId);
  if (!quote) redirect(LIST);
  if (!isEditable(quote.status)) redirect(`${LIST}/${quoteId}?error=quote-locked`);

  await db.quote.update({
    where: { id: quoteId },
    data: {
      validUntil: dateOrNull(text(formData, "validUntil")),
      notes: text(formData, "notes")?.slice(0, 5000) ?? null,
    },
  });
  revalidateQuote(quoteId, quote.customerId, quote.dealId);
  redirect(`${LIST}/${quoteId}?saved=1`);
}

const QuoteItemSchema = z.object({
  productId: z.string().min(1, { error: "Select a product." }),
  quantity: z.coerce
    .number({ error: "Enter a valid quantity." })
    .int({ error: "Quantity must be a whole number." })
    .min(1, { error: "Quantity must be at least 1." })
    .max(1_000_000),
  unitPrice: z.coerce.number({ error: "Enter a valid price." }).min(0, { error: "Price can't be negative." }).max(1_000_000_000).optional(),
});

export async function addQuoteItem(quoteId: string, _state: QuoteItemFormState, formData: FormData): Promise<QuoteItemFormState> {
  const session = await verifySession();
  const parsed = QuoteItemSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    unitPrice: text(formData, "unitPrice"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const quote = await findQuote(session.companyId, quoteId);
  if (!quote) return { message: "Quote not found." };
  if (!isEditable(quote.status)) return { message: "This quote has been decided, so its lines can't change." };

  const product = await db.product.findFirst({
    where: { id: parsed.data.productId, companyId: session.companyId },
    select: { id: true, unitPrice: true },
  });
  if (!product) return { errors: { productId: ["Select a valid product."] } };

  await db.quoteItem.create({
    data: {
      quoteId,
      productId: product.id,
      quantity: parsed.data.quantity,
      // Left empty means the product's normal price.
      unitPrice: parsed.data.unitPrice ?? product.unitPrice,
    },
  });
  await recomputeTotal(quoteId);
  revalidateQuote(quoteId, quote.customerId, quote.dealId);
  return undefined;
}

export async function removeQuoteItem(quoteId: string, itemId: string) {
  const session = await verifySession();
  const quote = await findQuote(session.companyId, quoteId);
  if (!quote || !isEditable(quote.status)) return;
  await db.quoteItem.deleteMany({ where: { id: itemId, quoteId } });
  await recomputeTotal(quoteId);
  revalidateQuote(quoteId, quote.customerId, quote.dealId);
}

// ---------- Sending ----------

export async function markQuoteSent(quoteId: string) {
  const session = await verifySession();
  const quote = await findQuote(session.companyId, quoteId);
  if (!quote) redirect(LIST);
  if (quote.status !== "DRAFT") redirect(`${LIST}/${quoteId}`);
  await db.quote.update({ where: { id: quoteId }, data: { status: "SENT", sentAt: new Date() } });
  await logAudit(session.companyId, session.userId, "quote.sent", "Quote", quoteId, { by: "manual" });
  revalidateQuote(quoteId, quote.customerId, quote.dealId);
}

/** Emails the quote with its PDF attached and marks it sent. */
export async function emailQuote(quoteId: string) {
  const session = await verifySession();
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      customer: { select: { name: true, email: true } },
      companyRef: { select: { name: true, logoData: true, logoMimeType: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!quote) redirect(LIST);
  const back = `${LIST}/${quoteId}`;
  if (!isEditable(quote.status)) redirect(`${back}?error=quote-locked`);
  if (quote.items.length === 0) redirect(`${back}?error=quote-empty`);
  if (!quote.customer.email) redirect(`${back}?error=quote-no-email`);

  const lines = quote.items.map((i) => ({ description: i.product.name, quantity: i.quantity, unitPrice: i.unitPrice }));
  const pdf = await generateInvoicePdf({
    kind: "Quote",
    invoiceNumber: quote.quoteNumber,
    status: "SENT",
    issueDate: new Date(),
    dueDate: quote.validUntil ?? defaultValidUntil(),
    taxRate: 0,
    totalAmount: quote.totalAmount,
    companyName: quote.companyRef.name,
    customerName: quote.customer.name,
    customerEmail: quote.customer.email,
    lineItems: lines,
    notes: quote.notes,
    logoData: quote.companyRef.logoData ? new Uint8Array(quote.companyRef.logoData) : undefined,
    logoMimeType: quote.companyRef.logoMimeType,
  });

  const rows = lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.description)}</td><td>${l.quantity}</td><td>$${l.unitPrice.toFixed(2)}</td><td>$${(l.quantity * l.unitPrice).toFixed(2)}</td></tr>`
    )
    .join("");
  const validText = quote.validUntil ? `, valid until ${quote.validUntil.toLocaleDateString()}` : "";
  try {
    await sendEmailForCompany(session.companyId, {
      to: quote.customer.email,
      subject: `Quote ${quote.quoteNumber} from ${quote.companyRef.name}`,
      html: `<p>Hi ${escapeHtml(quote.customer.name)},</p><p>Here is our quote ${quote.quoteNumber}${validText}. The PDF is attached.</p><table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr>${rows}</table><p><strong>Total: $${quote.totalAmount.toFixed(2)}</strong></p>${quote.notes ? `<p>${escapeHtml(quote.notes).replace(/\n/g, "<br/>")}</p>` : ""}<p>Reply to this email to accept it or ask any questions.</p>`,
      attachments: [{ filename: `${quote.quoteNumber}.pdf`, content: Buffer.from(pdf) }],
    });
  } catch (err) {
    console.error(`[quotes] send failed for quote ${quoteId}:`, err);
    redirect(`${back}?error=quote-send-failed`);
  }

  await db.quote.update({ where: { id: quoteId }, data: { status: "SENT", sentAt: new Date() } });
  await db.crmActivity.create({
    data: {
      type: "EMAIL",
      body: `Emailed quote ${quote.quoteNumber} ($${quote.totalAmount.toFixed(2)}) to ${quote.customer.email}.`,
      companyId: session.companyId,
      customerId: quote.customerId,
      dealId: quote.dealId,
      authorId: session.userId,
    },
  });
  await logAudit(session.companyId, session.userId, "quote.sent", "Quote", quoteId, { by: "email" });
  revalidateQuote(quoteId, quote.customerId, quote.dealId);
  redirect(`${back}?sent=1`);
}

// ---------- Decisions ----------

/**
 * The customer said yes: make a pending order with the quote's lines and
 * prices, link the two, and win the deal it belongs to. All in one
 * transaction, and only from a quote still open, so a double click can't
 * make two orders.
 */
export async function acceptQuote(quoteId: string) {
  const session = await verifySession();
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId: session.companyId, ...(await lockedWhere()) },
    include: { items: { select: { productId: true, quantity: true, unitPrice: true } }, deal: { select: { id: true, stage: true } } },
  });
  if (!quote) redirect(LIST);
  const back = `${LIST}/${quoteId}`;
  if (acceptBlocker({ status: quote.status, validUntil: quote.validUntil, itemCount: quote.items.length })) {
    redirect(`${back}?error=quote-cannot-accept`);
  }

  const total = quoteTotal(quote.items);
  const orderId = await db.$transaction(async (tx) => {
    const claimed = await tx.quote.updateMany({
      where: { id: quoteId, status: { in: ["DRAFT", "SENT"] } },
      data: { status: "ACCEPTED", decidedAt: new Date() },
    });
    if (claimed.count === 0) return null;
    const order = await tx.order.create({
      data: {
        companyId: session.companyId,
        customerId: quote.customerId,
        branchId: quote.branchId,
        totalAmount: total,
        items: { create: quote.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })) },
      },
    });
    await tx.quote.update({ where: { id: quoteId }, data: { orderId: order.id } });
    if (quote.deal && isOpenStage(quote.deal.stage)) {
      await tx.deal.update({
        where: { id: quote.deal.id },
        data: { stage: "WON", probability: 100, value: total, closedAt: new Date(), lostReason: null },
      });
    }
    await tx.crmActivity.create({
      data: {
        type: "NOTE",
        body: `Quote ${quote.quoteNumber} accepted ($${total.toFixed(2)}). An order was created from it.`,
        companyId: session.companyId,
        customerId: quote.customerId,
        dealId: quote.dealId,
        authorId: session.userId,
      },
    });
    return order.id;
  });
  if (!orderId) redirect(back);

  await logAudit(session.companyId, session.userId, "quote.accepted", "Quote", quoteId, { quoteNumber: quote.quoteNumber, total });
  if (quote.deal && isOpenStage(quote.deal.stage)) {
    await logAudit(session.companyId, session.userId, "deal.stage_changed", "Deal", quote.deal.id, { from: quote.deal.stage, to: "WON" });
    revalidatePath("/dashboard/crm/deals");
  }
  revalidateQuote(quoteId, quote.customerId, quote.dealId);
  revalidatePath("/dashboard/sales");
  redirect(`/dashboard/sales/${orderId}`);
}

export async function declineQuote(quoteId: string) {
  const session = await verifySession();
  const quote = await findQuote(session.companyId, quoteId);
  if (!quote) redirect(LIST);
  if (!isEditable(quote.status)) redirect(`${LIST}/${quoteId}`);
  await db.quote.update({ where: { id: quoteId }, data: { status: "DECLINED", decidedAt: new Date() } });
  await db.crmActivity.create({
    data: {
      type: "NOTE",
      body: `Quote ${quote.quoteNumber} was declined.`,
      companyId: session.companyId,
      customerId: quote.customerId,
      dealId: quote.dealId,
      authorId: session.userId,
    },
  });
  await logAudit(session.companyId, session.userId, "quote.declined", "Quote", quoteId, {});
  revalidateQuote(quoteId, quote.customerId, quote.dealId);
}

/** A fresh draft with the same customer, deal and lines, at today's prices
 * as quoted. Handy after a decline or an expiry. */
export async function duplicateQuote(quoteId: string) {
  const session = await verifySession();
  const source = await db.quote.findFirst({
    where: { id: quoteId, companyId: session.companyId, ...(await lockedWhere()) },
    include: { items: { select: { productId: true, quantity: true, unitPrice: true } } },
  });
  if (!source) redirect(LIST);
  const copy = await createWithNumber(session.companyId, {
    customerId: source.customerId,
    dealId: source.dealId,
    ownerId: session.userId,
    branchId: source.branchId,
    validUntil: defaultValidUntil(),
    notes: source.notes,
    totalAmount: quoteTotal(source.items),
    items: { create: source.items },
  });
  await logAudit(session.companyId, session.userId, "quote.created", "Quote", copy.id, { copiedFrom: source.quoteNumber });
  revalidateQuote(copy.id, source.customerId, source.dealId);
  redirect(`${LIST}/${copy.id}`);
}

/** The quote's owner or an owner/admin. An accepted quote's order stays. */
export async function deleteQuote(quoteId: string) {
  const session = await verifySession();
  const quote = await findQuote(session.companyId, quoteId);
  if (!quote) redirect(LIST);
  if (quote.ownerId !== session.userId && !hasRole(session, ["OWNER", "ADMIN"])) redirect(`${LIST}/${quoteId}?error=forbidden`);
  await db.quote.delete({ where: { id: quoteId } });
  await logAudit(session.companyId, session.userId, "quote.deleted", "Quote", quoteId, { quoteNumber: quote.quoteNumber });
  revalidateQuote(quoteId, quote.customerId, quote.dealId);
  redirect(LIST);
}
