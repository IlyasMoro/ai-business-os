import { describe, it, expect } from "vitest";
import {
  allocate,
  checkAvailability,
  contributionMargin,
  fiscalYearLabel,
  fiscalYearMonths,
  fiscalYearOf,
  formatInternalOrderNumber,
  periodRange,
  resolvePeriods,
  validateShares,
  variance,
} from "@/lib/controlling-math";
import { CONTROLLING_PRESETS, isControllingPreset } from "@/lib/controlling-presets";

describe("fiscal years", () => {
  it("places dates in the right fiscal year for any start month", () => {
    expect(fiscalYearOf(new Date("2026-09-25"), 1)).toBe(2026);
    expect(fiscalYearOf(new Date("2026-06-30"), 7)).toBe(2025);
    expect(fiscalYearOf(new Date("2026-07-01"), 7)).toBe(2026);
  });

  it("lists the 12 months across the calendar year boundary", () => {
    const months = fiscalYearMonths(2026, 7);
    expect(months[0]).toEqual({ year: 2026, month: 7 });
    expect(months[6]).toEqual({ year: 2027, month: 1 });
    expect(months[11]).toEqual({ year: 2027, month: 6 });
  });

  it("labels split years without a hyphen", () => {
    expect(fiscalYearLabel(2026, 1)).toBe("FY 2026");
    expect(fiscalYearLabel(2026, 7)).toBe("FY 2026/27");
  });

  it("builds a half open date range", () => {
    const r = periodRange([{ year: 2026, month: 12 }]);
    expect(r.from.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("resolves URL parameters, ignoring months outside the year", () => {
    const today = new Date("2026-09-25");
    expect(resolvePeriods(undefined, undefined, 1, today)).toMatchObject({ fiscalYear: 2026, month: null });
    expect(resolvePeriods("2026", "2026-03", 1, today).periods).toEqual([{ year: 2026, month: 3 }]);
    expect(resolvePeriods("2026", "2031-03", 1, today).month).toBeNull();
  });
});

describe("variance", () => {
  it("classifies under, near, over and no plan", () => {
    expect(variance(1000, 500).status).toBe("UNDER");
    expect(variance(1000, 950).status).toBe("NEAR");
    expect(variance(1000, 1001).status).toBe("OVER");
    expect(variance(0, 50).status).toBe("NO_PLAN");
  });

  it("respects tolerance", () => {
    expect(variance(1000, 1080, 10).status).toBe("NEAR");
    expect(variance(1000, 1120, 10).status).toBe("OVER");
  });

  it("reports the difference and percentage", () => {
    expect(variance(1000, 1250)).toMatchObject({ variance: 250, variancePercent: 25 });
  });
});

describe("checkAvailability", () => {
  const base = { budget: 1000, consumed: 900, tolerancePercent: 0 };

  it("passes when the expense fits", () => {
    expect(checkAvailability({ ...base, amount: 100, action: "BLOCK" }).result).toBe("OK");
  });

  it("warns or blocks by setting, and says by how much", () => {
    expect(checkAvailability({ ...base, amount: 150, action: "WARN" })).toEqual({ result: "WARN", available: 100, overBy: 50 });
    expect(checkAvailability({ ...base, amount: 150, action: "BLOCK" }).result).toBe("BLOCK");
    expect(checkAvailability({ ...base, amount: 150, action: "NONE" }).result).toBe("OK");
  });

  it("allows the tolerance margin", () => {
    expect(checkAvailability({ ...base, tolerancePercent: 5, amount: 150, action: "BLOCK" }).result).toBe("OK");
    expect(checkAvailability({ ...base, tolerancePercent: 5, amount: 151, action: "BLOCK" }).result).toBe("BLOCK");
  });

  it("doesn't control objects without a budget", () => {
    expect(checkAvailability({ budget: 0, consumed: 0, amount: 1e6, tolerancePercent: 0, action: "BLOCK" }).result).toBe("OK");
  });
});

describe("allocation", () => {
  it("validates shares", () => {
    expect(validateShares([60, 40])).toBeNull();
    expect(validateShares([60, 30])).toMatch(/add up to 100/);
    expect(validateShares([])).toMatch(/at least one/);
    expect(validateShares([100, 0])).toMatch(/more than 0/);
  });

  it("splits to the cent and never loses money", () => {
    const parts = allocate(100, [
      { id: "a", percent: 33.33 },
      { id: "b", percent: 33.33 },
      { id: "c", percent: 33.34 },
    ]);
    expect(parts.reduce((s, p) => s + Math.round(p.amount * 100), 0)).toBe(10000);
    expect(parts.find((p) => p.id === "c")!.amount).toBe(33.34);
  });

  it("splits odd totals exactly", () => {
    const parts = allocate(1234.57, [
      { id: "a", percent: 50 },
      { id: "b", percent: 50 },
    ]);
    expect(Math.round(parts.reduce((s, p) => s + p.amount, 0) * 100)).toBe(123457);
  });
});

describe("contributionMargin", () => {
  it("computes margin and percentage, best first", () => {
    const rows = contributionMargin([
      { key: "a", label: "A", revenue: 100, cost: 80 },
      { key: "b", label: "B", revenue: 200, cost: 50 },
      { key: "c", label: "C", revenue: 0, cost: 10 },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["b", "a", "c"]);
    expect(rows[0]).toMatchObject({ margin: 150, marginPercent: 75 });
    expect(rows[2].marginPercent).toBeNull();
  });
});

describe("misc", () => {
  it("numbers internal orders without a hyphen", () => {
    expect(formatInternalOrderNumber(3)).toBe("IO0003");
  });

  it("has presets without hyphens", () => {
    expect(isControllingPreset("strict")).toBe(true);
    expect(isControllingPreset("valueOf")).toBe(false);
    for (const p of Object.values(CONTROLLING_PRESETS)) {
      expect(p.label + p.description).not.toContain("-");
    }
  });
});
