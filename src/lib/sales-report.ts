/* Sales report figures from deals and quotes: periods, forecast by month,
   per salesperson and per lead source. No database access here; the Sales
   report page and the Copilot's pipeline tool pass the rows in. */

import { DEAL_STAGES, isOpenStage, sourceLabel, type DealStage, type LeadSource } from "@/lib/crm-pipeline";

export type ReportPeriod = "month" | "quarter" | "year" | "last12";

export const REPORT_PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
  { id: "last12", label: "Last 12 months" },
];

/** Start (inclusive) and end (exclusive) of a period, in local time. */
export function periodRange(period: ReportPeriod, now = new Date()): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "month":
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
    case "quarter": {
      const q = Math.floor(m / 3) * 3;
      return { start: new Date(y, q, 1), end: new Date(y, q + 3, 1) };
    }
    case "year":
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
    case "last12":
      return { start: new Date(y, m - 11, 1), end: new Date(y, m + 1, 1) };
  }
}

export type ReportDeal = {
  value: number;
  stage: DealStage;
  probability: number;
  expectedClose: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  ownerId: string | null;
  source?: LeadSource | null;
};

const within = (date: Date | null, range: { start: Date; end: Date }) => Boolean(date && date >= range.start && date < range.end);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Won and lost deals that closed in the range, and what they add up to. */
export function closedIn(deals: ReportDeal[], range: { start: Date; end: Date }) {
  const won = deals.filter((d) => d.stage === "WON" && within(d.closedAt, range));
  const lost = deals.filter((d) => d.stage === "LOST" && within(d.closedAt, range));
  const wonValue = won.reduce((s, d) => s + d.value, 0);
  const cycles = won.map((d) => (d.closedAt!.getTime() - d.createdAt.getTime()) / 86_400_000);
  return {
    wonCount: won.length,
    lostCount: lost.length,
    wonValue: round2(wonValue),
    /** Share of deals closed in the range that were won, 0 to 100, or null. */
    winRate: won.length + lost.length === 0 ? null : Math.round((won.length / (won.length + lost.length)) * 100),
    averageWon: won.length === 0 ? null : round2(wonValue / won.length),
    /** Average days from creating a deal to winning it. */
    averageCycleDays: cycles.length === 0 ? null : Math.round(cycles.reduce((s, c) => s + c, 0) / cycles.length),
  };
}

export type ForecastBucket = { key: string; label: string; count: number; value: number; weighted: number };

/**
 * Open deals grouped by expected close: overdue (before this month), each of
 * the next `months` months starting with this one, later, and no date. The
 * weighted value is each deal's value times its chance of winning, the
 * usual sales forecast.
 */
export function forecastByMonth(deals: ReportDeal[], now = new Date(), months = 3): ForecastBucket[] {
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStarts = Array.from({ length: months + 1 }, (_, i) => new Date(now.getFullYear(), now.getMonth() + i, 1));
  const buckets: ForecastBucket[] = [
    { key: "overdue", label: "Overdue", count: 0, value: 0, weighted: 0 },
    ...monthStarts.slice(0, months).map((d) => ({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      count: 0,
      value: 0,
      weighted: 0,
    })),
    { key: "later", label: "Later", count: 0, value: 0, weighted: 0 },
    { key: "none", label: "No close date", count: 0, value: 0, weighted: 0 },
  ];
  const add = (key: string, d: ReportDeal) => {
    const b = buckets.find((x) => x.key === key)!;
    b.count += 1;
    b.value += d.value;
    b.weighted += (d.value * d.probability) / 100;
  };
  for (const d of deals) {
    if (!isOpenStage(d.stage)) continue;
    if (!d.expectedClose) add("none", d);
    else if (d.expectedClose < thisMonth) add("overdue", d);
    else {
      const i = monthStarts.findIndex((start, idx) => idx < months && d.expectedClose! >= start && d.expectedClose! < monthStarts[idx + 1]);
      add(i === -1 ? "later" : buckets[i + 1].key, d);
    }
  }
  return buckets.map((b) => ({ ...b, value: round2(b.value), weighted: round2(b.weighted) }));
}

