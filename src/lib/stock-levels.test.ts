import { describe, it, expect } from "vitest";
import {
  describeShortfalls,
  effectiveReorderLevel,
  findBranchShortfalls,
  isLowAtBranch,
  lowStockRows,
  reorderPlanByBranch,
  type BranchStockRow,
} from "@/lib/stock-levels";

const row = (over: Partial<BranchStockRow>): BranchStockRow => ({
  productId: "p1",
  productName: "Widget",
  branchId: "main",
  branchName: "Main branch",
  quantity: 10,
  reorderLevel: null,
  productReorderLevel: 5,
  ...over,
});

describe("effectiveReorderLevel", () => {
  it("falls back to the product's level when the branch has none", () => {
    expect(effectiveReorderLevel(row({}))).toBe(5);
  });
  it("uses the branch's own level when set, even zero", () => {
    expect(effectiveReorderLevel(row({ reorderLevel: 20 }))).toBe(20);
    expect(effectiveReorderLevel(row({ reorderLevel: 0 }))).toBe(0);
  });
});

describe("isLowAtBranch", () => {
  it("is low at or below the level", () => {
    expect(isLowAtBranch(row({ quantity: 5 }))).toBe(true);
    expect(isLowAtBranch(row({ quantity: 6 }))).toBe(false);
  });
  it("a branch level of zero only flags an empty shelf", () => {
    expect(isLowAtBranch(row({ quantity: 1, reorderLevel: 0 }))).toBe(false);
    expect(isLowAtBranch(row({ quantity: 0, reorderLevel: 0 }))).toBe(true);
  });
});

describe("lowStockRows", () => {
  it("keeps only low rows, most urgent first", () => {
    const rows = [
      row({ branchId: "a", quantity: 4 }),
      row({ branchId: "b", quantity: 50 }),
      row({ branchId: "c", quantity: 0 }),
    ];
    expect(lowStockRows(rows).map((r) => r.branchId)).toEqual(["c", "a"]);
  });
});

describe("reorderPlanByBranch", () => {
  it("raises one plan per short branch and leaves healthy branches out", () => {
    const plan = reorderPlanByBranch([
      row({ branchId: "main", productId: "p1", quantity: 2 }),
      row({ branchId: "main", productId: "p2", quantity: 1, productReorderLevel: 3 }),
      row({ branchId: "north", productId: "p1", quantity: 40 }),
      row({ branchId: "south", productId: "p1", quantity: 0, reorderLevel: 10 }),
    ]);
    expect([...plan.keys()].sort()).toEqual(["main", "south"]);
    expect(plan.get("main")).toEqual([
      { productId: "p1", quantity: 8 },
      { productId: "p2", quantity: 5 },
    ]);
    expect(plan.get("south")).toEqual([{ productId: "p1", quantity: 20 }]);
  });
});

describe("findBranchShortfalls", () => {
  it("passes when the branch covers the order on its own", () => {
    expect(
      findBranchShortfalls([{ productId: "p1", productName: "Widget", quantity: 5, branchQty: 5, totalQty: 5 }])
    ).toEqual([]);
  });

  it("blocks when only other branches have the stock, and says how much they hold", () => {
    expect(
      findBranchShortfalls([{ productId: "p1", productName: "Widget", quantity: 5, branchQty: 2, totalQty: 12 }])
    ).toEqual([{ productId: "p1", productName: "Widget", requested: 5, available: 2, elsewhere: 10 }]);
  });

  it("adds up the same product across lines", () => {
    const result = findBranchShortfalls([
      { productId: "p1", productName: "Widget", quantity: 3, branchQty: 5, totalQty: 5 },
      { productId: "p1", productName: "Widget", quantity: 3, branchQty: 5, totalQty: 5 },
    ]);
    expect(result).toEqual([{ productId: "p1", productName: "Widget", requested: 6, available: 5, elsewhere: 0 }]);
  });
});

describe("describeShortfalls", () => {
  it("mentions other branches only when they hold stock", () => {
    expect(
      describeShortfalls(
        [
          { productId: "p1", productName: "Widget", requested: 5, available: 2, elsewhere: 10 },
          { productId: "p2", productName: "Gadget", requested: 1, available: 0, elsewhere: 0 },
        ],
        "Main branch"
      )
    ).toBe("Widget (2 at Main branch, 10 more at other branches, 5 requested), Gadget (0 at Main branch, 1 requested)");
  });
});
