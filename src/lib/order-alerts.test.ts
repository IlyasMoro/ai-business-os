import { describe, it, expect } from "vitest";
import { daysLate, daysSince, isDailyAlertDue, stalledBefore, SALES_STALL_DAYS } from "@/lib/order-alerts";

const now = new Date(2026, 9, 10, 14, 0);

describe("daysLate", () => {
  it("is on time through the expected day", () => {
    expect(daysLate(new Date(2026, 9, 10), now)).toBe(0);
    expect(daysLate(new Date(2026, 9, 12), now)).toBe(0);
  });

  it("counts whole days after it", () => {
    expect(daysLate(new Date(2026, 9, 9), now)).toBe(1);
    expect(daysLate(new Date(2026, 9, 1, 23, 0), now)).toBe(9);
  });
});

describe("stalled sales orders", () => {
  it("looks back a week", () => {
    expect(SALES_STALL_DAYS).toBe(7);
    expect(stalledBefore(now).getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(daysSince(new Date(2026, 9, 1, 14, 0), now)).toBe(9);
  });
});

describe("isDailyAlertDue", () => {
  it("sends the first time and then once a day", () => {
    expect(isDailyAlertDue(null, now)).toBe(true);
    expect(isDailyAlertDue(new Date(now.getTime() - 2 * 60 * 60 * 1000), now)).toBe(false);
    expect(isDailyAlertDue(new Date(now.getTime() - 23.5 * 60 * 60 * 1000), now)).toBe(true);
  });
});