/** Count and value of open deals in each open stage, in board order. */
export function openByStage(deals: ReportDeal[]) {
  return DEAL_STAGES.filter((s) => s.open).map((s) => {
    const inStage = deals.filter((d) => d.stage === s.id);
    return { stage: s.id, label: s.label, count: inStage.length, value: round2(inStage.reduce((sum, d) => sum + d.value, 0)) };
  });
}

export type ReportQuote = { status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED"; ownerId: string | null; sentAt: Date | null; decidedAt: Date | null; totalAmount: number };

export type OwnerRow = {
  ownerId: string | null;
  openCount: number;
  openValue: number;
  weighted: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  winRate: number | null;
  quotesSent: number;
  quotesAccepted: number;
};

/** One row per salesperson (and one for deals with no owner), ordered by
 * won value in the range, then open pipeline. */
export function statsByOwner(deals: ReportDeal[], quotes: ReportQuote[], range: { start: Date; end: Date }): OwnerRow[] {
  const ids = new Set<string | null>([...deals.map((d) => d.ownerId), ...quotes.map((q) => q.ownerId)]);
  const rows = [...ids].map((ownerId) => {
    const mine = deals.filter((d) => d.ownerId === ownerId);
    const open = mine.filter((d) => isOpenStage(d.stage));
    const closed = closedIn(mine, range);
    const myQuotes = quotes.filter((q) => q.ownerId === ownerId);
    return {
      ownerId,
      openCount: open.length,
      openValue: round2(open.reduce((s, d) => s + d.value, 0)),
      weighted: round2(open.reduce((s, d) => s + (d.value * d.probability) / 100, 0)),
      wonCount: closed.wonCount,
      wonValue: closed.wonValue,
      lostCount: closed.lostCount,
      winRate: closed.winRate,
      quotesSent: myQuotes.filter((q) => within(q.sentAt, range)).length,
      quotesAccepted: myQuotes.filter((q) => q.status === "ACCEPTED" && within(q.decidedAt, range)).length,
    };
  });
  return rows
    .filter((r) => r.openCount + r.wonCount + r.lostCount + r.quotesSent + r.quotesAccepted > 0)
    .sort((a, b) => b.wonValue - a.wonValue || b.openValue - a.openValue);
}

/** Per lead source: new customers in the range, and deals won from that
 * source's customers. Customers with no source are grouped as "Not set". */
export function statsBySource(
  customers: { source: LeadSource | null; createdAt: Date }[],
  deals: ReportDeal[],
  range: { start: Date; end: Date }
) {
  const keys = new Set<LeadSource | null>([...customers.map((c) => c.source), ...deals.map((d) => d.source ?? null)]);
  return [...keys]
    .map((source) => {
      const closed = closedIn(
        deals.filter((d) => (d.source ?? null) === source),
        range
      );
      return {
        source,
        label: sourceLabel(source) ?? "Not set",
        newCustomers: customers.filter((c) => c.source === source && within(c.createdAt, range)).length,
        wonCount: closed.wonCount,
        wonValue: closed.wonValue,
        winRate: closed.winRate,
      };
    })
    .filter((r) => r.newCustomers + r.wonCount > 0 || r.winRate !== null)
    .sort((a, b) => b.wonValue - a.wonValue || b.newCustomers - a.newCustomers);
}

/** Won value per month for the last `months` months, oldest first. */
export function wonByMonth(deals: ReportDeal[], now = new Date(), months = 6) {
  return Array.from({ length: months }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return {
      start,
      value: round2(deals.filter((d) => d.stage === "WON" && within(d.closedAt, { start, end })).reduce((s, d) => s + d.value, 0)),
    };
  });
}
