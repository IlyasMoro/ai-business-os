import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ControllingTabs, money } from "@/components/controlling/controlling-parts";
import { getControllingSettings } from "@/lib/controlling";
import { fiscalYearMonths, fiscalYearOf, monthLabel, periodKey, periodOf } from "@/lib/controlling-math";
import { createAllocation, deleteAllocation, reverseAllocationRun, runAllocation } from "@/lib/actions/controlling";

const RECEIVER_ROWS = 4;

export default async function AllocationsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  const settings = await getControllingSettings(session.companyId);

  const [allocations, centers] = await Promise.all([
    db.coAllocation.findMany({
      where: { companyId: session.companyId },
      include: {
        sender: { select: { code: true, name: true } },
        receivers: { include: { costCenter: { select: { code: true, name: true } } }, orderBy: { percent: "desc" } },
        runs: { orderBy: [{ year: "desc" }, { month: "desc" }] },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.costCenter.findMany({ where: { companyId: session.companyId, active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  // Offer this fiscal year's and last fiscal year's months, most recent first.
  const fy = fiscalYearOf(new Date(), settings.fiscalYearStartMonth);
  // Only months that have started can be allocated; default to this month.
  const thisMonth = periodKey(periodOf(new Date()));
  const months = [...fiscalYearMonths(fy - 1, settings.fiscalYearStartMonth), ...fiscalYearMonths(fy, settings.fiscalYearStartMonth)]
    .filter((p) => periodKey(p) <= thisMonth)
    .reverse();
  const card = "rounded-2xl border border-white/[0.09] light:border-white/80 glass";
  const selectCls =
    "rounded-md border border-white/[0.09] light:border-white/80 glass px-3 py-2 text-sm text-slate-50 light:text-slate-900";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Allocations</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Share a support cost center, like IT or rent, out to the cost centers that use it. Each cycle runs once per month
        and can be reversed.
      </p>
      <ControllingTabs active="/dashboard/controlling/allocations" />

      <div className="mt-4 space-y-3">
        <ErrorBanner code={error} />
        {saved && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</p>}
      </div>

      <div className="mt-2 max-w-4xl space-y-4">
        {allocations.length === 0 && <p className="text-sm text-slate-500">No allocation cycles yet.</p>}
        {allocations.map((a) => (
          <div key={a.id} className={`${card} p-5`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-50 light:text-slate-900">{a.name}</p>
                <p className="text-sm text-slate-400 light:text-slate-500">
                  From <span className="font-mono">{a.sender.code}</span> {a.sender.name} to{" "}
                  {a.receivers.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ", "}
                      <span className="font-mono">{r.costCenter.code}</span> {r.costCenter.name} {r.percent}%
                    </span>
                  ))}
                </p>
              </div>
              <DeleteButton action={deleteAllocation.bind(null, a.id)} confirmMessage={`Delete ${a.name} and reverse all its runs?`} label="" />
            </div>
            <form action={runAllocation.bind(null, a.id)} className="mt-4 flex flex-wrap items-center gap-2">
              <select name="period" defaultValue={thisMonth} className={selectCls} aria-label="Month to allocate">
                {months.map((p) => (
                  <option key={periodKey(p)} value={periodKey(p)}>
                    {monthLabel(p)}
                  </option>
                ))}
              </select>
              <SubmitButton pendingText="Running...">Run allocation</SubmitButton>
            </form>
            {a.runs.length > 0 && (
              <ul className="mt-4 divide-y divide-white/[0.06] text-sm light:divide-slate-200">
                {a.runs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span className="text-slate-300 light:text-slate-600">
                      {monthLabel(r)}: <span className="font-mono">{money(r.amount)}</span> allocated
                    </span>
                    <form action={reverseAllocationRun.bind(null, r.id)}>
                      <SubmitButton variant="ghost" pendingText="Reversing...">
                        Reverse
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <form action={createAllocation} className={`${card} mt-6 max-w-4xl space-y-4 p-5`}>
        <p className="font-medium text-slate-50 light:text-slate-900">New allocation cycle</p>
        {centers.length < 2 ? (
          <p className="text-sm text-slate-500">You need at least two active cost centers.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="IT costs" required maxLength={100} />
              </div>
              <div>
                <Label htmlFor="senderId">Allocate from</Label>
                <Select id="senderId" name="senderId" defaultValue="" required>
                  <option value="" disabled>
                    Choose a cost center
                  </option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300 light:text-slate-700">Receivers and their share (must add up to 100%)</p>
              <div className="mt-2 space-y-2">
                {Array.from({ length: RECEIVER_ROWS }, (_, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <Select name={`receiver${i}`} defaultValue="" className="col-span-2" aria-label={`Receiver ${i + 1}`}>
                      <option value="">{i === 0 ? "Choose a cost center" : "None"}</option>
                      {centers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} {c.name}
                        </option>
                      ))}
                    </Select>
                    <Input name={`percent${i}`} type="number" min="0" max="100" step="0.01" placeholder="%" aria-label={`Share ${i + 1}`} />
                  </div>
                ))}
              </div>
            </div>
            <SubmitButton pendingText="Creating...">Create cycle</SubmitButton>
          </>
        )}
      </form>
    </div>
  );
}
