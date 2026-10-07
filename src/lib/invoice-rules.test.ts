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
  amountBlocker,
  balanceDue,
  formatCreditNumber,
  statusAfterSettlement,
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
    expect(formatInvoiceNumber(3)).toBe("INV0003");
    expect(formatInvoiceNumber(10001)).toBe("INV10001");
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  });
});

describe("payments and credit notes", () => {
  const due = new Date(2026, 9, 20);
  const inv = (over = {}) => ({ status: "SENT" as const, totalAmount: 100, amountPaid: 0, amountCredited: 0, dueDate: due, ...over });
  const now = new Date(2026, 9, 10);

  it("works out the balance", () => {
    expect(balanceDue(inv({ amountPaid: 30, amountCredited: 20 }))).toBe(50);
    expect(balanceDue(inv({ amountPaid: 120 }))).toBe(0);
  });

  it("never takes more than is owed", () => {
    expect(amountBlocker(50, 50, "payment")).toBeNull();
    expect(amountBlocker(50.01, 50, "payment")).toMatch(/more than/);
    expect(amountBlocker(0, 50, "credit note")).toMatch(/above zero/);
  });

  it("is paid once settled in full, unpaid otherwise", () => {
    expect(statusAfterSettlement(inv({ amountPaid: 60, amountCredited: 40 }), now)).toBe("PAID");
    expect(statusAfterSettlement(inv({ amountPaid: 60 }), now)).toBe("SENT");
    expect(statusAfterSettlement(inv({ status: "PAID", amountPaid: 60, dueDate: new Date(2026, 9, 1) }), now)).toBe("OVERDUE");
    expect(statusAfterSettlement(inv({ status: "DRAFT", amountPaid: 10 }), now)).toBe("DRAFT");
    expect(statusAfterSettlement(inv({ status: "DRAFT", amountPaid: 100 }), now)).toBe("PAID");
    expect(statusAfterSettlement(inv({ totalAmount: 0 }), now)).toBe("SENT");
  });

  it("locks editing once money or credit is recorded", () => {
    expect(canEditInvoice("SENT", { amountPaid: 10, amountCredited: 0 })).toBe(false);
    expect(canEditInvoice("SENT", { amountPaid: 0, amountCredited: 5 })).toBe(false);
    expect(canEditInvoice("SENT")).toBe(true);
  });

  it("numbers credit notes", () => {
    expect(formatCreditNumber(4)).toBe("CN0004");
  });
});
