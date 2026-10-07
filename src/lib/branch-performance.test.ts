import { describe, expect, it } from "vitest";
import { branchInsights, scoreBranches, type BranchFigures } from "@/lib/branch-performance";

const branch = (over: Partial<BranchFigures>): BranchFigures => ({
  id: "b",
  name: "Branch",
  revenue: 10000,
  revenuePrev: 10000,
  expenses: 9000,
  orders: 50,
  revenueByMonth: [],
  overdue: 0,
  lowStock: 0,
  expiring: 0,
  stockValue: 5000,
  employees: 4,
  ...over,
});

describe("scoreBranches", () => {
  it("ranks the healthier, faster growing branch first and marks it top", () => {
    const [first, second] = scoreBranches([
      branch({ id: "a", name: "Athlone", revenue: 9000, revenuePrev: 10000, expenses: 8800 }),
      branch({ id: "b", name: "Bellville", revenue: 12000, revenuePrev: 10000, expenses: 10200 }),
    ]);
    expect(first.name).toBe("Bellville");
    expect(first.rank).toBe(1);
    expect(first.status).toBe("top");
    expect(first.growthPct).toBeCloseTo(20);
    expect(first.marginPct).toBeCloseTo(15);
    expect(second.rank).toBe(2);
  });

  it("flags a branch that loses money or carries overdue and expiring amounts", () => {
    const scored = scoreBranches([
      branch({ id: "a", name: "Athlone", revenue: 10000, expenses: 11000, overdue: 900, expiring: 400 }),
      branch({ id: "b", name: "Bellville" }),
    ]);
    const athlone = scored.find((s) => s.id === "a")!;
    expect(athlone.status).toBe("attention");
    expect(athlone.flags).toEqual(["Losing money", "R\u00a0900 overdue", "R\u00a0400 expiring soon"]);
  });

  it("handles a branch with no revenue yet", () => {
    const [only] = scoreBranches([branch({ revenue: 0, revenuePrev: 0, expenses: 0, orders: 0 })]);
    expect(only.marginPct).toBeNull();
    expect(only.growthPct).toBeNull();
    expect(only.avgOrder).toBeNull();
    expect(only.status).toBe("steady");
  });
});

describe("branchInsights", () => {
  it("names the leader, the fastest grower, the margin gap and today's actions, without dashes", () => {
    const scored = scoreBranches([
      branch({ id: "m", name: "Main store", revenue: 20000, revenuePrev: 19000, expenses: 17000 }),
      branch({ id: "b", name: "Bellville", revenue: 12000, revenuePrev: 10000, expenses: 10500 }),
      branch({ id: "a", name: "Athlone", revenue: 8000, revenuePrev: 9000, expenses: 7900, expiring: 150, overdue: 300, lowStock: 2 }),
    ]);
    const text = branchInsights(scored, 3).map((i) => i.text);
    expect(text[0]).toBe("Main store brings in the most: R\u00a020,000, 50% of all revenue.");
    expect(text).toContain("Bellville is growing fastest, up 20% on the period before.");
    expect(text).toContain("Athlone is down 11% on the period before. Worth a visit to find out why.");
    expect(text.some((t) => t.startsWith("Athlone keeps 1% of its revenue as profit"))).toBe(true);
    expect(text).toContain("Athlone has R\u00a0150 of stock expiring in the next 3 days. Move it to a busier branch or mark it down.");
    expect(text).toContain("Athlone has R\u00a0300 in overdue invoices to follow up.");
    expect(text.join(" ")).not.toMatch(/[—–-]/);
  });

  it("lists several branches' expiring stock and overdue money in one line each", () => {
    const scored = scoreBranches([
      branch({ id: "a", name: "Athlone", expiring: 120, overdue: 50 }),
      branch({ id: "b", name: "Bellville", expiring: 300, overdue: 80 }),
    ]);
    const text = branchInsights(scored, 3).map((i) => i.text);
    expect(text).toContain("Stock expiring in the next 3 days: Bellville R\u00a0300, Athlone R\u00a0120. Move it to a busier branch or mark it down.");
    expect(text).toContain("Overdue invoices to follow up: Bellville R\u00a080, Athlone R\u00a050.");
  });

  it("says nothing stands out when every branch is fine", () => {
    const scored = scoreBranches([branch({ id: "a", name: "Athlone" })]);
    expect(branchInsights(scored, 3)).toEqual([{ tone: "info", branchId: null, text: "Nothing stands out: every branch is on track." }]);
  });
});
