import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge, StatusBadge } from "@/components/ui-dark/badge";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { UsageBar, VarianceBadge, money } from "@/components/controlling/controlling-parts";
import { getControllingSettings, loadCostLines } from "@/lib/controlling";
import { variance } from "@/lib/controlling-math";
import { closeInternalOrder, reopenInternalOrder, settleInternalOrder, updateInternalOrder } from "@/lib/actions/controlling";
import { BackButton } from "@/components/ui-dark/back-button";

const tone = { OPEN: "blue", CLOSED: "yellow", SETTLED: "green" } as const;

export default async function InternalOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { id } = await params;
  const { error, saved } = await searchParams;
  const settings = await getControllingSettings(session.companyId);

  const io = await db.internalOrder.findUnique({
    where: { id, companyId: session.companyId },
    include: { settleTo: { select: { id: true, code: true, name: true } } },
  });
  if (!io) notFound();

  const [lines, centers] = await Promise.all([
    loadCostLines(session.companyId, { from: new Date(Date.UTC(1970, 0, 1)), to: new Date(Date.UTC(9999, 0, 1)) }, settings, { internalOrderId: io.id }),
    db.costCenter.findMany({ where: { companyId: session.companyId, active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const booked = lines.filter((l) => l.source !== "SETTLEMENT").reduce((s, l) => s + l.amount, 0);
  const balance = lines.reduce((s, l) => s + l.amount, 0);
  const v = variance(io.budget, booked, settings.tolerancePercent);
  const card = "rounded-2xl border border-white/[0.09] light:border-white/80 glass";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/controlling/orders" label="Back to internal orders" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
                <span className="font-mono">{io.orderNumber}</span> {io.name}
              </h1>
              <StatusBadge status={io.status} tone={tone[io.status]} />
              {io.budget > 0 && <VarianceBadge status={v.status} />}
            </div>
            {io.description && <p className="mt-1 text-slate-400 light:text-slate-500">{io.description}</p>}
            <p className="mt-1 text-sm text-slate-500">
              Settles to{" "}
              {io.settleTo ? (
                <Link href={`/dashboard/controlling/cost-centers/${io.settleTo.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                  {io.settleTo.code} {io.settleTo.name}
                </Link>
              ) : (
                "no cost center yet"
              )}
              {io.settledAt && <> · Settled {io.settledAt.toLocaleDateString()}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {io.status === "OPEN" && (
              <form action={closeInternalOrder.bind(null, io.id)}>
                <SubmitButton variant="secondary" pendingText="Closing...">
                  Close
                </SubmitButton>
              </form>
            )}
            {io.status === "CLOSED" && (
              <form action={reopenInternalOrder.bind(null, io.id)}>
                <SubmitButton variant="secondary" pendingText="Reopening...">
                  Reopen
                </SubmitButton>
              </form>
            )}
            {io.status !== "SETTLED" && (
              <form action={settleInternalOrder.bind(null, io.id)}>
                <SubmitButton pendingText="Settling...">Settle {money(balance)}</SubmitButton>
              </form>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {saved && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</p>}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Budget", value: money(io.budget), cls: "text-blue-400" },
            { label: "Cost booked", value: money(booked), cls: "text-amber-400" },
            { label: io.status === "SETTLED" ? "Left on order" : "Available", value: io.status === "SETTLED" ? money(balance) : io.budget > 0 ? money(io.budget - booked) : "No budget", cls: io.budget - booked < 0 ? "text-red-400" : "text-emerald-400" },
          ].map((k) => (
            <div key={k.label} className={`${card} p-5`}>
              <p className="text-sm text-slate-400 light:text-slate-500">{k.label}</p>
              <p className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${k.cls}`}>{k.value}</p>
            </div>
          ))}
        </div>
        {io.budget > 0 && (
          <div className="mt-3">
            <UsageBar used={v.used} status={v.status} />
          </div>
        )}

        <div className={`${card} mt-6 overflow-x-auto`}>
          <h2 className="px-5 pt-4 text-sm font-semibold text-slate-50 light:text-slate-900">Line items</h2>
          {lines.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No costs yet. Choose this order as the cost object on an expense in Accounting.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-white/[0.04] light:border-slate-100">
                    <td className="px-5 py-2 text-slate-400">{l.date.toLocaleDateString()}</td>
                    <td className="px-5 py-2">
                      <Badge tone={l.source === "SETTLEMENT" ? "green" : "slate"}>{l.source === "SETTLEMENT" ? "Settlement" : "Expense"}</Badge>
                    </td>
                    <td className="px-5 py-2 text-slate-300 light:text-slate-600">
                      {l.href ? (
                        <Link href={l.href} className="hover:text-blue-400">
                          {l.label}
                        </Link>
                      ) : (
                        l.label
                      )}
                    </td>
                    <td className={`px-5 py-2 text-right font-mono tabular-nums ${l.amount < 0 ? "text-emerald-400" : "text-slate-300 light:text-slate-600"}`}>{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {io.status !== "SETTLED" && (
          <form action={updateInternalOrder.bind(null, io.id)} className={`${card} mt-6 max-w-2xl space-y-4 p-5`}>
            <p className="font-medium text-slate-50 light:text-slate-900">Details</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={io.name} required maxLength={100} />
              </div>
              <div>
                <Label htmlFor="budget">Budget</Label>
                <Input id="budget" name="budget" type="number" min="0" step="0.01" defaultValue={io.budget} required />
              </div>
            </div>
            <div>
              <Label htmlFor="settleToId">Settle to cost center</Label>
              <Select id="settleToId" name="settleToId" defaultValue={io.settleToId ?? ""}>
                <option value="">Choose later</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" defaultValue={io.description ?? ""} maxLength={500} />
            </div>
            <SubmitButton variant="secondary" pendingText="Saving...">
              Save
            </SubmitButton>
          </form>
        )}

      </div>
    </div>
  );
}
