import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/ui-dark/badge";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ControllingTabs, UsageBar, money } from "@/components/controlling/controlling-parts";
import { getControllingSettings, loadCostLines, sumBy } from "@/lib/controlling";
import { variance } from "@/lib/controlling-math";
import { createInternalOrder } from "@/lib/actions/controlling";

const tone = { OPEN: "blue", CLOSED: "yellow", SETTLED: "green" } as const;

export default async function InternalOrdersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error } = await searchParams;
  const settings = await getControllingSettings(session.companyId);

  const [orders, centers, lines] = await Promise.all([
    db.internalOrder.findMany({
      where: { companyId: session.companyId },
      include: { settleTo: { select: { code: true, name: true } } },
      orderBy: { orderNumber: "desc" },
    }),
    db.costCenter.findMany({ where: { companyId: session.companyId, active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    loadCostLines(session.companyId, { from: new Date(Date.UTC(1970, 0, 1)), to: new Date(Date.UTC(9999, 0, 1)) }, { ...settings, includePayroll: false }),
  ]);
  // Gross cost booked to each order, before settlement moved it out.
  const booked = sumBy(lines.filter((l) => l.source !== "SETTLEMENT"), "internalOrderId");
  const balance = sumBy(lines, "internalOrderId");

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Internal orders</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Temporary cost collectors with their own budget, like a trade fair or a repair, settled onto a cost center when done.
      </p>
      <ControllingTabs active="/dashboard/controlling/orders" />

      <div className="mt-4">
        <ErrorBanner code={error} />
      </div>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        {orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No internal orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Budget</th>
                <th className="px-5 py-3 text-right font-medium">Cost booked</th>
                <th className="px-5 py-3 text-right font-medium">Balance</th>
                <th className="px-5 py-3 font-medium">Used</th>
                <th className="px-5 py-3 font-medium">Settles to</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const cost = booked.get(o.id) ?? 0;
                const v = variance(o.budget, cost, settings.tolerancePercent);
                return (
                  <tr key={o.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/controlling/orders/${o.id}`} className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400">
                        <span className="font-mono">{o.orderNumber}</span> {o.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={o.status} tone={tone[o.status]} />
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{money(o.budget)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-300 light:text-slate-600">{money(cost)}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-400">{money(balance.get(o.id) ?? 0)}</td>
                    <td className="px-5 py-3">
                      <UsageBar used={v.used} status={v.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-400">{o.settleTo ? `${o.settleTo.code} ${o.settleTo.name}` : "Not set"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <form
        action={createInternalOrder}
        className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5"
      >
        <p className="font-medium text-slate-50 light:text-slate-900">New internal order</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Spring trade fair" maxLength={100} required />
          </div>
          <div>
            <Label htmlFor="budget">Budget</Label>
            <Input id="budget" name="budget" type="number" min="0" step="0.01" defaultValue={0} required />
          </div>
        </div>
        <div>
          <Label htmlFor="settleToId">Settle to cost center</Label>
          <Select id="settleToId" name="settleToId" defaultValue="">
            <option value="">Choose later</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Input id="description" name="description" maxLength={500} />
        </div>
        <SubmitButton pendingText="Creating...">Create internal order</SubmitButton>
      </form>
    </div>
  );
}
