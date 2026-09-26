import "server-only";
import { startOfMonth, subMonths } from "date-fns";
import { db } from "@/lib/db";
import { profitByBranch } from "@/lib/branch-profit";

/** Months the profit table covers, matching the rest of the Reports page. */
export const PROFIT_MONTHS = 6;

/**
 * Income, expenses and net per branch over the last six months. Always
 * company wide: it exists to compare branches side by side.
 */
export async function getProfitByBranch(companyId: string) {
  const since = startOfMonth(subMonths(new Date(), PROFIT_MONTHS - 1));
  const [transactions, branches] = await Promise.all([
    db.transaction.findMany({
      where: { companyId, date: { gte: since } },
      select: { type: true, amount: true, branchId: true },
    }),
    db.branch.findMany({
      where: { companyId, OR: [{ active: true }, { transactions: { some: { date: { gte: since } } } }] },
      orderBy: [{ isMain: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  return { since, ...profitByBranch(transactions, branches) };
}
