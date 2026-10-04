/* Totals for the stock value and sales sections on Reports. No database
   access here (lib/report-data.ts loads the rows). */

const cents = (n: number) => Math.round(n * 100) / 100;

export type StockRow = { branchId: string; branchName: string; productId: string; productName: string; quantity: number; cost: number };

/** Stock value at cost by branch and by product. Stock below zero counts as none. */
export function stockValue(rows: StockRow[], topN = 8) {
  const byBranch = new Map<string, { name: string; units: number; value: number }>();
  const byProduct = new Map<string, { name: string; units: number; value: number }>();
  let total = 0;
  for (const r of rows) {
    const units = Math.max(0, r.quantity);
    const value = units * r.cost;
    total += value;
    const b = byBranch.get(r.branchId) ?? { name: r.branchName, units: 0, value: 0 };
    b.units += units;
    b.value += value;
    byBranch.set(r.branchId, b);
    const p = byProduct.get(r.productId) ?? { name: r.productName, units: 0, value: 0 };
    p.units += units;
    p.value += value;
    byProduct.set(r.productId, p);
  }
  const sorted = (m: Map<string, { name: string; units: number; value: number }>) =>
    [...m.entries()].map(([id, v]) => ({ id, ...v, value: cents(v.value) })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return { total: cents(total), branches: sorted(byBranch), products: sorted(byProduct).filter((p) => p.value > 0).slice(0, topN) };
}

export type SoldLine = { orderId: string; productId: string; productName: string; quantity: number; unitPrice: number };

/** Orders, revenue, average order value and the best sellers by value. */
export function salesSummary(lines: SoldLine[], topN = 8) {
  const orders = new Set(lines.map((l) => l.orderId));
  const byProduct = new Map<string, { name: string; units: number; value: number }>();
  let revenue = 0;
  for (const l of lines) {
    const value = l.quantity * l.unitPrice;
    revenue += value;
    const p = byProduct.get(l.productId) ?? { name: l.productName, units: 0, value: 0 };
    p.units += l.quantity;
    p.value += value;
    byProduct.set(l.productId, p);
  }
  return {
    orderCount: orders.size,
    revenue: cents(revenue),
    averageOrder: orders.size > 0 ? cents(revenue / orders.size) : null,
    products: [...byProduct.entries()]
      .map(([id, v]) => ({ id, ...v, value: cents(v.value), sharePct: revenue > 0 ? Math.round((v.value / revenue) * 1000) / 10 : 0 }))
      // Ties by name, so the list is the same every time.
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, topN),
  };
}
