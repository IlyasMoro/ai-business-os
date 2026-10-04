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

export function canEditInvoice(status: InvoiceStatus): boolean {
  return status !== "PAID";
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
