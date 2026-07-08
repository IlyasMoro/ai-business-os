import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { ErrorBanner } from "@/components/ui/error-banner";
import { VIZ } from "@/components/dash-viz/colors";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

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

  const where: Prisma.TransactionWhereInput = {
    companyId: session.companyId,
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
      where: { companyId: session.companyId },
      select: { type: true, amount: true },
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

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <ErrorBanner code={error} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Accounting</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalCount} transaction{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form method="GET" className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search by category..."
              defaultValue={q}
              className="w-full rounded-md border border-white/[0.06] bg-[#111111] py-2 pl-9 pr-3 text-sm text-slate-50 placeholder:text-slate-500 outline-none transition-colors focus:border-blue-500"
            />
          </form>
          <Link
            href="/dashboard/accounting/new"
            className="inline-flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            New transaction
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
            <p className="text-sm text-slate-400">Income</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">
              <AnimatedCounter value={income} prefix="$" decimals={0} />
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
            <p className="text-sm text-slate-400">Expenses</p>
            <p className="mt-2 text-2xl font-semibold text-red-400">
              <AnimatedCounter value={expense} prefix="$" decimals={0} />
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
            <p className="text-sm text-slate-400">Net</p>
            <p className={`mt-2 text-2xl font-semibold ${net >= 0 ? "text-slate-50" : "text-red-400"}`}>
              <AnimatedCounter value={net} prefix="$" decimals={0} />
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-6 lg:col-span-1">
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

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#111111]">
        {transactions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q
              ? "No transactions match your search."
              : "No transactions yet. Add your first one to get started."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3 text-slate-400">
                    {transaction.date.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/accounting/${transaction.id}`}
                      className="font-medium text-slate-50 hover:text-blue-400"
                    >
                      {transaction.category}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: transaction.type === "INCOME" ? VIZ.emerald : VIZ.red }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: transaction.type === "INCOME" ? VIZ.emerald : VIZ.red }}
                      />
                      {transaction.type}
                    </span>
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
          <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={accountingHref(page - 1, q)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={accountingHref(page + 1, q)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/5"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700">
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
