import { describe, expect, it } from "vitest";
import {
  ENTERPRISE,
  ENTERPRISE_FROM,
  enterpriseFor,
  enterpriseFromItems,
  enterpriseLimits,
  enterpriseLookupKey,
  enterpriseQuantities,
  enterpriseQuote,
  normalizeEnterprise,
  parseEnterpriseLookupKey,
} from "@/lib/enterprise";
import { planById } from "@/lib/plans";

describe("Enterprise pricing", () => {
  it("prices users, branches over 3, EDI and AI packs", () => {
    const quote = enterpriseQuote({ users: 48, branches: 6, edi: true, aiPacks: 2 });
    expect(quote.lines.map((l) => [l.part, l.quantity, l.amount])).toEqual([
      ["user", 48, 768],
      ["branch", 3, 75],
      ["edi", 1, 99],
      ["ai", 2, 40],
    ]);
    expect(quote.total).toBe(982);
  });

  it("charges ten months for a year", () => {
    const year = enterpriseQuote({ users: 40, branches: 3, edi: false, aiPacks: 0 }, "yearly");
    expect(year.total).toBe(6400);
    expect(year.monthly).toBe(640);
  });

  it("starts above Growth, so it never undercuts it", () => {
    expect(ENTERPRISE_FROM).toBe(640);
    expect(ENTERPRISE_FROM).toBeGreaterThan(planById("growth").monthly);
    expect(enterpriseQuote({ users: 40, branches: 1, edi: false, aiPacks: 0 }).lines).toHaveLength(1);
  });

  it("brings any input into range", () => {
    expect(normalizeEnterprise({ users: "12", branches: "0", edi: "on", aiPacks: 999 })).toEqual({
      users: ENTERPRISE.minUsers,
      branches: 1,
      edi: true,
      aiPacks: ENTERPRISE.maxAiPacks,
    });
    expect(normalizeEnterprise({ users: "abc" }).users).toBe(ENTERPRISE.minUsers);
    expect(normalizeEnterprise({ users: 10_000 }).users).toBe(ENTERPRISE.maxUsers);
    expect(normalizeEnterprise({ users: 41.6 }).users).toBe(42);
  });

  it("turns a configuration into limits", () => {
    expect(enterpriseLimits({ users: 60, branches: 5, edi: false, aiPacks: 3 })).toEqual({ users: 60, branches: 5, aiRequests: 2500, edi: false });
  });

  it("suggests the smallest configuration that fits a team", () => {
    expect(enterpriseFor(12, 2)).toMatchObject({ users: 40, branches: 3 });
    expect(enterpriseFor(75, 9)).toMatchObject({ users: 75, branches: 9 });
  });
});

describe("Enterprise on Stripe", () => {
  it("names prices by part and period, and reads them back", () => {
    expect(enterpriseLookupKey("branch", "yearly")).toBe("aibos_ent_branch_yearly");
    expect(parseEnterpriseLookupKey("aibos_ent_ai_monthly")).toEqual({ part: "ai", interval: "monthly" });
    expect(parseEnterpriseLookupKey("aibos_growth_monthly")).toBeNull();
  });

  it("reads a configuration back from subscription lines", () => {
    const config = { users: 55, branches: 7, edi: true, aiPacks: 4 };
    const q = enterpriseQuantities(config);
    const items = (Object.keys(q) as (keyof typeof q)[])
      .filter((part) => q[part] > 0)
      .map((part) => ({ lookupKey: enterpriseLookupKey(part, "yearly"), quantity: q[part] }));
    expect(enterpriseFromItems([...items, { lookupKey: "aibos_extra_user_yearly", quantity: 2 }])).toEqual({ interval: "yearly", config });
    expect(enterpriseFromItems([{ lookupKey: "aibos_growth_monthly", quantity: 1 }])).toBeNull();
  });
});
