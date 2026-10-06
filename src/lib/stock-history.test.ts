import { describe, it, expect } from "vitest";
import { planAdjustment, productDeleteBlocker } from "@/lib/stock-history";

describe("planAdjustment", () => {
  it("sets a counted quantity", () => {
    expect(planAdjustment({ mode: "count", value: 7, current: 10, reason: "COUNT" })).toEqual({ delta: -3 });
    expect(planAdjustment({ mode: "count", value: 12, current: 10, reason: "COUNT" })).toEqual({ delta: 2 });
  });

  it("adds or takes a change", () => {
    expect(planAdjustment({ mode: "change", value: -2, current: 10, reason: "DAMAGED" })).toEqual({ delta: -2 });
    expect(planAdjustment({ mode: "change", value: 4, current: 0, reason: "FOUND" })).toEqual({ delta: 4 });
  });

  it("never goes below zero", () => {
    expect(planAdjustment({ mode: "change", value: -11, current: 10, reason: "LOST" })).toHaveProperty("error");
    expect(planAdjustment({ mode: "count", value: -1, current: 10, reason: "COUNT" })).toHaveProperty("error");
  });

  it("rejects no change and fractions", () => {
    expect(planAdjustment({ mode: "count", value: 10, current: 10, reason: "COUNT" })).toHaveProperty("error");
    expect(planAdjustment({ mode: "change", value: 0, current: 10, reason: "OTHER" })).toHaveProperty("error");
    expect(planAdjustment({ mode: "change", value: 1.5, current: 10, reason: "OTHER" })).toHaveProperty("error");
  });

  it("keeps reasons honest about direction", () => {
    expect(planAdjustment({ mode: "change", value: 3, current: 10, reason: "DAMAGED" })).toHaveProperty("error");
    expect(planAdjustment({ mode: "change", value: 3, current: 10, reason: "LOST" })).toHaveProperty("error");
    expect(planAdjustment({ mode: "change", value: -3, current: 10, reason: "FOUND" })).toHaveProperty("error");
    expect(planAdjustment({ mode: "count", value: 8, current: 10, reason: "OTHER" })).toEqual({ delta: -2 });
  });
});

describe("productDeleteBlocker", () => {
  const none = { orders: false, quotes: false, deals: false, purchaseOrders: false, returns: false, workOrders: false, billsOfMaterials: false, transfers: false, lots: false };

  it("allows unused products", () => {
    expect(productDeleteBlocker(none)).toBeNull();
  });

  it("names every place the product is used", () => {
    expect(productDeleteBlocker({ ...none, quotes: true })).toMatch(/used in quotes,/);
    expect(productDeleteBlocker({ ...none, quotes: true, purchaseOrders: true, returns: true })).toMatch(/quotes, purchase orders and returns/);
  });
});

describe("planAdjustment for weighed products", () => {
  it("allows decimals for kg and keeps whole numbers for each", () => {
    expect(planAdjustment({ mode: "change", value: 1.35, current: 10, reason: "OTHER", unit: "KG" })).toEqual({ delta: 1.35 });
    expect(planAdjustment({ mode: "count", value: 2.5, current: 3, reason: "COUNT", unit: "KG" })).toEqual({ delta: -0.5 });
    expect(planAdjustment({ mode: "change", value: 1.35, current: 10, reason: "OTHER", unit: "EACH" })).toHaveProperty("error");
  });

  it("explains a shortfall in kilograms", () => {
    const plan = planAdjustment({ mode: "change", value: -2, current: 1.25, reason: "LOST", unit: "KG" });
    expect(plan).toEqual({ error: "That would leave -0.75 kg in stock. There are only 1.25 kg here." });
  });
});
