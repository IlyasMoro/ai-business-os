/* Invoice rules shared by the invoice actions, the invoice page, the
   overdue sweep and tests. No database access here.

   Lifecycle:
     Draft    -> Sent, Paid
     Sent     -> Paid, back to Draft
     Overdue  -> Paid            (set automatically once the due date passes)
     Paid     -> only "Undo payment" (owners and admins), which removes the
                 booked income and returns it to Sent, or Overdue if late.
   A paid invoice's lines are locked and it can't be deleted, so the income
   in Accounting always matches an invoice. */

import { startOfDay } from "date-fns";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

const NEXT: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["SENT", "PAID"],
  SENT: ["PAID", "DRAFT"],
  OVERDUE: ["PAID"],
  PAID: [],
};

/** Statuses a person can pick from here. Overdue is set by the sweep and
 * leaving Paid goes through undoing the payment, so neither is listed. */
export function nextInvoiceStatuses(from: InvoiceStatus): InvoiceStatus[] {
  return NEXT[from];
}

export function canChangeInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return NEXT[from].includes(to);
}

/** Lines, tax and due date change only before any money or credit is
 * recorded, so payments always match the total they paid. */
export function canEditInvoice(status: InvoiceStatus, settled: { amountPaid: number; amountCredited: number } = { amountPaid: 0, amountCredited: 0 }): boolean {
  return status !== "PAID" && settled.amountPaid <= 0 && settled.amountCredited <= 0;
}

/** Not once paid, or while any income is still booked against it. */
export function canDeleteInvoice(invoice: { status: InvoiceStatus; hasBookedIncome: boolean }): boolean {
  return invoice.status !== "PAID" && !invoice.hasBookedIncome;
}

/** Past due when the due date is before today (server time): an invoice due
 * today isn't late until tomorrow. */
export function isPastDue(dueDate: Date, now = new Date()): boolean {
  return dueDate.getTime() < startOfDay(now).getTime();
}

/** Where an invoice goes when its payment is undone. */
export function statusAfterUndoPayment(dueDate: Date, now = new Date()): InvoiceStatus {
  return isPastDue(dueDate, now) ? "OVERDUE" : "SENT";
}

/** INV-0001; keeps every digit past 9999. */
export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(4, "0")}`;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Text going into an email's HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// ---------- Payments and credit notes ----------

export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "BANK_TRANSFER", label: "Bank transfer" },
  { id: "CARD", label: "Card" },
  { id: "CASH", label: "Cash" },
  { id: "OTHER", label: "Other" },
];

const cents = (n: number) => Math.round(n * 100) / 100;

/** What the customer still owes; never below zero. */
export function balanceDue(invoice: { totalAmount: number; amountPaid: number; amountCredited: number }): number {
  return Math.max(0, cents(invoice.totalAmount - invoice.amountPaid - invoice.amountCredited));
}

/** Why a payment or credit of `amount` can't be recorded, or null. */
export function amountBlocker(amount: number, balance: number, what: "payment" | "credit note"): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return `Enter a ${what} amount above zero.`;
  if (cents(amount) > cents(balance)) return `That's more than the $${balance.toFixed(2)} still owed.`;
  return null;
}

/**
 * Status after money or credit changes: Paid once nothing is owed and
 * something settled it; otherwise unpaid again (Sent, or Overdue when past
 * due). A draft stays a draft until it is sent or settled in full.
 */
export function statusAfterSettlement(invoice: {
  status: InvoiceStatus;
  totalAmount: number;
  amountPaid: number;
  amountCredited: number;
  dueDate: Date;
}, now = new Date()): InvoiceStatus {
  const settled = invoice.amountPaid + invoice.amountCredited > 0;
  if (settled && balanceDue(invoice) <= 0) return "PAID";
  if (invoice.status === "DRAFT") return "DRAFT";
  return isPastDue(invoice.dueDate, now) ? "OVERDUE" : "SENT";
}

/** CN-0001; keeps every digit past 9999. */
export function formatCreditNumber(n: number): string {
  return `CN-${String(n).padStart(4, "0")}`;
}
