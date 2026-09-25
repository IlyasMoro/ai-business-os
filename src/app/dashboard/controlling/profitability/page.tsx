import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ControllingTabs, PeriodPicker, money, percent } from "@/components/controlling/controlling-parts";
import { getControllingSettings } from "@/lib/controlling";
import { contributionMargin, periodRange, resolvePeriods, type MarginLine } from "@/lib/controlling-math";

function MarginTable({ title, rows, hrefBase }: { title: string; rows: ReturnType<typeof contributionMargin>; hrefBase: string }) {
  const total = rows.reduce((s, r) => ({ revenue: s.revenue + r.revenue, cost: s.cost + r.cost, margin: s.margin + r.margin }), { revenue: 0, cost: 0, margin: 0 });
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
      <h2 className="px-5 pt-4 text-sm font-semibold text-slate-50 light:text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No fulfilled orders in this period.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
              <th className="px-5 py-2 font-medium">Name</th>
              <th className="px-5 py-2 text-right font-medium">Revenue</th>
              <th className="px-5 py-2 text-right font-medium">Cost of goods</th>
              <th className="px-5 py-2 text-right font-medium">Margin</th>
              <th className="px-5 py-2 text-right font-medium">Margin %</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-white/[0.04] last:border-0">
                <td className="px-5 py-2 font-sans">
                  <Link href={`${hrefBase}/${r.key}`} className="text-slate-50 light:text-slate-900 hover:text-blue-400">
                    {r.label}
                  </Link>
                </td>
                <td className="px-5 py-2 text-right text-slate-300 light:text-slate-600">{money(r.revenue)}</td>
                <td className="px-5 py-2 text-right text-slate-400">{money(r.cost)}</td>
                <td className={`px-5 py-2 text-right font-semibold ${r.margin < 0 ? "text-red-400" : "text-emerald-400"}`}>{money(r.margin)}</td>
                <td className="px-5 py-2 text-right text-slate-400">{r.marginPercent === null ? "" : percent(r.marginPercent)}</td>
              </tr>
            ))}
            <tr className="border-t border-white/[0.1] font-semibold light:border-slate-300">
              <td className="px-5 py-2 font-sans text-slate-300 light:text-slate-700">Total</td>
              <td className="px-5 py-2 text-right text-slate-300 light:text-slate-700">{money(total.revenue)}</td>
              <td className="px-5 py-2 text-right text-slate-400">{money(total.cost)}</td>
              <td className={`px-5 py-2 text-right ${total.margin < 0 ? "text-red-400" : "text-emerald-400"}`}>{money(total.margin)}</td>
              <td className="px-5 py-2 text-right text-slate-400">{total.revenue > 0 ? percent(Math.round((total.margin / total.revenue) * 1000) / 10) : ""}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function ProfitabilityPage({ searchParams }: { searchParams: Promise<{ fy?: string; m?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { fy, m } = await searchParams;
  const settings = await getControllingSettings(session.companyId);
  const period = resolvePeriods(fy, m, settings.fiscalYearStartMonth);
  const range = periodRange(period.periods);

  // Sold goods are counted when they ship, using each product's current cost.
  const items = await db.orderItem.findMany({
    where: {
      order: {
        companyId: session.companyId,
        status: "FULFILLED",
        OR: [{ fulfilledAt: { gte: range.from, lt: range.to } }, { fulfilledAt: null, createdAt: { gte: range.from, lt: range.to } }],
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      product: { select: { id: true, name: true, cost: true } },
      order: { select: { customer: { select: { id: true, name: true } } } },
    },
  });

  const byProduct = new Map<string, MarginLine>();
  const byCustomer = new Map<string, MarginLine>();
  for (const i of items) {
    const revenue = i.quantity * i.unitPrice;
    const cost = i.quantity * i.product.cost;
    for (const [map, key, label] of [
      [byProduct, i.product.id, i.product.name],
      [byCustomer, i.order.customer.id, i.order.customer.name],
    ] as const) {
      const row = map.get(key) ?? { key, label, revenue: 0, cost: 0 };
      row.revenue += revenue;
      row.cost += cost;
      map.set(key, row);
    }
  }

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Profitability</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Contribution margin from fulfilled orders: revenue less the cost of the goods sold.
          </p>
        </div>
        <PeriodPicker action="/dashboard/controlling/profitability" fiscalYear={period.fiscalYear} month={period.month} startMonth={settings.fiscalYearStartMonth} years={period.years} />
      </div>
      <ControllingTabs active="/dashboard/controlling/profitability" />
      <div className="mt-6 space-y-6">
        <MarginTable title="By product" rows={contributionMargin([...byProduct.values()])} hrefBase="/dashboard/inventory" />
        <MarginTable title="By customer" rows={contributionMargin([...byCustomer.values()])} hrefBase="/dashboard/crm" />
      </div>
    </div>
  );
}
