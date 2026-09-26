import { describe, it, expect } from "vitest";
import { rankCustomers } from "@/lib/customer-ranking";

describe("rankCustomers", () => {
  it("ranks by value with share, bar length and difference from average", () => {
    const rows = rankCustomers([
      { name: "B", total: 100 },
      { name: "A", total: 300 },
      { name: "Zero", total: 0 },
    ]);
    expect(rows).toEqual([
      { rank: 1, name: "A", total: 300, sharePct: 75, barPct: 100, vsAveragePct: 50 },
      { rank: 2, name: "B", total: 100, sharePct: 25, barPct: expect.closeTo(33.33, 2), vsAveragePct: -50 },
    ]);
  });

  it("has no comparison with a single customer", () => {
    expect(rankCustomers([{ name: "Only", total: 50 }])[0].vsAveragePct).toBeNull();
  });

  it("keeps the top ones and is empty without order value", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `C${i}`, total: i + 1 }));
    expect(rankCustomers(many, 8)).toHaveLength(8);
    expect(rankCustomers([{ name: "None", total: 0 }])).toEqual([]);
  });
});
