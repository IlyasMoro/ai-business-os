/* Sales order rules shared by the order actions, the order page and tests.
   No database access here.

   Lifecycle:
     Pending    -> Confirmed, Cancelled
     Confirmed  -> Fulfilled, Cancelled, back to Pending (to change lines)
     Fulfilled  -> Cancelled (stock goes back; not once invoiced or returned)
     Cancelled  -> Pending (reopen)
   Lines can only change while Pending, so a confirmed order keeps the
   credit and stock checks it passed, and a fulfilled one matches the stock
   that left. */

export type OrderStatus = "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["FULFILLED", "CANCELLED", "PENDING"],
  FULFILLED: ["CANCELLED"],
  CANCELLED: ["PENDING"],
};

/** Statuses the order can move to from here (not including staying put). */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return NEXT[from];
}

export function canChangeStatus(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

export function canEditLines(status: OrderStatus): boolean {
  return status === "PENDING";
}

/** Why the order can't be cancelled, or null when it can. */
export function cancelBlocker(order: { status: OrderStatus; hasInvoice: boolean; returnCount: number }): string | null {
  if (order.hasInvoice) return "This order has an invoice. Delete the invoice, or record a return instead, before cancelling.";
  if (order.status === "FULFILLED" && order.returnCount > 0) return "This order already has returns. Use returns for anything else coming back.";
  return null;
}

/** Only orders that never shipped, or were cancelled (stock already back), can be deleted. */
export function canDelete(status: OrderStatus): boolean {
  return status === "PENDING" || status === "CANCELLED";
}

/** Why an invoice can't be made from the order yet, or null when it can. */
export function invoiceBlocker(order: { status: OrderStatus; hasInvoice: boolean; itemCount: number }): string | null {
  if (order.hasInvoice) return "This order already has an invoice.";
  if (order.status !== "CONFIRMED" && order.status !== "FULFILLED") return "Confirm the order before invoicing it.";
  if (order.itemCount === 0) return "Add items before invoicing the order.";
  return null;
}

/** SO-0001; keeps every digit past 9999. */
export function formatOrderNumber(n: number): string {
  return `SO-${String(n).padStart(4, "0")}`;
}
