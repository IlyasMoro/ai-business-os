import { describe, it, expect } from "vitest";
import { matchProductColumns, parseAmount, parseUnit, planProductImport } from "@/lib/product-import";

describe("matchProductColumns", () => {
  it("recognises common headings and lists the rest", () => {
    const { columns, ignored } = matchProductColumns(["Item Code", "Product Name", "Selling Price", "Qty", "Colour"]);
    expect(columns).toEqual({ sku: 0, name: 1, price: 2, stock: 3 });
    expect(ignored).toEqual(["Colour"]);
  });
});

describe("parseAmount", () => {
  it("reads money the way people type it", () => {
    expect(parseAmount("12.50")).toBe(12.5);
    expect(parseAmount("$1,200.50")).toBe(1200.5);
    expect(parseAmount("R 1 200,50")).toBe(1200.5);
    expect(parseAmount("1,200")).toBe(1200);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("planProductImport", () => {
  const rows = [
    ["SKU", "Name", "Cost", "Price", "Stock"],
    ["A1", "Apple box", "2", "5", "10"],
    ["B2", "Banana crate", "3", "7.5", "4.7"],
    ["A1", "Apple box again", "2", "5", "1"],
    ["C3", "", "1", "1", "1"],
    ["OLD", "Existing", "1", "1", "1"],
    ["D4", "Dates", "-1", "1", "1"],
    ["E5", "Eggs", "", "", ""],
  ];
  const plan = planProductImport(rows, { existingSkus: new Set(["old"]) });

  it("imports new products with their numbers", () => {
    expect(plan.ready.map((p) => p.sku)).toEqual(["A1", "B2", "E5"]);
    expect(plan.ready[0]).toMatchObject({ name: "Apple box", cost: 2, unitPrice: 5, stockQty: 10, reorderLevel: 5 });
  });

  it("skips SKUs already on file or repeated", () => {
    expect(plan.duplicates.map((d) => d.line)).toEqual([4, 6]);
  });

  it("reports problems and warnings by row", () => {
    expect(plan.problems.map((p) => p.line)).toEqual([5, 7]);
    expect(plan.warnings.map((w) => w.line)).toEqual([3, 8]);
    expect(plan.ready[1].stockQty).toBe(4);
  });

  it("needs SKU and Name columns", () => {
    expect(planProductImport([["Name", "Price"], ["x", "1"]], { existingSkus: new Set() }).fatal).toMatch(/SKU and a Name/);
  });
});

describe("weighed products in the import", () => {
  const plan = (rows: string[][]) => planProductImport(rows, { existingSkus: new Set() });

  it("reads the Unit column and keeps kg decimals", () => {
    const p = plan([
      ["SKU", "Name", "Stock", "Unit", "Reorder level"],
      ["MINCE", "Beef mince", "12.75", "kg", "2.5"],
      ["MILK", "Milk 1L", "24", "each", "6"],
      ["OIL", "Cooking oil bulk", "40.5", "Litres", ""],
    ]);
    expect(p.problems).toEqual([]);
    expect(p.ready.map((r) => [r.sku, r.unit, r.stockQty, r.reorderLevel])).toEqual([
      ["MINCE", "KG", 12.75, 2.5],
      ["MILK", "EACH", 24, 6],
      ["OIL", "L", 40.5, 5],
    ]);
  });

  it("rounds pieces down with a hint, and refuses an unknown unit", () => {
    const p = plan([["SKU", "Name", "Stock", "Unit"], ["A", "Bread", "3.5", ""], ["B", "Rice", "10", "sack"]]);
    expect(p.ready[0]).toMatchObject({ unit: "EACH", stockQty: 3 });
    expect(p.warnings[0].message).toMatch(/kg or L/);
    expect(p.problems[0].message).toMatch(/Unit "sack"/);
  });

  it("parses unit spellings", () => {
    expect(parseUnit("KG")).toBe("KG");
    expect(parseUnit("kilograms")).toBe("KG");
    expect(parseUnit("ltr.")).toBe("L");
    expect(parseUnit("")).toBe("EACH");
    expect(parseUnit("box")).toBeNull();
  });
});
