import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/branches";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { HorizontalBarChart } from "@/components/dash-viz/horizontal-bar-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { ErrorBanner } from "@/components/ui/error-banner";
import { VIZ } from "@/components/dash-viz/colors";
import { StatusBadge } from "@/components/ui-dark/badge";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, Search, ChevronLeft, ChevronRight, Download, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";
import { fieldStyles } from "@/components/ui-dark/input";

function accountingHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/accounting?${qs}` : "/dashboard/accounting";
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; error?: string }>;
}) {
  const { page: pageParam, q, error } = await searchParams;
  const page = parsePage(pageParam);
  const session = await requireRole(["OWNER", "ADMIN"]);

  // Follows the top bar switcher. With a branch in view, company wide
  // entries (no branch) are left out, like other branches' money.
  const inBranch = await branchWhere();
  const where: Prisma.TransactionWhereInput = {
    companyId: session.companyId,
    ...inBranch,
    ...(q ? { category: { contains: q } } : {}),
  };

  const [transactions, totalCount, allForTotals] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.transaction.count({ where }),
    db.transaction.findMany({
      where: { companyId: session.companyId, ...inBranch },
      select: { type: true, amount: true, category: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const income = allForTotals
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = allForTotals
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);
  const net = income - expense;

  const categoryTotals = new Map<string, number>();
  for (const t of allForTotals) {
    categoryTotals.set(t.category, (categoryTotals.get(t.category) ?? 0) + t.amount);
  }
  const topCategories = Array.from(categoryTotals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <ErrorBanner code={error} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Transactions</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} transaction{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <form method="GET" className="relative w-full min-w-48 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search by category..."
              defaultValue={q}
              className={fieldStyles("pl-9")}
            />
          </form>
          <a
            href="/api/export/transactions"
            className={buttonStyles("secondary")}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link
            href="/dashboard/accounting/new"
            className={buttonStyles("primary")}
          >
            <Plus className="h-4 w-4" />
            New transaction
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
            <p className="text-sm text-slate-400 light:text-slate-500">Income</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">
              <AnimatedCounter value={income} prefix="$" decimals={0} />
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
            <p className="text-sm text-slate-400 light:text-slate-500">Expenses</p>
            <p className="mt-2 text-2xl font-semibold text-red-400">
              <AnimatedCounter value={expense} prefix="$" decimals={0} />
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
            <p className="text-sm text-slate-400 light:text-slate-500">Net</p>
            <p className={`mt-2 text-2xl font-semibold ${net >= 0 ? "text-slate-50 light:text-slate-900" : "text-red-400"}`}>
              <AnimatedCounter value={net} prefix="$" decimals={0} />
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-6 lg:col-span-1 glass">
          <div className="flex justify-center">
            <DonutChart
              title="Income vs expenses"
              centerValue={formatCompactCurrency(net)}
              centerLabel="net"
              slices={[
                { label: "Income", value: Math.max(0, income), color: VIZ.emerald },
                { label: "Expenses", value: Math.max(0, expense), color: VIZ.red },
              ]}
            />
          </div>
        </div>
      </div>

      {topCategories.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 p-6 glass">
          <h2 className="mb-4 text-sm font-semibold text-slate-50 light:text-slate-900">Top categories</h2>
          <HorizontalBarChart data={topCategories} color={VIZ.amber} />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {transactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={q ? "No transactions match your search" : "No transactions yet"}
            description={q ? "Try a different search term, or clear it to see everything." : "Record income and expenses to see your cash flow here."}
            action={q ? { href: "/dashboard/accounting", label: "Clear search", variant: "secondary" } : { href: "/dashboard/accounting/new", label: "New transaction" }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">
                    {transaction.date.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/accounting/${transaction.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {transaction.category}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={transaction.type} color={transaction.type === "INCOME" ? VIZ.emerald : VIZ.red} />
                  </td>
                  <td
                    className={`px-5 py-3 font-mono tabular-nums ${
                      transaction.type === "EXPENSE" ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {transaction.type === "EXPENSE" ? "-" : ""}
                    {formatCompactCurrency(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] light:border-slate-200 px-5 py-3">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={accountingHref(page - 1, q)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700 light:text-slate-300">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={accountingHref(page + 1, q)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700 light:text-slate-300">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
