import { describe, it, expect } from "vitest";
import { salesSummary, stockValue } from "@/lib/report-math";

describe("stockValue", () => {
  it("values stock at cost by branch and product, ignoring negative stock", () => {
    const v = stockValue([
      { branchId: "m", branchName: "Main", productId: "a", productName: "Apple", quantity: 10, cost: 2 },
      { branchId: "n", branchName: "North", productId: "a", productName: "Apple", quantity: 5, cost: 2 },
      { branchId: "n", branchName: "North", productId: "b", productName: "Bean", quantity: -3, cost: 4 },
      { branchId: "m", branchName: "Main", productId: "c", productName: "Corn", quantity: 1, cost: 0.5 },
    ]);
    expect(v.total).toBe(30.5);
    expect(v.branches.map((b) => [b.name, b.value])).toEqual([["Main", 20.5], ["North", 10]]);
    expect(v.products.map((p) => [p.name, p.units, p.value])).toEqual([["Apple", 15, 30], ["Corn", 1, 0.5]]);
  });
});

describe("salesSummary", () => {
  it("adds orders, revenue, average and best sellers", () => {
    const s = salesSummary([
      { orderId: "1", productId: "a", productName: "Apple", quantity: 2, unitPrice: 5 },
      { orderId: "1", productId: "b", productName: "Bean", quantity: 1, unitPrice: 30 },
      { orderId: "2", productId: "a", productName: "Apple", quantity: 4, unitPrice: 5 },
    ]);
    expect(s).toMatchObject({ orderCount: 2, revenue: 60, averageOrder: 30 });
    expect(s.products.map((p) => [p.name, p.units, p.value, p.sharePct])).toEqual([["Apple", 6, 30, 50], ["Bean", 1, 30, 50]]);
  });

  it("is empty with no sales", () => {
    expect(salesSummary([])).toMatchObject({ orderCount: 0, revenue: 0, averageOrder: null, products: [] });
  });
});
