/* Profit per branch from accounting transactions. Pure so it can be unit
   tested; the Reports page and the CSV export both use it. */

export type ProfitRow = {
  /** Null is the company wide row: money not tied to any branch. */
  branchId: string | null;
  name: string;
  income: number;
  expense: number;
  net: number;
  /** Net as a share of income, or null when there was no income. */
  marginPct: number | null;
};

export function profitByBranch(
  transactions: { type: "INCOME" | "EXPENSE"; amount: number; branchId: string | null }[],
  branches: { id: string; name: string }[]
): { rows: ProfitRow[]; total: ProfitRow } {
  const sums = new Map<string | null, { income: number; expense: number }>();
  const known = new Set(branches.map((b) => b.id));
  for (const t of transactions) {
    // Money on a branch that no longer exists counts as company wide.
    const key = t.branchId && known.has(t.branchId) ? t.branchId : null;
    const s = sums.get(key) ?? { income: 0, expense: 0 };
    if (t.type === "INCOME") s.income += t.amount;
    else s.expense += t.amount;
    sums.set(key, s);
  }

  const row = (branchId: string | null, name: string, s = { income: 0, expense: 0 }): ProfitRow => {
    const net = s.income - s.expense;
    return { branchId, name, income: s.income, expense: s.expense, net, marginPct: s.income > 0 ? (net / s.income) * 100 : null };
  };

  const rows = branches.map((b) => row(b.id, b.name, sums.get(b.id)));
  const wide = sums.get(null);
  // Only show the company wide row when something is actually booked there.
  if (wide && (wide.income !== 0 || wide.expense !== 0)) rows.push(row(null, "Company wide", wide));

  const all = [...sums.values()].reduce((a, s) => ({ income: a.income + s.income, expense: a.expense + s.expense }), {
    income: 0,
    expense: 0,
  });
  return { rows, total: row(null, "All branches", all) };
}

/** Rows for toCsv: one line per branch, then the total. */
export function profitCsvRows(rows: ProfitRow[], total: ProfitRow): (string | number)[][] {
  return [...rows, total].map((r) => [
    r.name,
    r.income.toFixed(2),
    r.expense.toFixed(2),
    r.net.toFixed(2),
    r.marginPct === null ? "" : r.marginPct.toFixed(1),
  ]);
}

export const PROFIT_CSV_HEADERS = ["Branch", "Income", "Expenses", "Net", "Margin %"];
