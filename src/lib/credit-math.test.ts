import { describe, it, expect } from "vitest";
import { evaluateCreditCheck } from "@/lib/credit-math";

describe("evaluateCreditCheck", () => {
  it("is always within limit when no credit limit is set", () => {
    const result = evaluateCreditCheck({ outstandingBalance: 16_500, creditLimit: null, orderTotal: 5_000 });
    expect(result.withinLimit).toBe(true);
    expect(result.amountOverLimit).toBe(0);
    expect(result.projectedBalance).toBe(21_500);
  });

  it("matches the course's credit management scenario: 16,500 + 5,000 against a 20,000 limit", () => {
    const result = evaluateCreditCheck({ outstandingBalance: 16_500, creditLimit: 20_000, orderTotal: 5_000 });
    expect(result.projectedBalance).toBe(21_500);
    expect(result.withinLimit).toBe(false);
    expect(result.amountOverLimit).toBe(1_500);
  });

  it("is within limit when the projected balance equals the limit exactly", () => {
    const result = evaluateCreditCheck({ outstandingBalance: 15_000, creditLimit: 20_000, orderTotal: 5_000 });
    expect(result.withinLimit).toBe(true);
    expect(result.amountOverLimit).toBe(0);
  });

  it("is within limit when there is room to spare", () => {
    const result = evaluateCreditCheck({ outstandingBalance: 1_000, creditLimit: 20_000, orderTotal: 500 });
    expect(result.withinLimit).toBe(true);
    expect(result.amountOverLimit).toBe(0);
  });

  it("treats a zero credit limit as a real, enforced limit", () => {
    const result = evaluateCreditCheck({ outstandingBalance: 0, creditLimit: 0, orderTotal: 1 });
    expect(result.withinLimit).toBe(false);
    expect(result.amountOverLimit).toBe(1);
  });
});
