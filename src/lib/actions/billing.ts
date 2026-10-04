"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import type Stripe from "stripe";
import { verifySession, requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/stripe-sync";
import { logAudit } from "@/lib/audit";
import { activeBranchCount, getCompanyPlan, memberCount, seatsUsed } from "@/lib/plan-limits";
import { findPriceId, isExtraUserItem } from "@/lib/billing-seats";
import { AI_TOPUP_KIND, creditAiTopUp } from "@/lib/ai-topups";
import {
  enterpriseLookupKey,
  enterpriseQuantities,
  normalizeEnterprise,
  parseEnterpriseLookupKey,
  type EnterprisePart,
} from "@/lib/enterprise";
import {
  AI_TOPUP_LOOKUP_KEY,
  MAX_USERS,
  extraUserLookupKey,
  planById,
  priceLookupKey,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";

const BASE = "/dashboard/billing";

const PlanChoiceSchema = z.object({
  plan: z.enum(["solo", "starter", "growth", "business", "scale"]),
  interval: z.enum(["monthly", "yearly"]),
});

async function getOrCreateStripeCustomerId(companyId: string, email: string, companyName: string) {
  const subscription = await db.subscription.findUnique({ where: { companyId } });
  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name: companyName,
    metadata: { companyId },
  });

  await db.subscription.upsert({
    where: { companyId },
    create: { companyId, stripeCustomerId: customer.id },
    update: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/** The plan's Stripe price and, when the team is bigger than the plan
 * includes, the extra user price and quantity for the same period. */
async function pricesFor(companyId: string, planId: PlanId, interval: BillingInterval) {
  const extraUsers = Math.max(0, (await memberCount(companyId)) - planById(planId).users);
  const [plan, extra] = await Promise.all([
    findPriceId(priceLookupKey(planId, interval)),
    extraUsers > 0 ? findPriceId(extraUserLookupKey(interval)) : Promise.resolve(null),
  ]);
  const missing = !plan || (extraUsers > 0 && !extra);
  return { plan, extra, extraUsers, missing };
}

/** Runs Stripe calls; a Stripe failure (down, bad key) becomes a message on
 * Billing instead of an error page. Redirects happen outside, after it. */
async function withStripe<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    console.error("[billing] Stripe request failed:", err);
    redirect(`${BASE}?error=billing-unavailable`);
  }
}

/** Stops a move to a plan the company has outgrown: more active branches
 * than it allows, or more people than any plan takes. Users above the
 * plan's included ones are fine, they're billed as extra users. Modules are
 * fine too, their data stays and only locks. */
async function requireFits(companyId: string, planId: PlanId) {
  const plan = planById(planId);
  // Only plans on sale can be bought online. A paying company may stay on
  // an older or Enterprise plan it already has (e.g. to change period).
  if (!plan.listed) {
    const [current, subscription] = await Promise.all([
      getCompanyPlan(companyId),
      db.subscription.findUnique({ where: { companyId }, select: { status: true } }),
    ]);
    const paying = subscription?.status === "ACTIVE" || subscription?.status === "PAST_DUE";
    if (!paying || current.id !== planId) redirect(`${BASE}?error=plan-not-on-sale`);
  }
  const [seats, branches] = await Promise.all([seatsUsed(companyId), activeBranchCount(companyId)]);
  if (seats > MAX_USERS) redirect(`${BASE}?error=plan-too-small-users`);
  // Solo has no extra users, so the whole team has to fit.
  if (!plan.extraUsers && seats > plan.users) redirect(`${BASE}?error=plan-no-extra-users`);
  if (plan.branches !== null && branches > plan.branches) redirect(`${BASE}?error=plan-too-small-branches`);
}

function parseChoice(formData: FormData) {
  const parsed = PlanChoiceSchema.safeParse({ plan: formData.get("plan"), interval: formData.get("interval") });
  if (!parsed.success) redirect(`${BASE}?error=invalid`);
  return parsed.data;
}

/** Subscribe to a plan through Stripe Checkout. Companies that already pay
 * change plan instead (changePlan), so they never hold two subscriptions. */
export async function startCheckout(formData: FormData) {
  const session = await requireRole(["OWNER"]);
  const { plan, interval } = parseChoice(formData);
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const current = await db.subscription.findUnique({ where: { companyId: session.companyId } });
  if (current?.stripeSubscriptionId && (current.status === "ACTIVE" || current.status === "PAST_DUE")) {
    redirect(`${BASE}?error=plan-already-subscribed`);
  }
  await requireFits(session.companyId, plan);

  const url = await withStripe(async () => {
    const prices = await pricesFor(session.companyId, plan, interval);
    if (prices.missing) return `${BASE}?error=plan-price-missing`;
    const customerId = await getOrCreateStripeCustomerId(session.companyId, session.email, session.name);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        { price: prices.plan!, quantity: 1 },
        // A team already bigger than the plan pays for its extra users too.
        ...(prices.extraUsers > 0 ? [{ price: prices.extra!, quantity: prices.extraUsers }] : []),
      ],
      // The session id comes back so the Billing page can record the plan
      // at once instead of waiting for the webhook.
      success_url: `${baseUrl}${BASE}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${BASE}?checkout=cancelled`,
      metadata: { companyId: session.companyId },
      subscription_data: { metadata: { companyId: session.companyId } },
    });
    return checkoutSession.url ?? `${BASE}?error=invalid`;
  });

  redirect(url);
}

