import "server-only";
import Stripe from "stripe";

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

function createClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return new Stripe(key);
}

export const stripe = globalForStripe.stripe ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}
