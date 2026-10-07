/* Purchase order rules shared by the procurement actions, the purchase
   order page and tests. No database access here.

   Lifecycle:
     Draft      -> Ordered, Cancelled
     Ordered    -> Received, Cancelled, back to Draft (to change lines)
     Received   -> only "Undo receipt", back to Ordered, which takes the stock
                   out again (not for lot or serial products)
     Cancelled  -> Draft (reopen)
   Lines change only while Draft, so what was ordered is what arrives, and a
   received order matches the stock that came in. */

export type PurchaseOrderStatus = "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";

export const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  ORDERED: "Ordered",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

const NEXT: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ["ORDERED", "CANCELLED"],
  ORDERED: ["RECEIVED", "CANCELLED", "DRAFT"],
  RECEIVED: [],
  CANCELLED: ["DRAFT"],
};

/** Statuses a person can pick from here. Leaving Received goes through
 * undoing the receipt, so it isn't listed. */
export function nextPoStatuses(from: PurchaseOrderStatus): PurchaseOrderStatus[] {
  return NEXT[from];
}

export function canChangePoStatus(from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean {
  return NEXT[from].includes(to);
}

export function canEditPoLines(status: PurchaseOrderStatus): boolean {
  return status === "DRAFT";
}

/** Only orders whose stock never arrived. */
export function canDeletePo(status: PurchaseOrderStatus): boolean {
  return status === "DRAFT" || status === "CANCELLED";
}

/** Why the receipt can't be undone, or null when it can. `onHand` is each
 * line's product quantity at the receiving branch now. */
export function undoReceiptBlocker(order: {
  status: PurchaseOrderStatus;
  lines: { productName: string; quantity: number; onHand: number; tracked: boolean }[];
}): string | null {
  if (order.status !== "RECEIVED") return "Only a received purchase order can have its receipt undone.";
  const tracked = order.lines.filter((l) => l.tracked);
  if (tracked.length > 0) {
    return `${tracked.map((l) => l.productName).join(", ")} ${tracked.length === 1 ? "is" : "are"} lot or serial tracked, so the units are already in their lots. Use a return or a stock adjustment instead.`;
  }
  // Lines for the same product add up.
  const need = new Map<string, { quantity: number; onHand: number }>();
  for (const l of order.lines) {
    const row = need.get(l.productName) ?? { quantity: 0, onHand: l.onHand };
    row.quantity += l.quantity;
    need.set(l.productName, row);
  }
  const short = [...need].filter(([, r]) => r.onHand < r.quantity);
  if (short.length > 0) {
    return `Some of this stock has already been used: ${short
      .map(([name, r]) => `${name} (${r.onHand} left of ${r.quantity} received)`)
      .join(", ")}. Adjust the stock instead.`;
  }
  return null;
}

/** PO0001; keeps every digit past 9999. */
export function formatPoNumber(n: number): string {
  return `PO${String(n).padStart(4, "0")}`;
}
