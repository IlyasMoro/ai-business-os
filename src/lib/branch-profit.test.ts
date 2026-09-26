import { describe, it, expect } from "vitest";
import { profitByBranch, profitCsvRows } from "@/lib/branch-profit";

const branches = [
  { id: "main", name: "Main branch" },
  { id: "north", name: "North" },
];

describe("profitByBranch", () => {
  it("adds income and expenses per branch with net and margin", () => {
    const { rows, total } = profitByBranch(
      [
        { type: "INCOME", amount: 1000, branchId: "main" },
        { type: "EXPENSE", amount: 400, branchId: "main" },
        { type: "INCOME", amount: 200, branchId: "north" },
        { type: "EXPENSE", amount: 300, branchId: "north" },
      ],
      branches
    );
    expect(rows).toEqual([
      { branchId: "main", name: "Main branch", income: 1000, expense: 400, net: 600, marginPct: 60 },
      { branchId: "north", name: "North", income: 200, expense: 300, net: -100, marginPct: -50 },
    ]);
    expect(total).toMatchObject({ income: 1200, expense: 700, net: 500 });
  });

  it("lists branches with no money as zero, with no margin", () => {
    const { rows } = profitByBranch([], branches);
    expect(rows.map((r) => [r.name, r.net, r.marginPct])).toEqual([
      ["Main branch", 0, null],
      ["North", 0, null],
    ]);
  });

  it("keeps money without a branch (or on a missing one) in a company wide row", () => {
    const { rows, total } = profitByBranch(
      [
        { type: "EXPENSE", amount: 50, branchId: null },
        { type: "EXPENSE", amount: 25, branchId: "gone" },
        { type: "INCOME", amount: 100, branchId: "main" },
      ],
      branches
    );
    expect(rows.at(-1)).toMatchObject({ branchId: null, name: "Company wide", expense: 75 });
    expect(total.net).toBe(25);
  });
});

describe("profitCsvRows", () => {
  it("gives one row per branch plus the total, with blank margin when nothing came in", () => {
    const { rows, total } = profitByBranch(
      [
        { type: "INCOME", amount: 10, branchId: "x" },
        { type: "EXPENSE", amount: 4, branchId: "y" },
      ],
      [
        { id: "x", name: "Shop A" },
        { id: "y", name: "Shop B" },
      ]
    );
    expect(profitCsvRows(rows, total)).toEqual([
      ["Shop A", "10.00", "0.00", "10.00", "100.0"],
      ["Shop B", "0.00", "4.00", "-4.00", ""],
      ["All branches", "10.00", "4.00", "6.00", "60.0"],
    ]);
  });
});
