/* The subscription plans, in one place so the pricing page, the comparison
   table and (later) billing and plan limits all read the same numbers.
   Each plan includes a number of users; more can be added per user on any
   plan. Prices are USD, with a rough Rand guide for South African buyers. Public copy uses no hyphens.

   lib/plan-limits.ts applies these limits in the app. Billing still sells
   the single $49 Stripe price (lib/actions/billing.ts), so every company is
   on SCALE until checkout records a real plan. */

export type PlanId = "solo" | "starter" | "growth" | "business" | "scale";

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
  /** Whether more users can be added at EXTRA_USER_PRICE. Off on Solo, so
   * Solo plus extras can never undercut Starter or Growth. */
  extraUsers: boolean;
  /** Branches allowed; null means unlimited. */
  branches: number | null;
  /** AI Copilot requests a month. */
  aiRequests: number;
  /** Support level shown in the comparison table. */
  support: string;
  /** One line on what this plan adds over the one before, if anything
   * beyond more users, branches and AI requests (Billing plan list). */
  adds?: string;
  /** Heading above the feature list, e.g. "Everything in Starter, plus". */
  includesLabel: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    tagline: "For very small teams getting started.",
    monthly: 79,
    yearly: 790,
    users: 3,
    extraUsers: false,
    branches: 1,
    aiRequests: 150,
    support: "Email",
    includesLabel: "What's included",
    features: [
      "Up to 3 users with owner, admin and employee roles",
      "1 branch",
      "CRM, Sales, Invoicing, Returns, Support and Marketing",
      "Inventory, Procurement, Projects and Accounting",
      "HR, Payroll and Team",
      "AI Copilot with 150 requests a month",
      "Email support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For one location getting everything in one place.",
    monthly: 229,
    yearly: 2290,
    users: 10,
    extraUsers: true,
    branches: 1,
    aiRequests: 500,
    support: "Email",
    adds: "Google integration",
    includesLabel: "Everything in Solo, plus",
    features: ["Up to 10 users", "Google integration for Gmail and Calendar", "AI Copilot with 500 requests a month"],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For growing businesses with more than one location.",
    monthly: 599,
    yearly: 5990,
    popular: true,
    users: 30,
    extraUsers: true,
    branches: 3,
    aiRequests: 1500,
    support: "Faster email",
    adds: "Transfers, MRP, Controlling, Automations",
    includesLabel: "Everything in Starter, plus",
    features: [
      "Up to 30 users",
      "Up to 3 branches",
      "Stock transfers between branches",
      "Planning / MRP and Controlling",
      "Automations and scheduled report emails",
      "AI Copilot with 1,500 requests a month",
      "Faster email support",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For established teams across several sites.",
    monthly: 899,
    yearly: 8990,
    users: 50,
    extraUsers: true,
    branches: 5,
    aiRequests: 2500,
    support: "Faster email",
    includesLabel: "Everything in Growth, plus",
    features: ["Up to 50 users", "Up to 5 branches", "AI Copilot with 2,500 requests a month"],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For distributors and larger teams across many sites.",
    monthly: 1599,
    yearly: 15990,
    users: 100,
    extraUsers: true,
    branches: null,
    aiRequests: 5000,
    support: "Priority",
    adds: "EDI, priority support",
    includesLabel: "Everything in Business, plus",
    features: [
      "Up to 100 users",
      "Unlimited branches",
      "EDI with your trading partners",
      "AI Copilot with 5,000 requests a month",
      "Priority support",
    ],
  },
];

/** The cheapest plan a month for a team of `users` (counting open
 * invites) and `branches` active branches, counting extra users above a
 * plan's included ones. Branches are a hard limit; Scale when none fits. */
export function recommendedPlan(users: number, branches: number): Plan {
  const monthlyCost = (p: Plan) => p.monthly + Math.max(0, users - p.users) * EXTRA_USER_PRICE;
  const fitting = PLANS.filter(
    (p) => (p.branches === null || p.branches >= branches) && (p.extraUsers || users <= p.users)
  );
  return fitting.reduce((best, p) => (monthlyCost(p) < monthlyCost(best) ? p : best), fitting[fitting.length - 1]);
}

