"use server";

import { redirect } from "next/navigation";
import { verifySession, requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

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

export async function startCheckout() {
  const session = await requireRole(["OWNER"]);
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const customerId = await getOrCreateStripeCustomerId(
    session.companyId,
    session.email,
    session.name
  );

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${baseUrl}/dashboard/billing?checkout=cancelled`,
    metadata: { companyId: session.companyId },
    subscription_data: { metadata: { companyId: session.companyId } },
  });

  if (!checkoutSession.url) {
    redirect("/dashboard/billing?error=invalid");
  }

  redirect(checkoutSession.url);
}

export async function openBillingPortal() {
  const session = await requireRole(["OWNER"]);
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const subscription = await db.subscription.findUnique({ where: { companyId: session.companyId } });
  if (!subscription?.stripeCustomerId) {
    redirect("/dashboard/billing?error=invalid");
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl}/dashboard/billing`,
  });

  redirect(portalSession.url);
}

export async function getSubscriptionStatus() {
  const session = await verifySession();
  return db.subscription.findUnique({ where: { companyId: session.companyId } });
}
