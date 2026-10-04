/* When orders count as late, and when the daily alert email is due. Shared
   by the bell, the automations and tests. No database access here. */

import { startOfDay } from "date-fns";

/** A confirmed sales order not fulfilled after this many days is stalled.
 * Orders don't record when they were confirmed, so this counts from when
 * the order was created. */
export const SALES_STALL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days past the expected date; 0 when it isn't late (due today is
 * on time until tomorrow). */
export function daysLate(expectedDate: Date, now = new Date()): number {
  const diff = startOfDay(now).getTime() - startOfDay(expectedDate).getTime();
  return diff > 0 ? Math.round(diff / DAY_MS) : 0;
}

/** The creation date before which a still confirmed order counts as stalled. */
export function stalledBefore(now = new Date(), days = SALES_STALL_DAYS): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/** Whole days since a date, for "waiting 9 days". */
export function daysSince(date: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

/** One alert email a day. A little under 24 hours, so a 15 minute
 * scheduler that runs slightly early doesn't skip a whole day. */
export function isDailyAlertDue(lastSentAt: Date | null, now = new Date()): boolean {
  return !lastSentAt || now.getTime() - lastSentAt.getTime() >= 23 * 60 * 60 * 1000;
}
