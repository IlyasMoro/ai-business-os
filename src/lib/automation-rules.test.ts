import { describe, it, expect } from "vitest";
import { needsReorder, computeReorderQuantity } from "@/lib/automation-rules";

describe("needsReorder", () => {
  it("is true when stock is at or below the reorder level", () => {
    expect(needsReorder(5, 5)).toBe(true);
    expect(needsReorder(2, 5)).toBe(true);
  });

  it("is false when stock is above the reorder level", () => {
    expect(needsReorder(10, 5)).toBe(false);
  });
});

describe("computeReorderQuantity", () => {
  it("orders enough to reach double the reorder level", () => {
    expect(computeReorderQuantity(1, 10)).toBe(19);
    expect(computeReorderQuantity(0, 5)).toBe(10);
  });

  it("never orders less than 1, even if stock already exceeds double the reorder level", () => {
    expect(computeReorderQuantity(50, 5)).toBe(1);
  });

  it("orders exactly enough when stock is already at the reorder level", () => {
    expect(computeReorderQuantity(5, 5)).toBe(5);
  });
});
