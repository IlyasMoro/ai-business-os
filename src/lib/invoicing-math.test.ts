import { describe, it, expect } from "vitest";
import { computeInvoiceTotal } from "@/lib/invoicing-math";

describe("computeInvoiceTotal", () => {
  it("returns 0 for an empty list", () => {
    expect(computeInvoiceTotal([])).toBe(0);
  });

  it("sums quantity times unit price across line items", () => {
    expect(
      computeInvoiceTotal([
        { quantity: 2, unitPrice: 10 },
        { quantity: 1, unitPrice: 5.5 },
      ])
    ).toBe(25.5);
  });

  it("treats a zero quantity or price as contributing nothing", () => {
    expect(computeInvoiceTotal([{ quantity: 0, unitPrice: 100 }])).toBe(0);
    expect(computeInvoiceTotal([{ quantity: 5, unitPrice: 0 }])).toBe(0);
  });

  it("handles a single line item", () => {
    expect(computeInvoiceTotal([{ quantity: 3, unitPrice: 12.99 }])).toBeCloseTo(38.97);
  });
});
