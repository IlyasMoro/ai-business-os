import "server-only";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { parsePriceLookupKey } from "@/lib/plans";
import type { CompanyPlan, SubscriptionStatus } from "@/generated/prisma/client";

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}

/**
 * Copies a Stripe subscription onto the company: its status and period,
 * and the plan named by the price's lookup key (lib/plans.ts). Called by the
 * webhook, and straight after checkout or a plan change so the app doesn't
 * wait for the webhook. A price without a plan lookup key (the old single
 * $49 price) leaves the company's plan as it is.
 */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const companyId = subscription.metadata?.companyId;
  if (!companyId) {
    console.error("[stripe] subscription has no companyId metadata:", subscription.id);
    return;
  }

  // The plan line, found by its lookup key; the subscription may also carry
  // an "extra users" line. The old $49 price has no plan key, so fall back
  // to the first line for the period dates.
  const planItem = subscription.items.data.find((i) => parsePriceLookupKey(i.price.lookup_key));
  const periodEnd = (planItem ?? subscription.items.data[0])?.current_period_end;
  const chosen = parsePriceLookupKey(planItem?.price.lookup_key);
  const data = {
    billingInterval: chosen?.interval ?? null,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    status: mapStatus(subscription.status),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  await db.$transaction([
    db.subscription.upsert({ where: { companyId }, create: { companyId, ...data }, update: data }),
    ...(chosen
      ? [db.company.update({ where: { id: companyId }, data: { plan: chosen.planId.toUpperCase() as CompanyPlan } })]
      : []),
  ]);
}