/** Modules that need more than Solo, and the lowest plan that has them. */
export type PlanFeature = "integrations" | "transfers" | "mrp" | "controlling" | "automation" | "edi";

export const FEATURE_MIN_PLAN: Record<PlanFeature, PlanId> = {
  integrations: "starter",
  transfers: "growth",
  mrp: "growth",
  controlling: "growth",
  automation: "growth",
  edi: "scale",
};

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  integrations: "Integrations",
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
  const match = /^aibos_(solo|starter|growth|business|scale)_(monthly|yearly)$/.exec(key ?? "");
  return match ? { planId: match[1] as PlanId, interval: match[2] as BillingInterval } : null;
}

/** An AI top-up pack: bought once on Billing, used after the plan's
 * monthly requests run out, never expires. */
export const AI_TOPUP_REQUESTS = 500;
export const AI_TOPUP_PRICE = 20;
export const AI_TOPUP_LOOKUP_KEY = "aibos_ai_topup_500";

/** Monthly price for each user beyond a plan's included users. */
export const EXTRA_USER_PRICE = 19;
/** Yearly price per extra user: ten months, like the plans' 2 months free. */
export const EXTRA_USER_YEARLY_PRICE = EXTRA_USER_PRICE * 10;

/** The "Extra users" Stripe price for a billing period. Its quantity on a
 * subscription is the number of members above the plan's included users. */
export function extraUserLookupKey(interval: BillingInterval): string {
  return `aibos_extra_user_${interval}`;
}

/** Most people on any plan, extra users included; bigger companies get an Enterprise quote. */
export const MAX_USERS = 150;

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
export type PlanRow = { label: string; values: PlanCell[] };
export type PlanRowGroup = { title: string; rows: PlanRow[] };

type Row = PlanCell[];
const ALL: Row = PLANS.map(() => true);
const perPlan = (f: (plan: Plan) => PlanCell): Row => PLANS.map(f);
const withFeature = (feature: PlanFeature) => perPlan((p) => planIncludes(p.id, feature));

/** Every feature by plan (in PLANS order), for the pricing page's
 * comparison table. Keep it in step with each plan's `features` above. */
export const PLAN_MATRIX: PlanRowGroup[] = [
  {
    title: "Team and locations",
    rows: [
      { label: "Users included", values: perPlan((p) => String(p.users)) },
      { label: "Extra users, each a month", values: perPlan((p) => (p.extraUsers ? `$${EXTRA_USER_PRICE}` : false)) },
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
    // Every CRM feature comes with every plan.
    title: "CRM and sales",
    rows: [
      { label: "Deals pipeline board with win chances", values: ALL },
      { label: "Activity history and reminders on the calendar", values: ALL },
      { label: "Account owners and lead sources", values: ALL },
      { label: "Quotes that become orders, with PDF and email", values: ALL },
      { label: "Sales report with forecast and win rate", values: ALL },
      { label: "Import customers from a CSV file", values: ALL },
    ],
  },
  {
    title: "AI and integrations",
    rows: [
      { label: "AI Copilot requests a month", values: perPlan((p) => p.aiRequests.toLocaleString("en-US")) },
      { label: "AI asks before it acts", values: ALL },
      { label: "Extra AI requests, never expire", values: perPlan(() => `$${AI_TOPUP_PRICE} per ${AI_TOPUP_REQUESTS}`) },
      { label: "Google integration for Gmail and Calendar", values: withFeature("integrations") },
      { label: "Email for invoices, quotes, reminders and notifications", values: ALL },
    ],
  },
  {
    title: "Data and support",
    rows: [
      { label: "Export your data anytime", values: ALL },
      { label: "Cancel anytime", values: ALL },
      { label: "14 day free trial", values: ALL },
      { label: "Support", values: perPlan((p) => p.support) },
    ],
  },
];
