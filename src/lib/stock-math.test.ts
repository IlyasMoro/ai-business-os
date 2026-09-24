import { describe, it, expect } from "vitest";
import { findStockShortfalls } from "@/lib/stock-math";

describe("findStockShortfalls", () => {
  it("returns nothing when every line item is fully covered by stock", () => {
    const result = findStockShortfalls([
      { productId: "p1", productName: "NRG A", quantity: 5, stockQty: 10 },
      { productId: "p2", productName: "NRG B", quantity: 10, stockQty: 10 },
    ]);
    expect(result).toEqual([]);
  });

  it("flags a line item that asks for more than is on hand", () => {
    const result = findStockShortfalls([{ productId: "p1", productName: "NRG A", quantity: 12, stockQty: 10 }]);
    expect(result).toEqual([{ productId: "p1", productName: "NRG A", requested: 12, available: 10 }]);
  });

  it("flags only the short items, not the ones with enough stock", () => {
    const result = findStockShortfalls([
      { productId: "p1", productName: "NRG A", quantity: 12, stockQty: 10 },
      { productId: "p2", productName: "NRG B", quantity: 3, stockQty: 10 },
    ]);
    expect(result).toEqual([{ productId: "p1", productName: "NRG A", requested: 12, available: 10 }]);
  });

  it("does not flag a request exactly equal to stock on hand", () => {
    const result = findStockShortfalls([{ productId: "p1", productName: "NRG A", quantity: 10, stockQty: 10 }]);
    expect(result).toEqual([]);
  });

  it("flags a request against zero stock", () => {
    const result = findStockShortfalls([{ productId: "p1", productName: "NRG A", quantity: 1, stockQty: 0 }]);
    expect(result).toEqual([{ productId: "p1", productName: "NRG A", requested: 1, available: 0 }]);
  });
});
