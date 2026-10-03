/* The subscription plans, in one place so the pricing page, the comparison
   table and (later) billing and plan limits all read the same numbers.
   Each plan includes a number of users; more can be added per user on any
   plan. Prices are USD, with a rough Rand guide for South African buyers. Public copy uses no hyphens.

   lib/plan-limits.ts applies these limits in the app. Billing still sells
   the single $49 Stripe price (lib/actions/billing.ts), so every company is
   on SCALE until checkout records a real plan. */

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
  /** Users included before extra users are charged. */
  users: number;
  /** Branches allowed; null means unlimited. */
  branches: number | null;
  /** AI Copilot requests a month. */
  aiRequests: number;
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
    users: 10,
    branches: 1,
    aiRequests: 500,
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
    users: 50,
    branches: 3,
    aiRequests: 2000,
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
    users: 150,
    branches: null,
    aiRequests: 5000,
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

/** Modules that need more than Starter, and the lowest plan that has them. */
export type PlanFeature = "transfers" | "mrp" | "controlling" | "automation" | "edi";

export const FEATURE_MIN_PLAN: Record<PlanFeature, PlanId> = {
  transfers: "growth",
  mrp: "growth",
  controlling: "growth",
  automation: "growth",
  edi: "scale",
};

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  transfers: "Stock transfers",
  mrp: "Planning / MRP",
  controlling: "Controlling",
  automation: "Automations",
  edi: "EDI",
};

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id)!;
}

/** Whether a plan includes a Growth or Scale module. */
export function planIncludes(planId: PlanId, feature: PlanFeature): boolean {
  const rank = (id: PlanId) => PLANS.findIndex((p) => p.id === id);
  return rank(planId) >= rank(FEATURE_MIN_PLAN[feature]);
}

// ---------- Stripe prices ----------

export type BillingInterval = "monthly" | "yearly";

/** Each plan's Stripe price is found by this lookup key, not a price ID, so
 * no environment variable per price is needed. scripts/stripe-plans.ts
 * creates the prices; the webhook reads the key back to set the plan. */
export function priceLookupKey(planId: PlanId, interval: BillingInterval): string {
  return `aibos_${planId}_${interval}`;
}

export function parsePriceLookupKey(key: string | null | undefined): { planId: PlanId; interval: BillingInterval } | null {
  const match = /^aibos_(starter|growth|scale)_(monthly|yearly)$/.exec(key ?? "");
  return match ? { planId: match[1] as PlanId, interval: match[2] as BillingInterval } : null;
}

/** An AI top-up pack: bought once on Billing, used after the plan's
 * monthly requests run out, never expires. */
export const AI_TOPUP_REQUESTS = 500;
export const AI_TOPUP_PRICE = 20;
export const AI_TOPUP_LOOKUP_KEY = "aibos_ai_topup_500";

/** Monthly price for each user beyond a plan's included users. */
export const EXTRA_USER_PRICE = 15;
/** Yearly price per extra user: ten months, like the plans' 2 months free. */
export const EXTRA_USER_YEARLY_PRICE = EXTRA_USER_PRICE * 10;

/** The "Extra users" Stripe price for a billing period. Its quantity on a
 * subscription is the number of members above the plan's included users. */
export function extraUserLookupKey(interval: BillingInterval): string {
  return `aibos_extra_user_${interval}`;
}

/** Largest team on Scale; bigger companies get an Enterprise quote. */
export const MAX_SCALE_USERS = PLANS[PLANS.length - 1].users;

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

/** One cell of the plan comparison: included, not included, or a value. */
export type PlanCell = boolean | string;
export type PlanRow = { label: string; values: [PlanCell, PlanCell, PlanCell] };
export type PlanRowGroup = { title: string; rows: PlanRow[] };

type Trio = [PlanCell, PlanCell, PlanCell];
const ALL: Trio = [true, true, true];
const perPlan = (f: (plan: Plan) => PlanCell) => PLANS.map(f) as Trio;
const withFeature = (feature: PlanFeature) => perPlan((p) => planIncludes(p.id, feature));

/** Every feature by plan (Starter, Growth, Scale), for the pricing page's
 * comparison table. Keep it in step with each plan's `features` above. */
export const PLAN_MATRIX: PlanRowGroup[] = [
  {
    title: "Team and locations",
    rows: [
      { label: "Users included", values: perPlan((p) => String(p.users)) },
      { label: "Extra users, each a month", values: perPlan(() => `$${EXTRA_USER_PRICE}`) },
      {
        label: "Branches",
        values: perPlan((p) => (p.branches === null ? "Unlimited" : p.branches === 1 ? "1" : `Up to ${p.branches}`)),
      },
      { label: "Owner, admin and employee roles", values: ALL },
    ],
  },
  {
    title: "Modules",
    rows: [
      { label: "Dashboard and Calendar", values: ALL },
      { label: "CRM, Sales and Marketing", values: ALL },
      { label: "Invoicing, Returns and Support", values: ALL },
      { label: "Inventory and Procurement", values: ALL },
      { label: "Projects", values: ALL },
      { label: "Accounting", values: ALL },
      { label: "HR, Payroll and Team", values: ALL },
      { label: "Reports", values: ALL },
      { label: "Stock transfers between branches", values: withFeature("transfers") },
      { label: "Planning / MRP", values: withFeature("mrp") },
      { label: "Controlling", values: withFeature("controlling") },
      { label: "Automations and scheduled report emails", values: withFeature("automation") },
      { label: "EDI with your trading partners", values: withFeature("edi") },
    ],
  },
  {
    title: "AI and integrations",
    rows: [
      { label: "AI Copilot requests a month", values: perPlan((p) => p.aiRequests.toLocaleString("en-US")) },
      { label: "AI asks before it acts", values: ALL },
      { label: "Extra AI requests, never expire", values: perPlan(() => `$${AI_TOPUP_PRICE} per ${AI_TOPUP_REQUESTS}`) },
      { label: "Google integration for Gmail and Calendar", values: ALL },
      { label: "Email for invoices, reminders and notifications", values: ALL },
    ],
  },
  {
    title: "Data and support",
    rows: [
      { label: "Export your data anytime", values: ALL },
      { label: "Cancel anytime", values: ALL },
      { label: "14 day free trial", values: ALL },
      { label: "Support", values: ["Email", "Faster email", "Priority"] },
    ],
  },
];
