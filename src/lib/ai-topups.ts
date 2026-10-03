import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";
import { AI_TOPUP_LOOKUP_KEY, AI_TOPUP_REQUESTS } from "@/lib/plans";
import { Prisma } from "@/generated/prisma/client";

/** Marks a Checkout session as an AI top-up purchase (startAiTopUp). */
export const AI_TOPUP_KIND = "ai_topup";

/**
 * Adds a paid top-up's requests to the company. Called by the webhook and
 * when the owner returns from Checkout; the AiTopUp row is unique per
 * Checkout session, so whichever comes second does nothing. Returns the
 * requests added, or 0 when there was nothing (more) to credit.
 */
export async function creditAiTopUp(session: Stripe.Checkout.Session): Promise<number> {
  const companyId = session.metadata?.companyId;
  if (session.metadata?.kind !== AI_TOPUP_KIND || !companyId) return 0;
  if (session.mode !== "payment" || session.payment_status !== "paid") return 0;

  // The owner can change the number of packs in Checkout, so count them here.
  const { data: lines } = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price"] });
  const packs = lines
    .filter((line) => line.price?.lookup_key === AI_TOPUP_LOOKUP_KEY)
    .reduce((sum, line) => sum + (line.quantity ?? 0), 0);
  if (packs === 0) return 0;
  const requests = packs * AI_TOPUP_REQUESTS;

  try {
    await db.$transaction([
      db.aiTopUp.create({
        data: { companyId, stripeSessionId: session.id, requests, amountCents: session.amount_total ?? 0 },
      }),
      db.company.update({ where: { id: companyId }, data: { aiCredits: { increment: requests } } }),
    ]);
  } catch (err) {
    // Already credited by the other path.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return 0;
    throw err;
  }
  const buyer = session.metadata?.userId;
  if (buyer) await logAudit(companyId, buyer, "billing.ai_topup", "AiTopUp", session.id, { requests });
  return requests;
}
