/* Quote rules shared by the quote pages, actions and tests. No database
   access here. */

import * as z from "zod";
import { lineQuantity } from "@/lib/validation/quantity";

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED";
/** What a quote shows as: its stored status, or Expired for a sent quote
 * whose valid until date has passed. */
export type QuoteDisplayStatus = QuoteStatus | "EXPIRED";

export const QUOTE_STATUS_LABELS: Record<QuoteDisplayStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  EXPIRED: "Expired",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

/** Days a new quote stays valid unless another date is chosen. */
export const DEFAULT_VALID_DAYS = 30;

type QuoteLike = { status: QuoteStatus; validUntil: Date | null };

/** A quote is valid through the whole of its valid until day. */
export function isExpired(quote: QuoteLike, now = new Date()): boolean {
  if (quote.status !== "SENT" || !quote.validUntil) return false;
  const endOfDay = new Date(quote.validUntil);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return endOfDay < now;
}

export function displayStatus(quote: QuoteLike, now = new Date()): QuoteDisplayStatus {
  return isExpired(quote, now) ? "EXPIRED" : quote.status;
}

/** Lines and dates can change until the customer has decided. */
export function isEditable(status: QuoteStatus): boolean {
  return status === "DRAFT" || status === "SENT";
}

/** Why a quote can't be accepted yet, or null when it can. */
export function acceptBlocker(quote: QuoteLike & { itemCount: number }, now = new Date()): string | null {
  if (quote.status === "ACCEPTED") return "This quote has already been accepted.";
  if (quote.status === "DECLINED") return "This quote was declined. Copy it into a new quote instead.";
  if (quote.itemCount === 0) return "Add at least one product before accepting.";
  if (isExpired(quote, now)) return "This quote has expired. Move the valid until date first.";
  return null;
}

export function quoteTotal(items: { quantity: number; unitPrice: number }[]): number {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return Math.round(total * 100) / 100;
}

/** The next number after the highest one in use: Q0001, Q0002, ... Taking
 * the highest rather than counting means a deleted quote's number is never
 * given out twice. */
export function nextQuoteNumber(existing: string[]): string {
  const highest = existing.reduce((max, n) => {
    const match = /^Q-?(\d+)$/.exec(n);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `Q${String(highest + 1).padStart(4, "0")}`;
}

/** The default valid until date, counted from `from`. */
export function defaultValidUntil(from = new Date()): Date {
  const date = new Date(from);
  date.setDate(date.getDate() + DEFAULT_VALID_DAYS);
  return date;
}

/** A product line typed on a quote or a deal. Leaving the price empty
 * means the product's own price. */
export const QuoteItemSchema = z.object({
  productId: z.string().min(1, { error: "Select a product." }),
  quantity: lineQuantity(),
  unitPrice: z.coerce.number({ error: "Enter a valid price." }).min(0, { error: "Price can't be negative." }).max(1_000_000_000).optional(),
});
