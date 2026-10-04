"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { lockedWhere } from "@/lib/branches";
import { customerScope, quoteScope } from "@/lib/crm-access";
import { ensureQuoteToken, quoteLink } from "@/lib/quote-accept";
import { touchLeadScore } from "@/lib/lead-score-data";

/* WhatsApp click to chat: the browser opens WhatsApp itself; these log
   what was sent on the customer's history and supply the quote link. */

/** The customer's link to a quote, for a WhatsApp message. */
export async function whatsappQuoteLink(quoteId: string): Promise<string | null> {
  const session = await verifySession();
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId: session.companyId, ...(await lockedWhere()), ...(await quoteScope()) },
    select: { id: true, status: true },
  });
  if (!quote || (quote.status !== "DRAFT" && quote.status !== "SENT")) return null;
  return quoteLink(await ensureQuoteToken(quote.id));
}

/** Notes a WhatsApp message on the history. A draft quote sent this way counts as sent. */
export async function logWhatsApp(input: { customerId: string; dealId?: string | null; quoteId?: string | null; number: string; message: string }) {
  const session = await verifySession();
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, companyId: session.companyId, ...(await customerScope()) },
    select: { id: true },
  });
  if (!customer) return;
  const deal = input.dealId
    ? await db.deal.findFirst({ where: { id: input.dealId, companyId: session.companyId, customerId: customer.id }, select: { id: true } })
    : null;

  const message = input.message.trim().slice(0, 2000);
  await db.crmActivity.create({
    data: {
      type: "WHATSAPP",
      body: `WhatsApp to +${input.number.replace(/\D/g, "").slice(0, 15)}${message ? `:\n${message}` : ""}`,
      companyId: session.companyId,
      customerId: customer.id,
      dealId: deal?.id ?? null,
      authorId: session.userId,
    },
  });

  if (input.quoteId) {
    const quote = await db.quote.findFirst({
      where: { id: input.quoteId, companyId: session.companyId, customerId: customer.id, status: "DRAFT" },
      select: { id: true },
    });
    if (quote) {
      await db.quote.update({ where: { id: quote.id }, data: { status: "SENT", sentAt: new Date() } });
      await logAudit(session.companyId, session.userId, "quote.sent", "Quote", quote.id, { by: "whatsapp" });
    }
    revalidatePath(`/dashboard/quotes/${input.quoteId}`);
    revalidatePath("/dashboard/quotes");
  }

  await touchLeadScore(session.companyId, customer.id);
  revalidatePath(`/dashboard/crm/${customer.id}`);
  if (deal) revalidatePath(`/dashboard/crm/deals/${deal.id}`);
}
