export type Period = { year: number; month: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(p: Period): string {
  return `${MONTHS[p.month - 1]} ${p.year}`;
}

/** The fiscal year a date falls in, named after the calendar year it starts in. */
export function fiscalYearOf(date: Date, startMonth: number): number {
  const m = date.getUTCMonth() + 1;
  return m >= startMonth ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

/** The 12 calendar months of a fiscal year, in order. */
export function fiscalYearMonths(fiscalYear: number, startMonth: number): Period[] {
  return Array.from({ length: 12 }, (_, i) => {
    const zero = startMonth - 1 + i;
    return { year: fiscalYear + Math.floor(zero / 12), month: (zero % 12) + 1 };
  });
}

export function fiscalYearLabel(fiscalYear: number, startMonth: number): string {
  return startMonth === 1 ? `FY ${fiscalYear}` : `FY ${fiscalYear}/${String(fiscalYear + 1).slice(2)}`;
}

/** UTC bounds [from, to) covering the given months. */
export function periodRange(periods: Period[]): { from: Date; to: Date } {
  const first = periods[0];
  const last = periods[periods.length - 1];
  return {
    from: new Date(Date.UTC(first.year, first.month - 1, 1)),
    to: new Date(Date.UTC(last.year, last.month, 1)),
  };
}

export function periodOf(date: Date): Period {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export const periodKey = (p: Period) => `${p.year}-${String(p.month).padStart(2, "0")}`;

export type VarianceStatus = "NO_PLAN" | "UNDER" | "NEAR" | "OVER";

/**
 * Plan vs actual for a cost object. Over means actual cost beyond plan
 * plus tolerance; near means at least 90% of plan used.
 */
export function variance(plan: number, actual: number, tolerancePercent = 0) {
  const diff = round(actual - plan);
  const pct = plan > 0 ? round(((actual - plan) / plan) * 100) : null;
  let status: VarianceStatus;
  if (plan <= 0) status = actual > 0 ? "NO_PLAN" : "UNDER";
  else if (actual > plan * (1 + tolerancePercent / 100)) status = "OVER";
  else if (actual >= plan * 0.9) status = "NEAR";
  else status = "UNDER";
  return { variance: diff, variancePercent: pct, used: plan > 0 ? actual / plan : null, status };
}

export type AvailabilityResult = { result: "OK" | "WARN" | "BLOCK"; available: number; overBy: number };

/**
 * Availability control: would posting `amount` push this cost object past
 * its budget (plus tolerance)? A cost object with no budget isn't
 * controlled. The business chooses whether that warns or blocks.
 */
export function checkAvailability(opts: {
  budget: number;
  consumed: number;
  amount: number;
  tolerancePercent: number;
  action: "NONE" | "WARN" | "BLOCK";
}): AvailabilityResult {
  const available = round(opts.budget - opts.consumed);
  if (opts.action === "NONE" || opts.budget <= 0) return { result: "OK", available, overBy: 0 };
  const limit = opts.budget * (1 + opts.tolerancePercent / 100);
  const after = opts.consumed + opts.amount;
  if (after <= limit + 1e-9) return { result: "OK", available, overBy: 0 };
  return { result: opts.action, available, overBy: round(after - opts.budget) };
}

/** Percentages for an allocation must add up to 100. */
export function validateShares(percents: number[]): string | null {
  if (percents.length === 0) return "Add at least one receiver.";
  if (percents.some((p) => !(p > 0) || p > 100)) return "Each share must be more than 0 and at most 100.";
  const sum = percents.reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 100) > 0.01) return `Shares must add up to 100% (they add up to ${round(sum)}%).`;
  return null;
}

/**
 * Splits `total` by percentage, rounded to cents, with any rounding
 * remainder given to the largest share so the parts always add back up to
 * exactly the total.
 */
export function allocate(total: number, receivers: { id: string; percent: number }[]): { id: string; amount: number }[] {
  const cents = Math.round(total * 100);
  const parts = receivers.map((r) => ({ id: r.id, cents: Math.floor((cents * r.percent) / 100) }));
  const remainder = cents - parts.reduce((s, p) => s + p.cents, 0);
  if (parts.length > 0 && remainder !== 0) {
    const largest = receivers.reduce((best, r, i) => (r.percent > receivers[best].percent ? i : best), 0);
    parts[largest].cents += remainder;
  }
  return parts.map((p) => ({ id: p.id, amount: p.cents / 100 }));
}

export type MarginLine = { key: string; label: string; revenue: number; cost: number };

/** Contribution margin: revenue less the cost of what was sold. */
export function contributionMargin(lines: MarginLine[]) {
  return lines
    .map((l) => {
      const margin = round(l.revenue - l.cost);
      return { ...l, revenue: round(l.revenue), cost: round(l.cost), margin, marginPercent: l.revenue > 0 ? round((margin / l.revenue) * 100) : null };
    })
    .sort((a, b) => b.margin - a.margin);
}

export function formatInternalOrderNumber(sequence: number): string {
  return `IO${String(sequence).padStart(4, "0")}`;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Reads ?fy= and ?m= from a page URL. Defaults to the current fiscal year,
 * whole year. A month outside the chosen fiscal year is ignored.
 */
export function resolvePeriods(fyParam: string | undefined, mParam: string | undefined, startMonth: number, today: Date = new Date()) {
  const current = fiscalYearOf(today, startMonth);
  const fy = fyParam && /^\d{4}$/.test(fyParam) ? Number(fyParam) : current;
  const months = fiscalYearMonths(fy, startMonth);
  const picked = mParam ? months.find((p) => periodKey(p) === mParam) : undefined;
  return {
    fiscalYear: fy,
    month: picked ? periodKey(picked) : null,
    periods: picked ? [picked] : months,
    years: [current - 2, current - 1, current, current + 1],
  };
}
