import { describe, it, expect } from "vitest";
import { canChangeStatus, canDelete, canEditLines, cancelBlocker, formatOrderNumber, invoiceBlocker, nextStatuses } from "@/lib/order-rules";

describe("order status changes", () => {
  it("follows the lifecycle", () => {
    expect(canChangeStatus("PENDING", "CONFIRMED")).toBe(true);
    expect(canChangeStatus("CONFIRMED", "FULFILLED")).toBe(true);
    expect(canChangeStatus("CONFIRMED", "PENDING")).toBe(true);
    expect(canChangeStatus("FULFILLED", "CANCELLED")).toBe(true);
    expect(canChangeStatus("CANCELLED", "PENDING")).toBe(true);
  });

  it("blocks skipping steps and undoing a shipment", () => {
    expect(canChangeStatus("PENDING", "FULFILLED")).toBe(false);
    expect(canChangeStatus("FULFILLED", "PENDING")).toBe(false);
    expect(canChangeStatus("FULFILLED", "CONFIRMED")).toBe(false);
    expect(canChangeStatus("CANCELLED", "FULFILLED")).toBe(false);
    expect(canChangeStatus("PENDING", "PENDING")).toBe(false);
  });

  it("lists the next steps", () => {
    expect(nextStatuses("FULFILLED")).toEqual(["CANCELLED"]);
  });
});

describe("editing and deleting", () => {
  it("only lets pending orders change lines", () => {
    expect(canEditLines("PENDING")).toBe(true);
    expect(canEditLines("CONFIRMED")).toBe(false);
    expect(canEditLines("FULFILLED")).toBe(false);
    expect(canEditLines("CANCELLED")).toBe(false);
  });

  it("only deletes orders whose stock isn't out", () => {
    expect(canDelete("PENDING")).toBe(true);
    expect(canDelete("CANCELLED")).toBe(true);
    expect(canDelete("CONFIRMED")).toBe(false);
    expect(canDelete("FULFILLED")).toBe(false);
  });
});

describe("cancelBlocker", () => {
  it("blocks invoiced orders and fulfilled orders with returns", () => {
    expect(cancelBlocker({ status: "CONFIRMED", hasInvoice: true, returnCount: 0 })).toMatch(/invoice/);
    expect(cancelBlocker({ status: "FULFILLED", hasInvoice: false, returnCount: 1 })).toMatch(/returns/);
    expect(cancelBlocker({ status: "FULFILLED", hasInvoice: false, returnCount: 0 })).toBeNull();
    expect(cancelBlocker({ status: "PENDING", hasInvoice: false, returnCount: 0 })).toBeNull();
  });
});

describe("invoiceBlocker", () => {
  it("needs a confirmed or fulfilled order with lines and no invoice", () => {
    expect(invoiceBlocker({ status: "CONFIRMED", hasInvoice: false, itemCount: 2 })).toBeNull();
    expect(invoiceBlocker({ status: "FULFILLED", hasInvoice: false, itemCount: 1 })).toBeNull();
    expect(invoiceBlocker({ status: "PENDING", hasInvoice: false, itemCount: 1 })).toMatch(/Confirm/);
    expect(invoiceBlocker({ status: "CANCELLED", hasInvoice: false, itemCount: 1 })).toMatch(/Confirm/);
    expect(invoiceBlocker({ status: "FULFILLED", hasInvoice: true, itemCount: 1 })).toMatch(/already/);
    expect(invoiceBlocker({ status: "CONFIRMED", hasInvoice: false, itemCount: 0 })).toMatch(/items/);
  });
});

describe("formatOrderNumber", () => {
  it("pads to four digits and keeps longer numbers whole", () => {
    expect(formatOrderNumber(1)).toBe("SO-0001");
    expect(formatOrderNumber(42)).toBe("SO-0042");
    expect(formatOrderNumber(12345)).toBe("SO-12345");
  });
});
