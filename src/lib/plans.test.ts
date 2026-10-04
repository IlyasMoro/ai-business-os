import { describe, expect, it } from "vitest";
import {
  EXTRA_USER_PRICE,
  EXTRA_USER_YEARLY_PRICE,
  extraUserLookupKey,
  FEATURE_MIN_PLAN,
  MAX_USERS,
  CUSTOM_PLAN,
  LISTED_PLANS,
  PLAN_MATRIX,
  PLANS,
  planById,
  parsePriceLookupKey,
  planIncludes,
  priceLookupKey,
  recommendedPlan,
} from "./plans";

// The plan cards (each plan's `features` text) and the comparison table
// (PLAN_MATRIX) must never quote different numbers.

const row = (label: string) => PLAN_MATRIX.flatMap((g) => g.rows).find((r) => r.label === label)!;
const fmt = (n: number) => n.toLocaleString("en-US");

describe("plans", () => {
  it("quotes each plan's users, branches and AI requests on its card", () => {
    LISTED_PLANS.forEach((plan, i) => {
      const text = plan.features.join(" | ");
      expect(text).toContain(`Up to ${fmt(plan.users)} users`);
      expect(text).toContain(`AI Copilot with ${fmt(plan.aiRequests)} requests a month`);
      // Cards list what's new over the plan before, so branches appear
      // only where the allowance changes.
      if (i === 0 || plan.branches !== LISTED_PLANS[i - 1].branches) {
        const branches =
          plan.branches === null ? "Unlimited branches" : plan.branches === 1 ? "1 branch" : `Up to ${plan.branches} branches`;
        expect(text).toContain(branches);
      }
    });
  });

  it("shows the same numbers in the comparison table", () => {
    // The last column is Enterprise, built per client from unit prices.
    expect(row("Users included").values).toEqual([...LISTED_PLANS.map((p) => String(p.users)), "40 to 500"]);
    expect(row("AI Copilot requests a month").values).toEqual([...LISTED_PLANS.map((p) => fmt(p.aiRequests)), "1,000 and up"]);
    expect(row("Branches").values).toEqual(["1", "Up to 3", "3, then $25 each"]);
    expect(row("Extra users, each a month").values).toEqual([...LISTED_PLANS.map(() => `$${EXTRA_USER_PRICE}`), "$16"]);
  });

  it("gives more on every step up and keeps yearly at 10 months", () => {
    for (let i = 1; i < PLANS.length; i++) {
      expect(PLANS[i].users).toBeGreaterThan(PLANS[i - 1].users);
      expect(PLANS[i].aiRequests).toBeGreaterThan(PLANS[i - 1].aiRequests);
      expect(PLANS[i].monthly).toBeGreaterThan(PLANS[i - 1].monthly);
    }
    for (const plan of PLANS) expect(plan.yearly).toBe(plan.monthly * 10);
    expect(MAX_USERS).toBe(150);
    // Bigger teams pay less per user.
    for (let i = 1; i < PLANS.length; i++) {
      expect(PLANS[i].monthly / PLANS[i].users).toBeLessThan(PLANS[i - 1].monthly / PLANS[i - 1].users);
    }
  });

  it("gives every table row one value per plan", () => {
    for (const r of PLAN_MATRIX.flatMap((g) => g.rows)) expect(r.values).toHaveLength(LISTED_PLANS.length + 1);
  });

  it("puts each Growth and Scale module on the right plans", () => {
    expect(planIncludes("solo", "integrations")).toBe(false);
    expect(planIncludes("starter", "integrations")).toBe(true);
    expect(planIncludes("starter", "transfers")).toBe(false);
    expect(planIncludes("business", "automation")).toBe(true);
    expect(planIncludes("business", "edi")).toBe(false);
    expect(planIncludes("growth", "transfers")).toBe(true);
    expect(planIncludes("growth", "automation")).toBe(true);
    expect(planIncludes("growth", "edi")).toBe(false);
    expect(planIncludes("scale", "edi")).toBe(true);
    // Scale has everything.
    for (const feature of Object.keys(FEATURE_MIN_PLAN) as (keyof typeof FEATURE_MIN_PLAN)[]) {
      expect(planIncludes("scale", feature)).toBe(true);
      expect(planIncludes("solo", feature)).toBe(false);
    }
  });

  it("reads a Stripe price lookup key back to its plan and period", () => {
    for (const plan of PLANS) {
      for (const interval of ["monthly", "yearly"] as const) {
        expect(parsePriceLookupKey(priceLookupKey(plan.id, interval))).toEqual({ planId: plan.id, interval });
      }
    }
    // The old single $49 price has no plan key and must not change the plan.
    expect(parsePriceLookupKey(null)).toBeNull();
    expect(parsePriceLookupKey("aibos_enterprise_monthly")).toBeNull();
  });

  it("prices extra users at $19 a month or ten months a year, apart from the plans", () => {
    expect(EXTRA_USER_PRICE).toBe(19);
    expect(EXTRA_USER_YEARLY_PRICE).toBe(190);
    // An extra user line must never be read as a plan.
    expect(parsePriceLookupKey(extraUserLookupKey("monthly"))).toBeNull();
    expect(parsePriceLookupKey(extraUserLookupKey("yearly"))).toBeNull();
  });

  it("sells Starter and Growth online, Enterprise through sales; Solo and Business stay for existing companies", () => {
    expect(LISTED_PLANS.map((p) => p.id)).toEqual(["starter", "growth"]);
    expect(planById(CUSTOM_PLAN.id).name).toBe("Enterprise");
    expect(PLANS.map((p) => p.id)).toEqual(["solo", "starter", "growth", "business", "scale"]);
  });

  it("recommends the cheapest plan on sale that fits the team, counting extra users", () => {
    // Solo isn't on sale, so even one person is offered Starter.
    expect(recommendedPlan(1, 1).id).toBe("starter");
    expect(recommendedPlan(7, 1).id).toBe("starter");
    // Starter with 2 extra users ($267) beats Growth ($599).
    expect(recommendedPlan(12, 1).id).toBe("starter");
    // At 30 people Growth is cheaper than Starter plus 20 extras.
    expect(recommendedPlan(30, 1).id).toBe("growth");
    expect(recommendedPlan(7, 2).id).toBe("growth");
    // More branches than Growth allows: Enterprise (the "scale" plan).
    expect(recommendedPlan(40, 4).id).toBe("scale");
    expect(recommendedPlan(40, 8).id).toBe("scale");
    // One branch fits Growth, with extra users, at any team size.
    expect(recommendedPlan(140, 1).id).toBe("growth");
  });

  it("never lets a smaller plan plus extra users undercut the next plan up", () => {
    for (let i = 1; i < PLANS.length; i++) {
      const smaller = PLANS[i - 1];
      const bigger = PLANS[i];
      if (!smaller.extraUsers) continue;
      const smallerFilled = smaller.monthly + (bigger.users - smaller.users) * EXTRA_USER_PRICE;
      expect(smallerFilled).toBeGreaterThan(bigger.monthly);
    }
  });
});
