import { describe, it, expect } from "vitest";
import {
  canTransitionReturn,
  computeRefund,
  formatRmaNumber,
  initialReturnStatus,
  isReturnEditable,
  isWithinReturnWindow,
  parseReturnReasons,
  returnableQuantity,
  shouldRestock,
} from "@/lib/returns-math";
import { RETURN_POLICY_PRESETS, isReturnPolicyPreset } from "@/lib/returns-policy-presets";

describe("return lifecycle", () => {
  it("allows the forward path and rejection before receipt", () => {
    expect(canTransitionReturn("REQUESTED", "APPROVED")).toBe(true);
    expect(canTransitionReturn("APPROVED", "RECEIVED")).toBe(true);
    expect(canTransitionReturn("RECEIVED", "REFUNDED")).toBe(true);
    expect(canTransitionReturn("REQUESTED", "REJECTED")).toBe(true);
    expect(canTransitionReturn("APPROVED", "REJECTED")).toBe(true);
  });

  it("blocks skipping steps and leaving final states", () => {
    expect(canTransitionReturn("REQUESTED", "RECEIVED")).toBe(false);
    expect(canTransitionReturn("REQUESTED", "REFUNDED")).toBe(false);
    expect(canTransitionReturn("RECEIVED", "REJECTED")).toBe(false);
    expect(canTransitionReturn("REFUNDED", "REQUESTED")).toBe(false);
    expect(canTransitionReturn("REJECTED", "APPROVED")).toBe(false);
  });

  it("locks line items once goods are received", () => {
    expect(isReturnEditable("REQUESTED")).toBe(true);
    expect(isReturnEditable("APPROVED")).toBe(true);
    expect(isReturnEditable("RECEIVED")).toBe(false);
    expect(isReturnEditable("REFUNDED")).toBe(false);
  });

  it("skips approval when the policy doesn't need it", () => {
    expect(initialReturnStatus(true)).toBe("REQUESTED");
    expect(initialReturnStatus(false)).toBe("APPROVED");
  });
});

describe("formatRmaNumber", () => {
  it("pads the sequence without a hyphen", () => {
    expect(formatRmaNumber(1)).toBe("RMA0001");
    expect(formatRmaNumber(12345)).toBe("RMA12345");
  });
});

describe("returnableQuantity", () => {
  it("subtracts units already claimed and never goes negative", () => {
    expect(returnableQuantity(5, 0)).toBe(5);
    expect(returnableQuantity(5, 3)).toBe(2);
    expect(returnableQuantity(5, 7)).toBe(0);
  });
});

describe("isWithinReturnWindow", () => {
  const fulfilled = new Date("2026-09-01T12:00:00Z");

  it("accepts returns up to the last day and rejects after", () => {
    expect(isWithinReturnWindow(fulfilled, 30, new Date("2026-10-01T12:00:00Z"))).toBe(true);
    expect(isWithinReturnWindow(fulfilled, 30, new Date("2026-10-01T12:00:01Z"))).toBe(false);
  });

  it("treats a window of 0 as no limit", () => {
    expect(isWithinReturnWindow(fulfilled, 0, new Date("2030-01-01"))).toBe(true);
  });
});

describe("shouldRestock", () => {
  it("restocks resellable goods, and damaged goods only when the policy allows", () => {
    expect(shouldRestock("RESELLABLE", false)).toBe(true);
    expect(shouldRestock("DAMAGED", false)).toBe(false);
    expect(shouldRestock("DAMAGED", true)).toBe(true);
  });
});

describe("computeRefund", () => {
  it("refunds the full amount with no fee", () => {
    expect(computeRefund([{ quantity: 2, unitPrice: 10 }], 0)).toEqual({ subtotal: 20, fee: 0, refund: 20 });
  });

  it("keeps back the restocking fee and rounds to cents", () => {
    expect(computeRefund([{ quantity: 3, unitPrice: 9.99 }], 15)).toEqual({ subtotal: 29.97, fee: 4.5, refund: 25.47 });
  });

  it("clamps the fee between 0 and 100 percent", () => {
    expect(computeRefund([{ quantity: 1, unitPrice: 50 }], 150).refund).toBe(0);
    expect(computeRefund([{ quantity: 1, unitPrice: 50 }], -5).refund).toBe(50);
  });
});

describe("parseReturnReasons", () => {
  it("splits lines, trims, and drops blanks and duplicates", () => {
    expect(parseReturnReasons(" Damaged \r\n\nWrong item\nDamaged\n")).toEqual(["Damaged", "Wrong item"]);
  });
});

describe("return policy presets", () => {
  it("recognises only known presets", () => {
    expect(isReturnPolicyPreset("retail")).toBe(true);
    expect(isReturnPolicyPreset("toString")).toBe(false);
    expect(isReturnPolicyPreset("nope")).toBe(false);
  });

  it("has no hyphens in any customer facing text", () => {
    for (const preset of Object.values(RETURN_POLICY_PRESETS)) {
      expect(preset.label).not.toContain("-");
      expect(preset.description).not.toContain("-");
      expect(preset.values.reasons).not.toContain("-");
    }
  });
});
