import { describe, it, expect } from "vitest";
import {
  canChangeInvoiceStatus,
  canDeleteInvoice,
  canEditInvoice,
  escapeHtml,
  formatInvoiceNumber,
  isPastDue,
  nextInvoiceStatuses,
  statusAfterUndoPayment,
} from "@/lib/invoice-rules";

describe("invoice status changes", () => {
  it("allows the normal steps", () => {
    expect(canChangeInvoiceStatus("DRAFT", "SENT")).toBe(true);
    expect(canChangeInvoiceStatus("DRAFT", "PAID")).toBe(true);
    expect(canChangeInvoiceStatus("SENT", "PAID")).toBe(true);
    expect(canChangeInvoiceStatus("SENT", "DRAFT")).toBe(true);
    expect(canChangeInvoiceStatus("OVERDUE", "PAID")).toBe(true);
  });

  it("never leaves Paid through the dropdown, and Overdue is automatic", () => {
    expect(nextInvoiceStatuses("PAID")).toEqual([]);
    expect(canChangeInvoiceStatus("PAID", "DRAFT")).toBe(false);
    expect(canChangeInvoiceStatus("PAID", "SENT")).toBe(false);
    expect(canChangeInvoiceStatus("SENT", "OVERDUE")).toBe(false);
    expect(canChangeInvoiceStatus("OVERDUE", "DRAFT")).toBe(false);
  });
});

describe("editing and deleting", () => {
  it("locks paid invoices", () => {
    expect(canEditInvoice("PAID")).toBe(false);
    expect(canEditInvoice("SENT")).toBe(true);
    expect(canEditInvoice("OVERDUE")).toBe(true);
  });

  it("won't delete while money is booked", () => {
    expect(canDeleteInvoice({ status: "DRAFT", hasBookedIncome: false })).toBe(true);
    expect(canDeleteInvoice({ status: "PAID", hasBookedIncome: true })).toBe(false);
    expect(canDeleteInvoice({ status: "SENT", hasBookedIncome: true })).toBe(false);
  });
});

describe("due dates", () => {
  const now = new Date(2026, 9, 4, 15, 0);
  it("is late only from the day after the due date", () => {
    expect(isPastDue(new Date(2026, 9, 4), now)).toBe(false);
    expect(isPastDue(new Date(2026, 9, 3), now)).toBe(true);
    expect(isPastDue(new Date(2026, 9, 10), now)).toBe(false);
  });

  it("undoes a payment to Sent or Overdue", () => {
    expect(statusAfterUndoPayment(new Date(2026, 9, 1), now)).toBe("OVERDUE");
    expect(statusAfterUndoPayment(new Date(2026, 9, 30), now)).toBe("SENT");
  });
});

describe("formatting", () => {
  it("numbers invoices", () => {
    expect(formatInvoiceNumber(3)).toBe("INV-0003");
    expect(formatInvoiceNumber(10001)).toBe("INV-10001");
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  });
});
