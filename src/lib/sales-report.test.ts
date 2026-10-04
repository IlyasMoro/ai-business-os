import { describe, expect, it } from "vitest";
import { closedIn, forecastByMonth, openByStage, periodRange, statsByOwner, statsBySource, wonByMonth, type ReportDeal } from "@/lib/sales-report";

const now = new Date(2026, 9, 15); // 15 Oct 2026, local time

function deal(over: Partial<ReportDeal>): ReportDeal {
  return { value: 1000, stage: "NEW", probability: 10, expectedClose: null, closedAt: null, createdAt: new Date(2026, 8, 1), ownerId: "ana", ...over };
}

describe("periodRange", () => {
  it("covers this month, quarter, year and the last 12 months", () => {
    expect(periodRange("month", now)).toEqual({ start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) });
    expect(periodRange("quarter", now)).toEqual({ start: new Date(2026, 9, 1), end: new Date(2027, 0, 1) });
    expect(periodRange("year", now)).toEqual({ start: new Date(2026, 0, 1), end: new Date(2027, 0, 1) });
    expect(periodRange("last12", now)).toEqual({ start: new Date(2025, 10, 1), end: new Date(2026, 10, 1) });
  });
});

describe("closedIn", () => {
  const range = periodRange("month", now);
  it("counts only deals closed in the range, with win rate, average and cycle", () => {
    const deals = [
      deal({ stage: "WON", value: 3000, closedAt: new Date(2026, 9, 11), createdAt: new Date(2026, 9, 1) }),
      deal({ stage: "WON", value: 1000, closedAt: new Date(2026, 9, 21), createdAt: new Date(2026, 9, 1) }),
      deal({ stage: "LOST", closedAt: new Date(2026, 9, 5) }),
      deal({ stage: "WON", closedAt: new Date(2026, 8, 30) }), // last month
      deal({ stage: "PROPOSAL" }),
    ];
    expect(closedIn(deals, range)).toEqual({ wonCount: 2, lostCount: 1, wonValue: 4000, winRate: 67, averageWon: 2000, averageCycleDays: 15 });
  });
  it("gives nulls when nothing closed", () => {
    expect(closedIn([deal({})], range)).toMatchObject({ winRate: null, averageWon: null, averageCycleDays: null });
  });
});

describe("forecastByMonth", () => {
  it("buckets open deals by expected close and weights them", () => {
    const buckets = forecastByMonth(
      [
        deal({ stage: "PROPOSAL", probability: 50, value: 2000, expectedClose: new Date(2026, 9, 30) }),
        deal({ stage: "NEGOTIATION", probability: 75, value: 4000, expectedClose: new Date(2026, 10, 2) }),
        deal({ stage: "NEW", value: 500, expectedClose: new Date(2026, 8, 1) }),
        deal({ stage: "NEW", value: 700, expectedClose: new Date(2027, 5, 1) }),
        deal({ stage: "QUALIFIED", value: 300 }),
        deal({ stage: "WON", value: 9999, expectedClose: new Date(2026, 9, 20) }),
      ],
      now
    );
    const by = Object.fromEntries(buckets.map((b) => [b.key, b]));
    expect(buckets.map((b) => b.key)).toEqual(["overdue", "2026-10", "2026-11", "2026-12", "later", "none"]);
    expect(by["2026-10"]).toMatchObject({ count: 1, value: 2000, weighted: 1000 });
    expect(by["2026-11"]).toMatchObject({ count: 1, value: 4000, weighted: 3000 });
    expect(by.overdue.count).toBe(1);
    expect(by.later.count).toBe(1);
    expect(by.none.value).toBe(300);
  });
});

describe("openByStage", () => {
  it("lists the four open stages in board order", () => {
    const rows = openByStage([deal({ stage: "PROPOSAL", value: 10 }), deal({ stage: "PROPOSAL", value: 5 }), deal({ stage: "WON" })]);
    expect(rows.map((r) => r.label)).toEqual(["New", "Qualified", "Proposal", "Negotiation"]);
    expect(rows[2]).toMatchObject({ count: 2, value: 15 });
  });
});

describe("statsByOwner", () => {
  it("adds up each salesperson's pipeline, wins and quotes, best first", () => {
    const range = periodRange("month", now);
    const rows = statsByOwner(
      [
        deal({ ownerId: "ana", stage: "PROPOSAL", probability: 50, value: 2000 }),
        deal({ ownerId: "ben", stage: "WON", value: 5000, closedAt: new Date(2026, 9, 3) }),
        deal({ ownerId: "ben", stage: "LOST", closedAt: new Date(2026, 9, 4) }),
        deal({ ownerId: "old", stage: "WON", closedAt: new Date(2025, 0, 1) }),
      ],
      [{ status: "ACCEPTED", ownerId: "ben", sentAt: new Date(2026, 9, 1), decidedAt: new Date(2026, 9, 3), totalAmount: 5000 }],
      range
    );
    expect(rows.map((r) => r.ownerId)).toEqual(["ben", "ana"]);
    expect(rows[0]).toMatchObject({ wonValue: 5000, winRate: 50, quotesSent: 1, quotesAccepted: 1 });
    expect(rows[1]).toMatchObject({ openCount: 1, openValue: 2000, weighted: 1000 });
  });
});

describe("statsBySource", () => {
  it("counts new customers and wins per source", () => {
    const range = periodRange("year", now);
    const rows = statsBySource(
      [
        { source: "REFERRAL", createdAt: new Date(2026, 2, 1) },
        { source: "REFERRAL", createdAt: new Date(2026, 3, 1) },
        { source: null, createdAt: new Date(2026, 3, 1) },
      ],
      [deal({ source: "REFERRAL", stage: "WON", value: 800, closedAt: new Date(2026, 5, 1) })],
      range
    );
    expect(rows[0]).toMatchObject({ label: "Referral", newCustomers: 2, wonCount: 1, wonValue: 800, winRate: 100 });
    expect(rows[1]).toMatchObject({ label: "Not set", newCustomers: 1 });
  });
});

describe("wonByMonth", () => {
  it("gives won value per month, oldest first", () => {
    const months = wonByMonth([deal({ stage: "WON", value: 400, closedAt: new Date(2026, 9, 2) }), deal({ stage: "WON", value: 100, closedAt: new Date(2026, 7, 9) })], now, 3);
    expect(months.map((m) => m.value)).toEqual([100, 0, 400]);
  });
});
