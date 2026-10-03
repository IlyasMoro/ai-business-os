/**
 * Creates the Stripe products and prices for the plans in src/lib/plans.ts:
 * one product per plan, with a monthly and a yearly price, each tagged with
 * its lookup key (aibos_growth_yearly, ...), plus the "extra user" product
 * with its own monthly and yearly price, and the one-time AI top-up pack.
 * Checkout and the webhook find prices by those keys.
 *
 * Safe to run again: existing prices are kept when the amount still
 * matches. When a price in plans.ts changes, a new Stripe price is created
 * and the lookup key moves to it (transfer_lookup_key); current subscribers
 * keep paying the old price until they change plan.
 *
 * Uses STRIPE_SECRET_KEY from .env. Refuses a live key unless --live is
 * passed, so it can't touch real billing by accident.
 *
 * Run with: npx tsx --env-file=.env scripts/stripe-plans.ts [--live]
 */
import Stripe from "stripe";
import {
  AI_TOPUP_LOOKUP_KEY,
  AI_TOPUP_PRICE,
  AI_TOPUP_REQUESTS,
  EXTRA_USER_PRICE,
  EXTRA_USER_YEARLY_PRICE,
  PLANS,
  extraUserLookupKey,
  priceLookupKey,
  type BillingInterval,
} from "../src/lib/plans";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
const live = key.startsWith("sk_live_");
if (live && !process.argv.includes("--live")) {
  throw new Error("STRIPE_SECRET_KEY is a live key. Pass --live to create real prices.");
}

const stripe = new Stripe(key);

async function ensureProduct(id: string, name: string, description: string) {
  const product = await stripe.products.retrieve(id).catch(() => stripe.products.create({ id, name, description }));
  if (product.deleted) throw new Error(`Product ${id} was deleted in Stripe`);
  return product;
}

/** `interval` null makes a one-time price. */
async function ensurePrice(productId: string, lookupKey: string, nickname: string, dollars: number, interval: "month" | "year" | null) {
  const cents = dollars * 100;
  const per = interval ?? "once";
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const current = data[0];
  if (current && current.unit_amount === cents && (current.recurring?.interval ?? null) === interval) {
    console.log(`kept     ${lookupKey}  $${dollars}/${per}  ${current.id}`);
    return;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: cents,
    ...(interval ? { recurring: { interval } } : {}),
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    nickname,
  });
  console.log(`created  ${lookupKey}  $${dollars}/${per}  ${price.id}`);
}

async function main() {
  console.log(`Stripe ${live ? "LIVE" : "test"} mode\n`);

  for (const plan of PLANS) {
    const product = await ensureProduct(`aibos_${plan.id}`, `AIBOS ${plan.name}`, plan.tagline);
    const intervals: [BillingInterval, number, "month" | "year"][] = [
      ["monthly", plan.monthly, "month"],
      ["yearly", plan.yearly, "year"],
    ];
    for (const [interval, dollars, stripeInterval] of intervals) {
      await ensurePrice(product.id, priceLookupKey(plan.id, interval), `${plan.name} ${interval}`, dollars, stripeInterval);
    }
  }

  // Charged per member above the plan's included users, on any plan.
  const extra = await ensureProduct("aibos_extra_user", "AIBOS extra user", "Each user above the plan's included users.");
  await ensurePrice(extra.id, extraUserLookupKey("monthly"), "Extra user monthly", EXTRA_USER_PRICE, "month");
  await ensurePrice(extra.id, extraUserLookupKey("yearly"), "Extra user yearly", EXTRA_USER_YEARLY_PRICE, "year");

  // One-time AI top-up pack, bought on the Billing page.
  const topUp = await ensureProduct("aibos_ai_topup", "AIBOS AI requests", `${AI_TOPUP_REQUESTS} extra AI requests that never expire.`);
  await ensurePrice(topUp.id, AI_TOPUP_LOOKUP_KEY, `${AI_TOPUP_REQUESTS} AI requests`, AI_TOPUP_PRICE, null);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
