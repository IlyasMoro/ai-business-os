import "server-only";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { acceptBlocker, quoteTotal } from "@/lib/quotes";
import { isOpenStage } from "@/lib/crm-pipeline";
import { touchLeadScore } from "@/lib/lead-score-data";

/* Accepting and declining a quote, shared by the staff buttons on the quote
   page and the customer's own page at /q/<token>. */

/** The customer's secret link to the quote, made the first time it's needed. */
export async function ensureQuoteToken(quoteId: string): Promise<string> {
  const quote = await db.quote.findUnique({ where: { id: quoteId }, select: { publicToken: true } });
  if (quote?.publicToken) return quote.publicToken;
  const token = randomBytes(24).toString("base64url");
  // Only sets it if still empty, so two clicks at once keep one link.
  await db.quote.updateMany({ where: { id: quoteId, publicToken: null }, data: { publicToken: token } });
  return (await db.quote.findUnique({ where: { id: quoteId }, select: { publicToken: true } }))!.publicToken!;
}

export function quoteLink(token: string): string | null {
  const base = process.env.APP_BASE_URL;
  return base ? `${base}/q/${token}` : null;
}

type Signer = { userId: string | null; signedName?: string; signedIp?: string };

export type AcceptResult = { ok: true; orderId: string; dealWon: { id: string; from: string } | null } | { ok: false; reason: "blocked" | "taken" };

/**
 * The customer said yes: make a pending order with the quote's lines and
 * prices, link the two, and win the deal it belongs to. All in one
 * transaction, and only from a quote still open, so a double click can't
 * make two orders. Online acceptance also records the typed name and IP.
 */
export async function acceptQuoteRecord(quoteId: string, companyId: string, signer: Signer): Promise<AcceptResult> {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId },
    include: { items: { select: { productId: true, quantity: true, unitPrice: true } }, deal: { select: { id: true, stage: true } } },
  });
  if (!quote) return { ok: false, reason: "taken" };
  if (acceptBlocker({ status: quote.status, validUntil: quote.validUntil, itemCount: quote.items.length })) return { ok: false, reason: "blocked" };

  const total = quoteTotal(quote.items);
  const online = Boolean(signer.signedName);
  const orderId = await db.$transaction(async (tx) => {
    const claimed = await tx.quote.updateMany({
      where: { id: quoteId, status: { in: ["DRAFT", "SENT"] } },
      data: { status: "ACCEPTED", decidedAt: new Date(), signedName: signer.signedName ?? null, signedIp: signer.signedIp ?? null },
    });
    if (claimed.count === 0) return null;
    const order = await tx.order.create({
      data: {
        companyId,
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
        body: online
          ? `Quote ${quote.quoteNumber} accepted online by ${signer.signedName} ($${total.toFixed(2)}). An order was created from it.`
          : `Quote ${quote.quoteNumber} accepted ($${total.toFixed(2)}). An order was created from it.`,
        companyId,
        customerId: quote.customerId,
        dealId: quote.dealId,
        authorId: signer.userId,
      },
    });
    return order.id;
  });
  if (!orderId) return { ok: false, reason: "taken" };

  await touchLeadScore(companyId, quote.customerId);
  return { ok: true, orderId, dealWon: quote.deal && isOpenStage(quote.deal.stage) ? { id: quote.deal.id, from: quote.deal.stage } : null };
}

/** The customer said no. Returns false when the quote was already decided. */
export async function declineQuoteRecord(
  quoteId: string,
  companyId: string,
  { userId, reason, online }: { userId: string | null; reason?: string; online?: boolean }
): Promise<boolean> {
  const quote = await db.quote.findFirst({ where: { id: quoteId, companyId }, select: { quoteNumber: true, customerId: true, dealId: true } });
  if (!quote) return false;
  const claimed = await db.quote.updateMany({
    where: { id: quoteId, status: { in: ["DRAFT", "SENT"] } },
    data: { status: "DECLINED", decidedAt: new Date(), declineReason: reason?.slice(0, 1000) || null },
  });
  if (claimed.count === 0) return false;
  await db.crmActivity.create({
    data: {
      type: "NOTE",
      body: `Quote ${quote.quoteNumber} was declined${online ? " online by the customer" : ""}.${reason ? ` Reason: ${reason.slice(0, 1000)}` : ""}`,
      companyId,
      customerId: quote.customerId,
      dealId: quote.dealId,
      authorId: userId,
    },
  });
  await touchLeadScore(companyId, quote.customerId);
  return true;
}
