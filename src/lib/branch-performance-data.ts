import "server-only";
import { addDays, endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { db } from "@/lib/db";
import { balanceDue } from "@/lib/invoice-rules";
import { lowStockAt } from "@/lib/stock";
import { branchInsights, scoreBranches, type BranchFigures } from "@/lib/branch-performance";

/** The period compared: the last 30 days against the 30 days before. */
export const PERIOD_DAYS = 30;
/** Stock expiring within this many days counts as "expiring soon". */
export const EXPIRING_DAYS = 3;
const TREND_MONTHS = 6;

/**
 * Every active branch's figures for the Branch performance page, scored
 * and ranked, with the findings to read first. Always company wide: it
 * exists to compare branches with each other.
 */
export async function getBranchPerformance(companyId: string) {
  const now = new Date();
  const periodStart = subDays(now, PERIOD_DAYS);
  const prevStart = subDays(now, PERIOD_DAYS * 2);
  const trendStart = startOfMonth(subMonths(now, TREND_MONTHS - 1));
  const since = prevStart < trendStart ? prevStart : trendStart;

  const [branches, transactions, orders, overdueInvoices, lowRows, expiringLots, stock, staff] = await Promise.all([
    db.branch.findMany({ where: { companyId, active: true }, orderBy: [{ isMain: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.transaction.findMany({ where: { companyId, date: { gte: since }, branchId: { not: null } }, select: { type: true, amount: true, date: true, branchId: true } }),
    db.order.findMany({ where: { companyId, createdAt: { gte: periodStart }, status: { not: "CANCELLED" }, branchId: { not: null } }, select: { branchId: true } }),
    db.invoice.findMany({ where: { companyId, status: "OVERDUE", branchId: { not: null } }, select: { branchId: true, totalAmount: true, amountPaid: true, amountCredited: true } }),
    lowStockAt(companyId, null),
    db.stockLot.findMany({
      where: { companyId, quantity: { gt: 0 }, expiresAt: { gte: now, lte: addDays(now, EXPIRING_DAYS) } },
      select: { branchId: true, quantity: true, product: { select: { cost: true } } },
    }),
    db.branchStock.findMany({ where: { companyId, quantity: { gt: 0 } }, select: { branchId: true, quantity: true, product: { select: { cost: true } } } }),
    db.employee.groupBy({ by: ["branchId"], where: { companyId, status: "ACTIVE", branchId: { not: null } }, _count: { _all: true } }),
  ]);

  const months = Array.from({ length: TREND_MONTHS }, (_, i) => startOfMonth(subMonths(now, TREND_MONTHS - 1 - i)));
  const sumWhere = <T,>(items: T[], test: (t: T) => boolean, value: (t: T) => number) =>
    items.reduce((s, t) => (test(t) ? s + value(t) : s), 0);

  const figures: BranchFigures[] = branches.map((b) => {
    const tx = transactions.filter((t) => t.branchId === b.id);
    const income = tx.filter((t) => t.type === "INCOME");
    return {
      id: b.id,
      name: b.name,
      revenue: sumWhere(income, (t) => t.date >= periodStart, (t) => t.amount),
      revenuePrev: sumWhere(income, (t) => t.date >= prevStart && t.date < periodStart, (t) => t.amount),
      expenses: sumWhere(tx, (t) => t.type === "EXPENSE" && t.date >= periodStart, (t) => t.amount),
      orders: orders.filter((o) => o.branchId === b.id).length,
      revenueByMonth: months.map((m) => sumWhere(income, (t) => t.date >= m && t.date <= endOfMonth(m), (t) => t.amount)),
      overdue: sumWhere(overdueInvoices, (i) => i.branchId === b.id, (i) => balanceDue(i)),
      lowStock: lowRows.filter((r) => r.branchId === b.id).length,
      expiring: sumWhere(expiringLots, (l) => l.branchId === b.id, (l) => l.quantity * l.product.cost),
      stockValue: sumWhere(stock, (s) => s.branchId === b.id, (s) => s.quantity * s.product.cost),
      employees: staff.find((s) => s.branchId === b.id)?._count._all ?? 0,
    };
  });

  const scored = scoreBranches(figures);
  return {
    branches: scored,
    /** Stable branch order (main first, then by name), for colours that
     * follow the branch and not its rank. */
    branchOrder: branches.map((b) => b.id),
    insights: branchInsights(scored, EXPIRING_DAYS),
    monthLabels: months.map((m) => format(m, "MMMM yyyy")),
    months: months.map((m) => ({ label: format(m, "MMM"), longLabel: format(m, "MMMM yyyy") })),
    periodStart,
  };
}
