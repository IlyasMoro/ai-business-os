import { describe, it, expect } from "vitest";
import { costAfterReceipt } from "@/lib/cost-math";

describe("costAfterReceipt", () => {
  it("leaves cost alone when manual", () => {
    expect(costAfterReceipt({ method: "MANUAL", currentCost: 2, onHand: 10, lines: [{ quantity: 5, unitCost: 3 }] })).toBe(2);
  });

  it("takes the last price paid", () => {
    expect(costAfterReceipt({ method: "LAST_PRICE", currentCost: 2, onHand: 10, lines: [{ quantity: 5, unitCost: 3 }, { quantity: 1, unitCost: 3.5 }] })).toBe(3.5);
  });

  it("averages stock on hand with what arrived", () => {
    // 10 at $2 plus 10 at $3 is 20 at $2.50.
    expect(costAfterReceipt({ method: "AVERAGE", currentCost: 2, onHand: 10, lines: [{ quantity: 10, unitCost: 3 }] })).toBe(2.5);
    // Several lines for the same product.
    expect(costAfterReceipt({ method: "AVERAGE", currentCost: 0, onHand: 0, lines: [{ quantity: 1, unitCost: 1 }, { quantity: 3, unitCost: 5 }] })).toBe(4);
  });

  it("treats stock below zero as none, and ignores empty receipts", () => {
    expect(costAfterReceipt({ method: "AVERAGE", currentCost: 9, onHand: -4, lines: [{ quantity: 2, unitCost: 3 }] })).toBe(3);
    expect(costAfterReceipt({ method: "AVERAGE", currentCost: 9, onHand: 4, lines: [] })).toBe(9);
  });
});
