import { describe, it, expect } from "vitest";
import {
  canTransitionWorkOrder,
  explodeBom,
  formatWorkOrderNumber,
  lowLevelCodes,
  roundToLot,
  runMrp,
  wouldCreateBomCycle,
  type PlanProduct,
} from "@/lib/mrp-math";
import { MRP_PRESETS, isMrpPreset } from "@/lib/mrp-settings-presets";

function product(id: string, over: Partial<PlanProduct> = {}): PlanProduct {
  return {
    id,
    name: id,
    sku: id.toUpperCase(),
    stockQty: 0,
    safetyStock: 0,
    leadTimeDays: 0,
    lotSize: 1,
    preferredSupplierId: null,
    ...over,
  };
}

const empty = () => new Map<string, number>();

describe("work order lifecycle", () => {
  it("allows planned to in progress to completed, and cancelling while open", () => {
    expect(canTransitionWorkOrder("PLANNED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionWorkOrder("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransitionWorkOrder("PLANNED", "CANCELLED")).toBe(true);
    expect(canTransitionWorkOrder("IN_PROGRESS", "CANCELLED")).toBe(true);
  });

  it("blocks skipping the start and leaving final states", () => {
    expect(canTransitionWorkOrder("PLANNED", "COMPLETED")).toBe(false);
    expect(canTransitionWorkOrder("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransitionWorkOrder("CANCELLED", "PLANNED")).toBe(false);
  });

  it("numbers work orders without a hyphen", () => {
    expect(formatWorkOrderNumber(7)).toBe("WO0007");
  });
});

describe("wouldCreateBomCycle", () => {
  const bom = [
    { parentId: "bike", componentId: "wheel", quantity: 2 },
    { parentId: "wheel", componentId: "spoke", quantity: 32 },
  ];

  it("rejects a product using itself", () => {
    expect(wouldCreateBomCycle(bom, "bike", "bike")).toBe(true);
  });

  it("rejects a component that already contains the parent, however deep", () => {
    expect(wouldCreateBomCycle(bom, "spoke", "bike")).toBe(true);
    expect(wouldCreateBomCycle(bom, "wheel", "bike")).toBe(true);
  });

  it("allows shared components and new branches", () => {
    expect(wouldCreateBomCycle(bom, "bike", "spoke")).toBe(false);
    expect(wouldCreateBomCycle(bom, "bike", "frame")).toBe(false);
  });
});

describe("explodeBom", () => {
  it("multiplies per unit quantities and rounds up to whole units", () => {
    expect(explodeBom([{ componentId: "glue", quantity: 0.25 }, { componentId: "wheel", quantity: 2 }], 5)).toEqual([
      { componentId: "glue", required: 2 },
      { componentId: "wheel", required: 10 },
    ]);
  });
});

describe("lowLevelCodes", () => {
  it("puts a shared component at its deepest level", () => {
    const levels = lowLevelCodes(
      ["bike", "wheel", "spoke"],
      [
        { parentId: "bike", componentId: "wheel", quantity: 2 },
        { parentId: "wheel", componentId: "spoke", quantity: 32 },
        { parentId: "bike", componentId: "spoke", quantity: 4 },
      ]
    );
    expect(levels.get("bike")).toBe(0);
    expect(levels.get("wheel")).toBe(1);
    expect(levels.get("spoke")).toBe(2);
  });

  it("terminates even if the data contains a loop", () => {
    const levels = lowLevelCodes(
      ["a", "b"],
      [
        { parentId: "a", componentId: "b", quantity: 1 },
        { parentId: "b", componentId: "a", quantity: 1 },
      ]
    );
    expect(levels.size).toBe(2);
  });
});

describe("roundToLot", () => {
  it("rounds shortfalls up to whole lots", () => {
    expect(roundToLot(0, 10)).toBe(0);
    expect(roundToLot(1, 10)).toBe(10);
    expect(roundToLot(10, 10)).toBe(10);
    expect(roundToLot(11, 10)).toBe(20);
    expect(roundToLot(3, 0)).toBe(3);
  });
});

describe("runMrp", () => {
  const today = new Date("2026-09-24T00:00:00Z");

  it("nets demand against stock, on order and safety stock", () => {
    const [row] = runMrp({
      products: [product("widget", { stockQty: 4, safetyStock: 3, lotSize: 5, leadTimeDays: 7 })],
      bom: [],
      salesDemand: new Map([["widget", 10]]),
      scheduledReceipts: new Map([["widget", 2]]),
      openWorkOrderDemand: empty(),
      today,
    });
    // 10 + 3 safety - (4 + 2) = 7 short, rounded up to 2 lots of 5.
    expect(row.shortfall).toBe(7);
    expect(row.plannedQty).toBe(10);
    expect(row.action).toBe("BUY");
    expect(row.availableBy.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("plans nothing when stock covers demand", () => {
    const [row] = runMrp({
      products: [product("widget", { stockQty: 20, safetyStock: 5 })],
      bom: [],
      salesDemand: new Map([["widget", 10]]),
      scheduledReceipts: empty(),
      openWorkOrderDemand: empty(),
      today,
    });
    expect(row.plannedQty).toBe(0);
  });

  it("passes a made product's plan down through every level of its BOM", () => {
    const rows = runMrp({
      products: [
        product("bike", { stockQty: 1 }),
        product("wheel", { stockQty: 2 }),
        product("spoke", { stockQty: 10, lotSize: 100 }),
      ],
      bom: [
        { parentId: "bike", componentId: "wheel", quantity: 2 },
        { parentId: "wheel", componentId: "spoke", quantity: 32 },
      ],
      salesDemand: new Map([["bike", 5]]),
      scheduledReceipts: empty(),
      openWorkOrderDemand: empty(),
      today,
    });
    const byId = new Map(rows.map((r) => [r.productId, r]));
    // 5 bikes wanted, 1 on hand: make 4.
    expect(byId.get("bike")).toMatchObject({ action: "MAKE", plannedQty: 4 });
    // 4 bikes need 8 wheels, 2 on hand: make 6.
    expect(byId.get("wheel")).toMatchObject({ action: "MAKE", componentDemand: 8, plannedQty: 6 });
    // 6 wheels need 192 spokes, 10 on hand: 182 short, bought in lots of 100.
    expect(byId.get("spoke")).toMatchObject({ action: "BUY", componentDemand: 192, plannedQty: 200 });
  });

  it("counts components already committed to open work orders", () => {
    const [, row] = runMrp({
      products: [product("bike"), product("wheel", { stockQty: 4 })],
      bom: [{ parentId: "bike", componentId: "wheel", quantity: 2 }],
      salesDemand: empty(),
      scheduledReceipts: empty(),
      openWorkOrderDemand: new Map([["wheel", 6]]),
      today,
    });
    expect(row).toMatchObject({ productId: "wheel", componentDemand: 6, plannedQty: 2 });
  });
});

describe("MRP presets", () => {
  it("recognises only known presets", () => {
    expect(isMrpPreset("makeToOrder")).toBe(true);
    expect(isMrpPreset("constructor")).toBe(false);
  });

  it("has no hyphens in any customer facing text", () => {
    for (const preset of Object.values(MRP_PRESETS)) {
      expect(preset.label).not.toContain("-");
      expect(preset.description).not.toContain("-");
    }
  });
});
