export const ReturnStatusValues = ["REQUESTED", "APPROVED", "RECEIVED", "REFUNDED", "REJECTED"] as const;
export type ReturnStatus = (typeof ReturnStatusValues)[number];

export const ReturnConditionValues = ["RESELLABLE", "DAMAGED"] as const;
export type ReturnCondition = (typeof ReturnConditionValues)[number];

/**
 * The RMA lifecycle. A return can be rejected any time before the goods
 * arrive; once received it can only move on to refunded. Refunded and
 * rejected are final.
 */
const transitions: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["RECEIVED", "REJECTED"],
  RECEIVED: ["REFUNDED"],
  REFUNDED: [],
  REJECTED: [],
};

export function nextReturnStatuses(status: ReturnStatus): ReturnStatus[] {
  return transitions[status];
}

export function canTransitionReturn(from: ReturnStatus, to: ReturnStatus): boolean {
  return transitions[from].includes(to);
}

/** Line items can only change while the goods haven't arrived yet. */
export function isReturnEditable(status: ReturnStatus): boolean {
  return status === "REQUESTED" || status === "APPROVED";
}

/** Businesses that skip the approval step open returns already approved. */
export function initialReturnStatus(requireApproval: boolean): ReturnStatus {
  return requireApproval ? "REQUESTED" : "APPROVED";
}

export function formatRmaNumber(sequence: number): string {
  return `RMA${String(sequence).padStart(4, "0")}`;
}

/**
 * How many units of an order line can still be returned, given what other
 * (non rejected) returns already claim for that same line.
 */
export function returnableQuantity(ordered: number, alreadyReturned: number): number {
  return Math.max(0, ordered - alreadyReturned);
}

/** A window of 0 days means the business accepts returns at any time. */
export function isWithinReturnWindow(fulfilledAt: Date, windowDays: number, now: Date = new Date()): boolean {
  if (windowDays <= 0) return true;
  const deadline = new Date(fulfilledAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  return now <= deadline;
}

export function returnDeadline(fulfilledAt: Date, windowDays: number): Date | null {
  if (windowDays <= 0) return null;
  return new Date(fulfilledAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
}

export function shouldRestock(condition: ReturnCondition, restockDamaged: boolean): boolean {
  return condition === "RESELLABLE" || restockDamaged;
}

const roundCents = (n: number) => Math.round(n * 100) / 100;

/** Refund owed for the returned lines, less the business's restocking fee. */
export function computeRefund(
  items: { quantity: number; unitPrice: number }[],
  restockingFeePercent: number
): { subtotal: number; fee: number; refund: number } {
  const subtotal = roundCents(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const pct = Math.min(100, Math.max(0, restockingFeePercent));
  const fee = roundCents((subtotal * pct) / 100);
  return { subtotal, fee, refund: roundCents(subtotal - fee) };
}

/** Policy reasons are stored one per line. */
export function parseReturnReasons(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, i, all) => line.length > 0 && all.indexOf(line) === i);
}
