/* Enterprise, built by the client: users, branches, the EDI add-on and AI
   request packs, each priced per unit, so the plan can be bought and changed
   online. One Stripe price per part (lookup key aibos_ent_<part>_<interval>);
   quantities on the subscription say what was bought, and the company's
   custom limits are set from them (lib/stripe-sync.ts). No database access
   here. Public copy uses no hyphens. */

import type { BillingInterval } from "@/lib/plans";

export const ENTERPRISE = {
  /** A month, per user. */
  perUser: 16,
  /** Fewest users: keeps Enterprise above Growth (30 users for $599). */
  minUsers: 40,
  /** Most users bought online; bigger teams talk to sales. */
  maxUsers: 500,
  /** Branches included before each one costs perBranch. */
  includedBranches: 3,
  perBranch: 25,
  maxBranches: 100,
  /** EDI add-on, a month. */
  ediPrice: 99,
  /** AI requests a month included, then packs. */
  aiIncluded: 1000,
  aiPackSize: 500,
  aiPackPrice: 20,
  maxAiPacks: 40,
} as const;

/** Yearly is ten months, like the plans' two months free. */
const YEARLY_MONTHS = 10;

export type EnterpriseConfig = { users: number; branches: number; edi: boolean; aiPacks: number };

export type EnterprisePart = "user" | "branch" | "edi" | "ai";

export const DEFAULT_ENTERPRISE: EnterpriseConfig = { users: ENTERPRISE.minUsers, branches: ENTERPRISE.includedBranches, edi: false, aiPacks: 0 };

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Any input brought into range: whole numbers within the limits above. */
export function normalizeEnterprise(input: Partial<Record<keyof EnterpriseConfig, unknown>>): EnterpriseConfig {
  return {
    users: clampInt(input.users, ENTERPRISE.minUsers, ENTERPRISE.maxUsers, ENTERPRISE.minUsers),
    branches: clampInt(input.branches, 1, ENTERPRISE.maxBranches, ENTERPRISE.includedBranches),
    edi: input.edi === true || input.edi === "on" || input.edi === "true",
    aiPacks: clampInt(input.aiPacks, 0, ENTERPRISE.maxAiPacks, 0),
  };
}

/** Units of each part to put on the subscription; parts at 0 are left off. */
export function enterpriseQuantities(config: EnterpriseConfig): Record<EnterprisePart, number> {
  return {
    user: config.users,
    branch: Math.max(0, config.branches - ENTERPRISE.includedBranches),
    edi: config.edi ? 1 : 0,
    ai: config.aiPacks,
  };
}

/** Price of one unit of a part for the period. */
export function enterpriseUnitPrice(part: EnterprisePart, interval: BillingInterval): number {
  const monthly = { user: ENTERPRISE.perUser, branch: ENTERPRISE.perBranch, edi: ENTERPRISE.ediPrice, ai: ENTERPRISE.aiPackPrice }[part];
  return interval === "monthly" ? monthly : monthly * YEARLY_MONTHS;
}

export type QuoteLine = { part: EnterprisePart; label: string; quantity: number; unit: number; amount: number };

/** The price, line by line, for a month or a year. */
export function enterpriseQuote(config: EnterpriseConfig, interval: BillingInterval = "monthly") {
  const q = enterpriseQuantities(config);
  const extraBranches = q.branch;
  const lines: QuoteLine[] = [
    { part: "user" as const, label: `${config.users} users`, quantity: q.user },
    { part: "branch" as const, label: `${extraBranches} extra ${extraBranches === 1 ? "branch" : "branches"}`, quantity: q.branch },
    { part: "edi" as const, label: "EDI add on", quantity: q.edi },
    { part: "ai" as const, label: `${(config.aiPacks * ENTERPRISE.aiPackSize).toLocaleString("en-US")} more AI requests`, quantity: q.ai },
  ]
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const unit = enterpriseUnitPrice(l.part, interval);
      return { ...l, unit, amount: unit * l.quantity };
    });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total, monthly: interval === "monthly" ? total : total / YEARLY_MONTHS };
}

/** The cheapest Enterprise a month: the minimum users, nothing else. */
export const ENTERPRISE_FROM = ENTERPRISE.minUsers * ENTERPRISE.perUser;

/** What the app allows for a bought configuration. */
export function enterpriseLimits(config: EnterpriseConfig) {
  return {
    users: config.users,
    branches: config.branches,
    aiRequests: ENTERPRISE.aiIncluded + config.aiPacks * ENTERPRISE.aiPackSize,
    edi: config.edi,
  };
}

/** The smallest configuration that fits a team today. */
export function enterpriseFor(seats: number, branches: number): EnterpriseConfig {
  return normalizeEnterprise({ users: Math.max(ENTERPRISE.minUsers, seats), branches: Math.max(ENTERPRISE.includedBranches, branches) });
}

// ---------- Stripe ----------

export function enterpriseLookupKey(part: EnterprisePart, interval: BillingInterval): string {
  return `aibos_ent_${part}_${interval}`;
}

export function parseEnterpriseLookupKey(key: string | null | undefined): { part: EnterprisePart; interval: BillingInterval } | null {
  const match = /^aibos_ent_(user|branch|edi|ai)_(monthly|yearly)$/.exec(key ?? "");
  return match ? { part: match[1] as EnterprisePart, interval: match[2] as BillingInterval } : null;
}

/** Reads a configuration back from subscription lines (lookup key and
 * quantity), or null when there is no Enterprise users line. */
export function enterpriseFromItems(items: { lookupKey: string | null | undefined; quantity: number }[]): { config: EnterpriseConfig; interval: BillingInterval } | null {
  const parsed = items
    .map((i) => ({ key: parseEnterpriseLookupKey(i.lookupKey), quantity: i.quantity }))
    .filter((i): i is { key: { part: EnterprisePart; interval: BillingInterval }; quantity: number } => i.key !== null);
  const users = parsed.find((i) => i.key.part === "user");
  if (!users) return null;
  const qty = (part: EnterprisePart) => parsed.find((i) => i.key.part === part)?.quantity ?? 0;
  return {
    interval: users.key.interval,
    config: {
      users: users.quantity,
      branches: ENTERPRISE.includedBranches + qty("branch"),
      edi: qty("edi") > 0,
      aiPacks: qty("ai"),
    },
  };
}
