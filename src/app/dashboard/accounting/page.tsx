import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

const typeTone = {
  INCOME: "green",
  EXPENSE: "red",
} as const;

export default async function AccountingPage() {
  const session = await verifySession();

  const transactions = await db.transaction.findMany({
    where: { companyId: session.companyId },
    orderBy: { date: "desc" },
  });

  const income = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);
  const net = income - expense;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Accounting</h1>
          <p className="mt-1 text-sm text-slate-500">
            {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton href="/dashboard/accounting/new">
          <Plus className="h-4 w-4" />
          New transaction
        </LinkButton>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Income</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">${income.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Expenses</p>
            <p className="mt-1 text-xl font-semibold text-red-600">${expense.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Net</p>
            <p className={`mt-1 text-xl font-semibold ${net >= 0 ? "text-slate-900" : "text-red-600"}`}>
              ${net.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        {transactions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No transactions yet. Add your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 text-slate-600">
                    {transaction.date.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/accounting/${transaction.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {transaction.category}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={typeTone[transaction.type]}>{transaction.type}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {transaction.type === "EXPENSE" ? "-" : ""}${transaction.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
