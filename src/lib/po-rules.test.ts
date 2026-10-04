import { describe, it, expect } from "vitest";
import { canChangePoStatus, canDeletePo, canEditPoLines, formatPoNumber, nextPoStatuses, undoReceiptBlocker } from "@/lib/po-rules";

describe("purchase order status changes", () => {
  it("follows the lifecycle", () => {
    expect(canChangePoStatus("DRAFT", "ORDERED")).toBe(true);
    expect(canChangePoStatus("ORDERED", "RECEIVED")).toBe(true);
    expect(canChangePoStatus("ORDERED", "DRAFT")).toBe(true);
    expect(canChangePoStatus("CANCELLED", "DRAFT")).toBe(true);
  });

  it("never receives twice or leaves Received through the dropdown", () => {
    expect(nextPoStatuses("RECEIVED")).toEqual([]);
    expect(canChangePoStatus("RECEIVED", "ORDERED")).toBe(false);
    expect(canChangePoStatus("RECEIVED", "CANCELLED")).toBe(false);
    expect(canChangePoStatus("DRAFT", "RECEIVED")).toBe(false);
    expect(canChangePoStatus("CANCELLED", "RECEIVED")).toBe(false);
  });
});

describe("editing and deleting", () => {
  it("only drafts change lines", () => {
    expect(canEditPoLines("DRAFT")).toBe(true);
    expect(canEditPoLines("ORDERED")).toBe(false);
    expect(canEditPoLines("RECEIVED")).toBe(false);
  });

  it("never deletes an order whose stock arrived", () => {
    expect(canDeletePo("DRAFT")).toBe(true);
    expect(canDeletePo("CANCELLED")).toBe(true);
    expect(canDeletePo("ORDERED")).toBe(false);
    expect(canDeletePo("RECEIVED")).toBe(false);
  });
});

describe("undoReceiptBlocker", () => {
  const line = (over = {}) => ({ productName: "Widget", quantity: 10, onHand: 10, tracked: false, ...over });

  it("allows undoing when the stock is still there", () => {
    expect(undoReceiptBlocker({ status: "RECEIVED", lines: [line()] })).toBeNull();
  });

  it("blocks when the stock has been used, adding lines for the same product", () => {
    expect(undoReceiptBlocker({ status: "RECEIVED", lines: [line({ onHand: 4 })] })).toMatch(/4 left of 10/);
    expect(undoReceiptBlocker({ status: "RECEIVED", lines: [line({ quantity: 6, onHand: 10 }), line({ quantity: 6, onHand: 10 })] })).toMatch(
      /10 left of 12/
    );
  });

  it("blocks lot tracked products and orders that aren't received", () => {
    expect(undoReceiptBlocker({ status: "RECEIVED", lines: [line({ tracked: true })] })).toMatch(/lot or serial/);
    expect(undoReceiptBlocker({ status: "ORDERED", lines: [line()] })).toMatch(/Only a received/);
  });
});

describe("formatPoNumber", () => {
  it("pads and keeps long numbers", () => {
    expect(formatPoNumber(7)).toBe("PO-0007");
    expect(formatPoNumber(12345)).toBe("PO-12345");
  });
});
