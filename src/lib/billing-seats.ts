import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { extraUsersBilled } from "@/lib/plan-limits";
import { extraUserLookupKey, type BillingInterval } from "@/lib/plans";

/* Extra users on the Stripe subscription: one "extra user" line whose
   quantity is the members above the plan's included users. Changes are
   prorated (create_prorations): a member who joins mid period is charged for
   the rest of it on the next invoice, and a removed one is credited. */

/** A Stripe price by lookup key, or null if it hasn't been created yet
 * (scripts/stripe-plans.ts). */
export async function findPriceId(lookupKey: string): Promise<string | null> {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return data[0]?.id ?? null;
}

export function isExtraUserItem(item: Stripe.SubscriptionItem): boolean {
  return item.price.lookup_key?.startsWith("aibos_extra_user_") ?? false;
}

/** Brings the subscription's extra user quantity in line with the team.
 * Does nothing for trials and the old $49 price. Stripe failures are logged
 * and left for the next sync rather than blocking the team change. */
export async function syncExtraUsers(companyId: string): Promise<void> {
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { status: true, stripeSubscriptionId: true, billingInterval: true },
  });
  if (!sub?.stripeSubscriptionId || !sub.billingInterval || (sub.status !== "ACTIVE" && sub.status !== "PAST_DUE")) return;

  try {
    const quantity = await extraUsersBilled(companyId);
    const subscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const item = subscription.items.data.find(isExtraUserItem);

    if (quantity === 0) {
      if (item) await stripe.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
      return;
    }

    const price = await findPriceId(extraUserLookupKey(sub.billingInterval as BillingInterval));
    if (!price) {
      console.error("[billing] extra user price is missing; run scripts/stripe-plans.ts");
      return;
    }
    if (item) {
      if (item.quantity !== quantity || item.price.id !== price) {
        await stripe.subscriptionItems.update(item.id, { price, quantity, proration_behavior: "create_prorations" });
      }
    } else {
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price,
        quantity,
        proration_behavior: "create_prorations",
      });
    }
  } catch (err) {
    console.error(`[billing] could not sync extra users for company ${companyId}:`, err);
  }
}
