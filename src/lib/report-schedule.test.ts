import { describe, it, expect } from "vitest";
import { isReportDue } from "@/lib/report-schedule";

const NOW = new Date("2026-06-15T00:00:00.000Z");

describe("isReportDue", () => {
  it("is never due when frequency is OFF, regardless of last sent date", () => {
    expect(isReportDue("OFF", null, NOW)).toBe(false);
    expect(isReportDue("OFF", new Date("2020-01-01"), NOW)).toBe(false);
  });

  it("is due immediately the first time (no lastSentAt) for any active frequency", () => {
    expect(isReportDue("WEEKLY", null, NOW)).toBe(true);
    expect(isReportDue("MONTHLY", null, NOW)).toBe(true);
    expect(isReportDue("QUARTERLY", null, NOW)).toBe(true);
  });

  it("is not due before the interval has elapsed", () => {
    const sixDaysAgo = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(isReportDue("WEEKLY", sixDaysAgo, NOW)).toBe(false);

    const twentyNineDaysAgo = new Date(NOW.getTime() - 29 * 24 * 60 * 60 * 1000);
    expect(isReportDue("MONTHLY", twentyNineDaysAgo, NOW)).toBe(false);
  });

  it("is due once the interval has elapsed", () => {
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(isReportDue("WEEKLY", sevenDaysAgo, NOW)).toBe(true);

    const ninetyDaysAgo = new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(isReportDue("QUARTERLY", ninetyDaysAgo, NOW)).toBe(true);
  });
});
