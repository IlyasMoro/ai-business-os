import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCompactCurrency } from "@/lib/utils";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import type { AiActionStatus } from "@/generated/prisma/enums";

const aiActionStatusTone: Record<AiActionStatus, "yellow" | "green" | "red" | "slate"> = {
  PENDING: "yellow",
  APPROVED: "green",
  EXECUTED: "green",
  REJECTED: "red",
  FAILED: "red",
};

const orderStatusOrder = ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;
const orderStatusBar: Record<(typeof orderStatusOrder)[number], string> = {
  PENDING: "bg-amber-500",
  CONFIRMED: "bg-blue-500",
  FULFILLED: "bg-emerald-500",
  CANCELLED: "bg-red-500",
};

const invoiceStatusOrder = ["DRAFT", "SENT", "PAID", "OVERDUE"] as const;
const invoiceStatusBar: Record<(typeof invoiceStatusOrder)[number], string> = {
  DRAFT: "bg-slate-400",
  SENT: "bg-blue-500",
  PAID: "bg-emerald-500",
  OVERDUE: "bg-red-500",
};

function formatAuditAction(action: string) {
  const readable = action.replace(/\./g, " ").replace(/_/g, " ");
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

function formatAuditMetadata(metadata: string | null) {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const parts = Object.entries(parsed)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}: ${value}`);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

function BarList({
  rows,
}: {
  rows: { label: string; count: number; barClass: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-700">
              <span className={`h-2 w-2 rounded-full ${row.barClass}`} />
              {row.label}
            </span>
            <span className="font-medium text-slate-900">{row.count}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${row.barClass}`}
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage() {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const companyId = session.companyId;

  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

  const [orderGroups, invoiceGroups, transactions, recentAiActions, recentAuditLogs] = await Promise.all([
    db.order.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
    db.invoice.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
    db.transaction.findMany({
      where: { companyId, date: { gte: sixMonthsAgo } },
      select: { type: true, amount: true, date: true },
    }),
    db.aiAction.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, summary: true, status: true, createdAt: true, requestedBy: { select: { name: true } } },
    }),
    db.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, metadata: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);

  const orderCountByStatus = new Map(orderGroups.map((g) => [g.status, g._count._all]));
  const invoiceCountByStatus = new Map(invoiceGroups.map((g) => [g.status, g._count._all]));

  const orderRows = orderStatusOrder.map((status) => ({
    label: status.charAt(0) + status.slice(1).toLowerCase().replace("_", " "),
    count: orderCountByStatus.get(status) ?? 0,
    barClass: orderStatusBar[status],
  }));

  const invoiceRows = invoiceStatusOrder.map((status) => ({
    label: status.charAt(0) + status.slice(1).toLowerCase(),
    count: invoiceCountByStatus.get(status) ?? 0,
    barClass: invoiceStatusBar[status],
  }));

  const months = Array.from({ length: 6 }).map((_, i) =>
    startOfMonth(subMonths(new Date(), 5 - i))
  );
  const monthly = months.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    const monthTx = transactions.filter((t) => t.date >= monthStart && t.date <= monthEnd);
    const income = monthTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
    return { label: format(monthStart, "MMM"), income, expense };
  });

  const maxAmount = Math.max(1, ...monthly.flatMap((m) => [m.income, m.expense]));
  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        A snapshot of revenue, sales, and invoicing over the last 6 months.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Income (6 months)</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {formatCompactCurrency(totalIncome)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Expenses (6 months)</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">
            {formatCompactCurrency(totalExpense)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Net (6 months)</p>
          <p
            className={`mt-2 text-2xl font-semibold ${
              totalIncome - totalExpense >= 0 ? "text-slate-900" : "text-red-600"
            }`}
          >
            {formatCompactCurrency(totalIncome - totalExpense)}
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Revenue vs expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Expenses
            </span>
          </div>

          <div className="flex h-40 items-end gap-4">
            {monthly.map((month) => (
              <div key={month.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 items-end gap-1">
                  <div className="flex flex-col items-center justify-end">
                    {month.income > 0 && (
                      <span className="mb-1 text-xs text-slate-500">
                        {formatCompactCurrency(month.income)}
                      </span>
                    )}
                    <div
                      className="w-5 rounded-t bg-emerald-500"
                      style={{ height: `${(month.income / maxAmount) * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-col items-center justify-end">
                    {month.expense > 0 && (
                      <span className="mb-1 text-xs text-slate-500">
                        {formatCompactCurrency(month.expense)}
                      </span>
                    )}
                    <div
                      className="w-5 rounded-t bg-red-500"
                      style={{ height: `${(month.expense / maxAmount) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">{month.label}</p>
              </div>
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
              View as table
            </summary>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 font-medium">Income</th>
                  <th className="py-2 font-medium">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((month) => (
                  <tr key={month.label} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-600">{month.label}</td>
                    <td className="py-2 text-slate-600">{formatCompactCurrency(month.income)}</td>
                    <td className="py-2 text-slate-600">{formatCompactCurrency(month.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList rows={orderRows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices by status</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList rows={invoiceRows} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent AI activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAiActions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No actions have been proposed by the AI assistant yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="py-2 font-medium">Action</th>
                  <th className="py-2 font-medium">Requested by</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {recentAiActions.map((action) => (
                  <tr key={action.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-900">{action.summary}</td>
                    <td className="py-2 text-slate-600">{action.requestedBy.name}</td>
                    <td className="py-2">
                      <Badge tone={aiActionStatusTone[action.status]}>
                        {action.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="py-2 text-slate-500">{format(action.createdAt, "MMM d, HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAuditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">
              No sensitive changes (payroll, employee, or invoice status) have been recorded yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="py-2 font-medium">Action</th>
                  <th className="py-2 font-medium">By</th>
                  <th className="py-2 font-medium">Details</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {recentAuditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 text-slate-900">{formatAuditAction(log.action)}</td>
                    <td className="py-2 text-slate-600">{log.user.name}</td>
                    <td className="py-2 text-slate-600">{formatAuditMetadata(log.metadata) ?? "—"}</td>
                    <td className="py-2 text-slate-500">{format(log.createdAt, "MMM d, HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