/** After Stripe sends the owner back from Checkout: record the
 * subscription and plan now. The webhook does the same; doing it twice is
 * harmless. Only a session belonging to this company is accepted. */
export async function confirmCheckout(checkoutSessionId: string) {
  const session = await requireRole(["OWNER"]);
  try {
    const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (checkout.metadata?.companyId !== session.companyId || !checkout.subscription) return;
    await syncSubscription(await stripe.subscriptions.retrieve(checkout.subscription as string));
  } catch (err) {
    // The webhook records it anyway; the page just shows the old state until then.
    console.error("[billing] could not confirm checkout:", err);
  }
}

/** Move an active subscription to another plan or billing period. Stripe
 * charges or credits the difference straight away (always_invoice). */
export async function changePlan(formData: FormData) {
  const session = await requireRole(["OWNER"]);
  const { plan, interval } = parseChoice(formData);

  const current = await db.subscription.findUnique({ where: { companyId: session.companyId } });
  if (!current?.stripeSubscriptionId || current.status !== "ACTIVE") redirect(`${BASE}?error=plan-not-active`);
  await requireFits(session.companyId, plan);

  const subscriptionId = current.stripeSubscriptionId;
  const outcome = await withStripe(async () => {
    const [subscription, prices] = await Promise.all([
      stripe.subscriptions.retrieve(subscriptionId),
      pricesFor(session.companyId, plan, interval),
    ]);
    if (prices.missing) return "plan-price-missing";
    const enterpriseItems = subscription.items.data.filter((i) => parseEnterpriseLookupKey(i.price.lookup_key));
    const planItem = subscription.items.data.find((i) => !isExtraUserItem(i) && !parseEnterpriseLookupKey(i.price.lookup_key));
    const extraItem = subscription.items.data.find(isExtraUserItem);
    if (!planItem && enterpriseItems.length === 0) return "plan-not-active";
    if (planItem?.price.id === prices.plan) return "plan-same";
    // Every line must share the new period, so the extra users line moves
    // with the plan in the same update (or goes, if the new plan covers them).
    // Leaving a built Enterprise plan removes all of its lines.
    const items: Stripe.SubscriptionUpdateParams.Item[] = [
      planItem ? { id: planItem.id, price: prices.plan! } : { price: prices.plan!, quantity: 1 },
      ...enterpriseItems.map((i) => ({ id: i.id, deleted: true })),
    ];
    if (prices.extraUsers > 0) {
      items.push(
        extraItem
          ? { id: extraItem.id, price: prices.extra!, quantity: prices.extraUsers }
          : { price: prices.extra!, quantity: prices.extraUsers }
      );
    } else if (extraItem) {
      items.push({ id: extraItem.id, deleted: true });
    }
    const updated = await stripe.subscriptions.update(subscription.id, {
      items,
      proration_behavior: "always_invoice",
      metadata: { ...subscription.metadata, companyId: session.companyId },
    });
    await syncSubscription(updated);
    return "changed";
  });
  if (outcome !== "changed") redirect(`${BASE}?error=${outcome}`);
  await logAudit(session.companyId, session.userId, "billing.plan_changed", "Subscription", subscriptionId, { plan, interval });

  revalidatePath("/dashboard", "layout");
  redirect(`${BASE}?changed=1`);
}

// ---------- Enterprise, built by the client ----------

const ENTERPRISE_PARTS: EnterprisePart[] = ["user", "branch", "edi", "ai"];

function parseEnterprise(formData: FormData) {
  const interval = formData.get("interval") === "yearly" ? "yearly" : "monthly";
  const config = normalizeEnterprise({
    users: formData.get("users"),
    branches: formData.get("branches"),
    edi: formData.get("edi"),
    aiPacks: formData.get("aiPacks"),
  });
  return { config, interval } as const;
}

/** The Stripe price for each part with a quantity above 0, or null when
 * one hasn't been created yet (scripts/stripe-plans.ts). */
async function enterprisePrices(quantities: Record<EnterprisePart, number>, interval: "monthly" | "yearly") {
  const wanted = ENTERPRISE_PARTS.filter((part) => quantities[part] > 0);
  const ids = await Promise.all(wanted.map((part) => findPriceId(enterpriseLookupKey(part, interval))));
  if (ids.some((id) => !id)) return null;
  return wanted.map((part, i) => ({ part, price: ids[i]!, quantity: quantities[part] }));
}

/**
 * Buy or change a built Enterprise plan. Without a paid subscription this
 * opens Stripe Checkout; with one it changes the lines in place, and Stripe
 * charges or credits the difference straight away. The team must fit: at
 * least as many users as people (counting open invites) and branches as
 * active branches.
 */
