/* The subscription plans, in one place so the pricing page, the comparison
   table and (later) billing and plan limits all read the same numbers.
   Each plan includes a number of users; more can be added per user on any
   plan. Prices are USD, with a rough Rand guide for South African buyers. Public copy uses no hyphens.

   Not enforced in the app yet: Billing still sells the single $49 Stripe
   price (lib/actions/billing.ts). */

export type PlanId = "starter" | "growth" | "scale";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Price per month when paid monthly. */
  monthly: number;
  /** Price per year when paid yearly (two months free). */
  yearly: number;
  popular?: boolean;
  /** Heading above the feature list, e.g. "Everything in Starter, plus". */
  includesLabel: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For one location getting everything in one place.",
    monthly: 200,
    yearly: 2000,
    includesLabel: "What's included",
    features: [
      "Up to 10 users with owner, admin and employee roles",
      "1 branch",
      "CRM, Sales, Invoicing, Returns, Support and Marketing",
      "Inventory, Procurement, Projects and Accounting",
      "HR, Payroll and Team",
      "Google integration for Gmail and Calendar",
      "AI Copilot with 500 requests a month",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing businesses with more than one location.",
    monthly: 499,
    yearly: 4990,
    popular: true,
    includesLabel: "Everything in Starter, plus",
    features: [
      "Up to 50 users",
      "Up to 3 branches",
      "Stock transfers between branches",
      "Planning / MRP and Controlling",
      "Automations and scheduled report emails",
      "AI Copilot with 2,000 requests a month",
      "Faster email support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For distributors and larger teams across many sites.",
    monthly: 999,
    yearly: 9990,
    includesLabel: "Everything in Growth, plus",
    features: [
      "Up to 150 users",
      "Unlimited branches",
      "EDI with your trading partners",
      "AI Copilot with 5,000 requests a month",
      "Priority support",
    ],
  },
];

/** Monthly price for each user beyond a plan's included users. */
export const EXTRA_USER_PRICE = 15;

/** Largest team on Scale; bigger companies get an Enterprise quote. */
export const MAX_SCALE_USERS = 150;

/**
 * Rough Rand per US dollar for the "about R..." guide on the pricing page.
 * Update it when the exchange rate moves a lot; Stripe still bills USD.
 */
export const ZAR_PER_USD = 18;

/** "About R3,600": dollars in Rand, rounded to the nearest R100. */
export function aboutRand(usd: number): string {
  return `About R${(Math.round((usd * ZAR_PER_USD) / 100) * 100).toLocaleString("en-US")}`;
}

/** The lowest monthly price, for "From $200" style copy. */
export const STARTING_PRICE = Math.min(...PLANS.map((p) => p.monthly));

/** Modules that need more than Starter, by sidebar label. Everything else is on every plan. */
export const MODULE_MIN_PLAN: Record<string, "Growth" | "Scale"> = {
  Transfers: "Growth",
  "Planning / MRP": "Growth",
  Controlling: "Growth",
  Automation: "Growth",
  EDI: "Scale",
};
