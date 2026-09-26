import { describe, it, expect } from "vitest";
import {
  describeShortfalls,
  effectiveReorderLevel,
  findBranchShortfalls,
  isLowAtBranch,
  lowStockRows,
  planRestock,
  spareQuantity,
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

describe("spareQuantity", () => {
  it("is what sits above twice the reorder level", () => {
    expect(spareQuantity(row({ quantity: 30 }))).toBe(20);
    expect(spareQuantity(row({ quantity: 8 }))).toBe(0);
    expect(spareQuantity(row({ quantity: 30, reorderLevel: 12 }))).toBe(6);
  });
});

describe("planRestock", () => {
  it("covers a low branch from another branch's spare stock instead of buying", () => {
    const plan = planRestock([
      row({ branchId: "north", branchName: "North", quantity: 2 }),
      row({ branchId: "main", quantity: 40 }),
    ]);
    // North needs 8 (twice 5, minus 2); Main can spare 30.
    expect(plan.transfers).toEqual([{ fromBranchId: "main", toBranchId: "north", lines: [{ productId: "p1", quantity: 8 }] }]);
    expect(plan.purchases.size).toBe(0);
  });

  it("buys only what the spare stock can't cover", () => {
    const plan = planRestock([
      row({ branchId: "north", quantity: 0, reorderLevel: 10 }),
      row({ branchId: "main", quantity: 16 }),
    ]);
    // North needs 20; Main keeps 10 and can spare 6.
    expect(plan.transfers[0].lines).toEqual([{ productId: "p1", quantity: 6 }]);
    expect(plan.purchases.get("north")).toEqual([{ productId: "p1", quantity: 14 }]);
  });

  it("never lets two low branches draw the same spare units twice", () => {
    const plan = planRestock([
      row({ branchId: "a", quantity: 0 }),
      row({ branchId: "b", quantity: 1 }),
      row({ branchId: "main", quantity: 22 }),
    ]);
    const moved = plan.transfers.flatMap((t) => t.lines).reduce((s, l) => s + l.quantity, 0);
    expect(moved).toBe(12); // Main's spare: 22 minus twice 5
    const bought = [...plan.purchases.values()].flat().reduce((s, l) => s + l.quantity, 0);
    expect(moved + bought).toBe(10 + 9); // a needs 10, b needs 9
  });

  it("buys when no branch has spare, and skips stock already on its way", () => {
    const rows = [row({ branchId: "north", quantity: 1 }), row({ branchId: "main", quantity: 9 })];
    expect(planRestock(rows).purchases.get("north")).toEqual([{ productId: "p1", quantity: 9 }]);
    const skipped = planRestock(rows, new Set(["north:p1"]));
    expect(skipped.transfers).toEqual([]);
    expect(skipped.purchases.size).toBe(0);
  });
});
