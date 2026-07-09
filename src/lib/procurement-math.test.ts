import { describe, it, expect } from "vitest";
import { computePurchaseOrderTotal } from "@/lib/procurement-math";

describe("computePurchaseOrderTotal", () => {
  it("returns 0 for an empty list", () => {
    expect(computePurchaseOrderTotal([])).toBe(0);
  });

  it("sums quantity times unit cost across items", () => {
    expect(
      computePurchaseOrderTotal([
        { quantity: 10, unitCost: 4 },
        { quantity: 3, unitCost: 2.5 },
      ])
    ).toBe(47.5);
  });

  it("treats a zero quantity or cost as contributing nothing", () => {
    expect(computePurchaseOrderTotal([{ quantity: 0, unitCost: 100 }])).toBe(0);
    expect(computePurchaseOrderTotal([{ quantity: 5, unitCost: 0 }])).toBe(0);
  });

  it("handles a single item", () => {
    expect(computePurchaseOrderTotal([{ quantity: 7, unitCost: 3.33 }])).toBeCloseTo(23.31);
  });
});
