/* Customers ranked by order value, for the one ranking list on Reports
   (it replaces three separate blocks that showed the same numbers). */

export type RankedCustomer = {
  rank: number;
  name: string;
  total: number;
  /** Share of all customers' order value, 0 to 100. */
  sharePct: number;
  /** Bar length relative to the top customer, 0 to 100. */
  barPct: number;
  /** Difference from the average customer, or null with fewer than two customers. */
  vsAveragePct: number | null;
};

export function rankCustomers(customers: { name: string; total: number }[], limit = 8): RankedCustomer[] {
  const withValue = customers.filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  if (withValue.length === 0) return [];
  const sum = withValue.reduce((s, c) => s + c.total, 0);
  const average = sum / withValue.length;
  const top = withValue[0].total;
  // Comparing against an average of one is always 0%, which says nothing.
  const compare = withValue.length >= 2;
  return withValue.slice(0, limit).map((c, i) => ({
    rank: i + 1,
    name: c.name,
    total: c.total,
    sharePct: (c.total / sum) * 100,
    barPct: (c.total / top) * 100,
    vsAveragePct: compare ? Math.round(((c.total - average) / average) * 1000) / 10 : null,
  }));
}