export async function buyEnterprise(formData: FormData) {
  const session = await requireRole(["OWNER"]);
  const { config, interval } = parseEnterprise(formData);
  const [seats, branches] = await Promise.all([seatsUsed(session.companyId), activeBranchCount(session.companyId)]);
  if (seats > config.users) redirect(`${BASE}?error=enterprise-users`);
  if (branches > config.branches) redirect(`${BASE}?error=enterprise-branches`);

  const quantities = enterpriseQuantities(config);
  const current = await db.subscription.findUnique({ where: { companyId: session.companyId } });
  const paying = Boolean(current?.stripeSubscriptionId && (current.status === "ACTIVE" || current.status === "PAST_DUE"));
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  if (!paying || !current?.stripeSubscriptionId) {
    const url = await withStripe(async () => {
      const lines = await enterprisePrices(quantities, interval);
      if (!lines) return `${BASE}?error=plan-price-missing`;
      const customerId = await getOrCreateStripeCustomerId(session.companyId, session.email, session.name);
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: lines.map((l) => ({ price: l.price, quantity: l.quantity })),
        success_url: `${baseUrl}${BASE}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}${BASE}?checkout=cancelled`,
        metadata: { companyId: session.companyId },
        subscription_data: { metadata: { companyId: session.companyId } },
      });
      return checkoutSession.url ?? `${BASE}?error=invalid`;
    });
    redirect(url);
  }

  if (current.status !== "ACTIVE") redirect(`${BASE}?error=plan-not-active`);
  const subscriptionId = current.stripeSubscriptionId;
  const outcome = await withStripe(async () => {
    const [subscription, lines] = await Promise.all([stripe.subscriptions.retrieve(subscriptionId), enterprisePrices(quantities, interval)]);
    if (!lines) return "plan-price-missing";
    // Keep each Enterprise line that is still wanted (new price and
    // quantity), add the missing ones, and remove everything else: an
    // earlier plan line, extra users, or parts no longer chosen.
    const existing = new Map(
      subscription.items.data.flatMap((i) => {
        const key = parseEnterpriseLookupKey(i.price.lookup_key);
        return key ? [[key.part, i] as const] : [];
      })
    );
    const items: Stripe.SubscriptionUpdateParams.Item[] = lines.map((l) => {
      const item = existing.get(l.part);
      return item ? { id: item.id, price: l.price, quantity: l.quantity } : { price: l.price, quantity: l.quantity };
    });
    const kept = new Set(lines.map((l) => existing.get(l.part)?.id).filter(Boolean));
    for (const item of subscription.items.data) if (!kept.has(item.id)) items.push({ id: item.id, deleted: true });
    const updated = await stripe.subscriptions.update(subscription.id, {
      items,
      proration_behavior: "always_invoice",
      metadata: { ...subscription.metadata, companyId: session.companyId },
    });
    await syncSubscription(updated);
    return "changed";
  });
  if (outcome !== "changed") redirect(`${BASE}?error=${outcome}`);
  await logAudit(session.companyId, session.userId, "billing.enterprise_changed", "Subscription", subscriptionId, { ...config, interval });

  revalidatePath("/dashboard", "layout");
  redirect(`${BASE}?changed=1`);
}

/** Buy AI requests: a one-time Stripe Checkout for top-up packs. The owner
 * can pick 1 to 10 packs there. They're credited by creditAiTopUp. */
export async function startAiTopUp() {
  const session = await requireRole(["OWNER"]);
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const url = await withStripe(async () => {
    const price = await findPriceId(AI_TOPUP_LOOKUP_KEY);
    if (!price) return `${BASE}?error=plan-price-missing`;
    const customerId = await getOrCreateStripeCustomerId(session.companyId, session.email, session.name);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price, quantity: 1, adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 } }],
      success_url: `${baseUrl}${BASE}?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${BASE}?checkout=cancelled`,
      metadata: { companyId: session.companyId, userId: session.userId, kind: AI_TOPUP_KIND },
    });
    return checkoutSession.url ?? `${BASE}?error=invalid`;
  });

  redirect(url);
}

/** After the owner pays for a top-up: credit it now (the webhook also
 * tries; only one of them adds the requests). */
export async function confirmAiTopUp(checkoutSessionId: string): Promise<number> {
  const session = await requireRole(["OWNER"]);
  try {
    const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (checkout.metadata?.companyId !== session.companyId) return 0;
    return await creditAiTopUp(checkout);
  } catch (err) {
    console.error("[billing] could not confirm AI top-up:", err);
    return 0;
  }
}

export async function openBillingPortal() {
  const session = await requireRole(["OWNER"]);
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const subscription = await db.subscription.findUnique({ where: { companyId: session.companyId } });
  if (!subscription?.stripeCustomerId) {
    redirect(`${BASE}?error=invalid`);
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl}${BASE}`,
  });

  redirect(portalSession.url);
}

export async function getSubscriptionStatus() {
  const session = await verifySession();
  return db.subscription.findUnique({ where: { companyId: session.companyId } });
}
