import { describe, expect, it } from "vitest";
import { formatQty, hasEnough, isWeighed, qtyStep, quantityError, roundQty } from "./quantity";

describe("quantity", () => {
  it("rounds to 3 decimals and removes float noise", () => {
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
    expect(roundQty(1.23456)).toBe(1.235);
    expect(roundQty(12)).toBe(12);
  });

  it("allows decimals only for weighed units", () => {
    expect(isWeighed("KG")).toBe(true);
    expect(isWeighed("L")).toBe(true);
    expect(isWeighed("EACH")).toBe(false);
    expect(quantityError(1.35, "KG")).toBeNull();
    expect(quantityError(0.005, "KG")).toBeNull();
    expect(quantityError(1.2345, "KG")).toMatch(/3 decimals/);
    expect(quantityError(3, "EACH")).toBeNull();
    expect(quantityError(2.5, "EACH")).toMatch(/whole number/);
    expect(quantityError(2.5, undefined)).toMatch(/whole number/);
    expect(quantityError(Number.NaN, "KG")).toMatch(/valid/);
  });

  it("treats a float sum of whole pieces as whole", () => {
    expect(quantityError(0.1 * 30, "EACH")).toBeNull();     // 3.0000000000000004
  });

  it("compares stock without float noise", () => {
    expect(hasEnough(0.1 + 0.2, 0.3)).toBe(true);
    expect(hasEnough(1.349, 1.35)).toBe(false);
  });

  it("formats with the unit for weighed products", () => {
    expect(formatQty(1.35, "KG")).toBe("1.35 kg");
    expect(formatQty(1350.5, "KG")).toBe("1,350.5 kg");
    expect(formatQty(2, "L")).toBe("2 L");
    expect(formatQty(12, "EACH")).toBe("12");
    expect(formatQty(0.1 + 0.2)).toBe("0.3");
  });

  it("gives inputs a decimal step only when weighed", () => {
    expect(qtyStep("KG")).toBe("0.001");
    expect(qtyStep("EACH")).toBe("1");
  });
});
