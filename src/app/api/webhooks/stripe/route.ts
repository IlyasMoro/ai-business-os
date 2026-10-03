import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/stripe-sync";
import { syncExtraUsers } from "@/lib/billing-seats";
import { creditAiTopUp } from "@/lib/ai-topups";

/** Records the subscription, then corrects the extra users line if it
 * drifted from the team (a missed sync heals here). */
async function syncAll(subscription: Stripe.Subscription) {
  await syncSubscription(subscription);
  const companyId = subscription.metadata?.companyId;
  if (companyId && subscription.status !== "canceled") await syncExtraUsers(companyId);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // A one-time AI top-up purchase.
      if (session.mode === "payment") {
        await creditAiTopUp(session);
        break;
      }
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncAll(subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncAll(subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
