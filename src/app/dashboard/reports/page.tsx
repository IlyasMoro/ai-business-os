import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatCompactCurrency } from "@/lib/utils";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { DonutChart } from "@/components/dash-viz/donut-chart";
import { GroupedBarChart } from "@/components/dash-viz/grouped-bar-chart";
import { HorizontalBarChart } from "@/components/dash-viz/horizontal-bar-chart";
import { HeatBar } from "@/components/dash-viz/heat-bar";
import { MonoTrendBadge } from "@/components/dash-viz/mono-badge";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { VIZ } from "@/components/dash-viz/colors";

const orderStatusOrder = ["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;
const orderStatusColor: Record<(typeof orderStatusOrder)[number], string> = {
  PENDING: VIZ.amber,
  CONFIRMED: VIZ.blue,
  FULFILLED: VIZ.emerald,
  CANCELLED: VIZ.red,
};

const invoiceStatusOrder = ["DRAFT", "SENT", "PAID", "OVERDUE"] as const;
const invoiceStatusColor: Record<(typeof invoiceStatusOrder)[number], string> = {
  DRAFT: VIZ.muted,
  SENT: VIZ.blue,
  PAID: VIZ.emerald,
  OVERDUE: VIZ.red,
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

export default async function ReportsPage() {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const companyId = session.companyId;

  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

  const [
    orderGroups,
    invoiceGroups,
    transactions,
    customersWithOrders,
    recentInvoices,
    recentAiActions,
    recentAuditLogs,
  ] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.invoice.groupBy({ by: ["status"], where: { companyId }, _count: { _all: true } }),
    db.transaction.findMany({
      where: { companyId, date: { gte: sixMonthsAgo } },
      select: { type: true, amount: true, date: true },
    }),
    db.customer.findMany({
      where: { companyId },
      select: { name: true, orders: { select: { totalAmount: true } } },
    }),
    db.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, invoiceNumber: true, totalAmount: true, status: true, customer: { select: { name: true } } },
    }),
    db.aiAction.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, summary: true, status: true, createdAt: true, requestedBy: { select: { name: true } } },
    }),
    db.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, metadata: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);

  const orderCountByStatus = new Map(orderGroups.map((g) => [g.status, g._count._all]));
  const invoiceCountByStatus = new Map(invoiceGroups.map((g) => [g.status, g._count._all]));
  const totalOrders = orderGroups.reduce((s, g) => s + g._count._all, 0);
  const totalInvoices = invoiceGroups.reduce((s, g) => s + g._count._all, 0);

  const months = Array.from({ length: 6 }).map((_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
  const monthly = months.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    const monthTx = transactions.filter((t) => t.date >= monthStart && t.date <= monthEnd);
    const income = monthTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
    return { label: format(monthStart, "MMM"), income, expense };
  });

  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);
  const net = totalIncome - totalExpense;

  const customerValues = customersWithOrders
    .map((c) => ({ name: c.name, total: c.orders.reduce((s, o) => s + o.totalAmount, 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const avgCustomerValue =
    customerValues.length > 0 ? customerValues.reduce((s, c) => s + c.total, 0) / customerValues.length : 0;
  const customerDeltas = customerValues.map((c) => ({
    ...c,
    deltaPct: avgCustomerValue > 0 ? ((c.total - avgCustomerValue) / avgCustomerValue) * 100 : 0,
  }));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-slate-950 p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-white">Reports</h1>
      <p className="mt-1 text-sm text-slate-400">A snapshot of revenue, sales, and invoicing over the last 6 months.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Income (6 months)</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">
            <AnimatedCounter value={totalIncome} prefix="R" decimals={0} />
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Expenses (6 months)</p>
          <p className="mt-2 text-2xl font-semibold text-red-400">
            <AnimatedCounter value={totalExpense} prefix="R" decimals={0} />
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Net (6 months)</p>
          <p className={`mt-2 text-2xl font-semibold ${net >= 0 ? "text-white" : "text-red-400"}`}>
            <AnimatedCounter value={net} prefix="R" decimals={0} />
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Portfolio breakdown</h2>
        <div className="flex flex-col items-center justify-around gap-8 sm:flex-row sm:items-start">
          <DonutChart
            title="Income vs expenses"
            centerValue={formatCompactCurrency(net)}
            centerLabel="net (6mo)"
            slices={[
              { label: "Income", value: Math.max(0, totalIncome), color: VIZ.emerald },
              { label: "Expenses", value: Math.max(0, totalExpense), color: VIZ.red },
            ]}
          />
          <DonutChart
            title="Orders by status"
            centerValue={String(totalOrders)}
            centerLabel="orders"
            slices={orderStatusOrder.map((status) => ({
              label: status.charAt(0) + status.slice(1).toLowerCase(),
              value: orderCountByStatus.get(status) ?? 0,
              color: orderStatusColor[status],
            }))}
          />
          <DonutChart
            title="Invoices by status"
            centerValue={String(totalInvoices)}
            centerLabel="invoices"
            slices={invoiceStatusOrder.map((status) => ({
              label: status.charAt(0) + status.slice(1).toLowerCase(),
              value: invoiceCountByStatus.get(status) ?? 0,
              color: invoiceStatusColor[status],
            }))}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Revenue vs expenses</h2>
        <GroupedBarChart
          data={monthly.map((m) => ({ label: m.label, a: m.income, b: m.expense }))}
          aLabel="Income"
          bLabel="Expenses"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-white">Top customers by order value</h2>
          {customerValues.length === 0 ? (
            <p className="text-sm text-slate-500">No order value recorded yet.</p>
          ) : (
            <HorizontalBarChart
              data={customerValues.map((c) => ({ label: c.name, value: c.total }))}
              color={VIZ.blue}
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-white">Value vs average customer</h2>
          {customerDeltas.length === 0 ? (
            <p className="text-sm text-slate-500">No order value recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {customerDeltas.map((c) => (
                <HeatBar key={c.name} label={c.name} deltaPct={c.deltaPct} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 p-6 pb-4">
          <h2 className="text-sm font-semibold text-white">Customer value ranking</h2>
        </div>
        <div className="p-6 pt-4">
          {customerDeltas.length === 0 ? (
            <p className="text-sm text-slate-500">No order value recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-500">
                  <th className="py-2 font-medium">Customer</th>
                  <th className="py-2 font-medium">Order value</th>
                  <th className="py-2 font-medium">Vs average</th>
                </tr>
              </thead>
              <tbody>
                {customerDeltas.map((c) => (
                  <tr key={c.name} className="border-b border-slate-800/60 last:border-0">
                    <td className="py-2.5 text-white">{c.name}</td>
                    <td className="py-2.5 font-mono tabular-nums text-slate-300">{formatCompactCurrency(c.total)}</td>
                    <td className="py-2.5">
                      <MonoTrendBadge pct={c.deltaPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Recent invoices</h2>
        {recentInvoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {recentInvoices.map((invoice) => (
              <li key={invoice.id} className="group flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-slate-200">{invoice.invoiceNumber}</p>
                  <p className="truncate text-xs text-slate-500">{invoice.customer.name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs uppercase tracking-wide text-slate-500">
                    {invoice.status.toLowerCase()}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-amber-400">
                    {formatCompactCurrency(invoice.totalAmount)}
                  </span>
                  <a
                    href={`/dashboard/invoicing/${invoice.id}`}
                    className="text-xs text-blue-400 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    View →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Recent AI activity</h2>
        {recentAiActions.length === 0 ? (
          <p className="text-sm text-slate-500">No actions have been proposed by the AI assistant yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-500">
                <th className="py-2 font-medium">Action</th>
                <th className="py-2 font-medium">Requested by</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {recentAiActions.map((action) => (
                <tr key={action.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 text-white">{action.summary}</td>
                  <td className="py-2 text-slate-400">{action.requestedBy.name}</td>
                  <td className="py-2 text-xs uppercase tracking-wide text-slate-500">
                    {action.status.toLowerCase()}
                  </td>
                  <td className="py-2 font-mono text-xs tabular-nums text-slate-500">
                    {format(action.createdAt, "MMM d, HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Recent activity</h2>
        {recentAuditLogs.length === 0 ? (
          <p className="text-sm text-slate-500">
            No sensitive changes (payroll, employee, or invoice status) have been recorded yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-500">
                <th className="py-2 font-medium">Action</th>
                <th className="py-2 font-medium">By</th>
                <th className="py-2 font-medium">Details</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {recentAuditLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 text-white">{formatAuditAction(log.action)}</td>
                  <td className="py-2 text-slate-400">{log.user.name}</td>
                  <td className="py-2 text-slate-400">{formatAuditMetadata(log.metadata) ?? "—"}</td>
                  <td className="py-2 font-mono text-xs tabular-nums text-slate-500">
                    {format(log.createdAt, "MMM d, HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
