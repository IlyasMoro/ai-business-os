import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ensureMainBranch } from "@/lib/branches";
import { Badge } from "@/components/ui-dark/badge";
import { Button } from "@/components/ui-dark/button";
import { Input, Label } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { createBranch, makeMainBranch, setBranchActive, updateBranch } from "@/lib/actions/branches";

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;
  await ensureMainBranch(session.companyId);

  const branches = await db.branch.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ isMain: "desc" }, { active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { orders: true, invoices: true, purchaseOrders: true, employees: true, users: true } },
    },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Branches</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-400 light:text-slate-500">
        Each shop, office, warehouse or site your business runs. Orders, invoices, purchase orders and employees
        belong to a branch, and staff can be limited to their own branch on the Team page.
      </p>

      <div className="mt-4 space-y-2">
        <ErrorBanner code={error} />
        {saved && (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400 light:text-emerald-700">
            Saved.
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {branches.map((b) => {
          const records = b._count.orders + b._count.invoices + b._count.purchaseOrders;
          return (
            <details key={b.id} className="group rounded-2xl border border-white/[0.09] glass light:border-white/80">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-xs text-slate-400">{b.code}</span>
                <span className="font-medium text-slate-50 light:text-slate-900">{b.name}</span>
                {b.isMain && <Badge tone="blue">Main</Badge>}
                {!b.active && <Badge tone="slate">Inactive</Badge>}
                <span className="ml-auto text-xs text-slate-500">
                  {records} records · {b._count.employees} employees · {b._count.users} limited users
                </span>
              </summary>

              <div className="border-t border-white/[0.06] px-5 py-4 light:border-slate-200">
                <form action={updateBranch.bind(null, b.id)} className="grid gap-4 sm:grid-cols-6">
                  <div className="sm:col-span-1">
                    <Label htmlFor={`code-${b.id}`}>Code</Label>
                    <Input id={`code-${b.id}`} name="code" defaultValue={b.code} maxLength={12} required className="font-mono uppercase" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`name-${b.id}`}>Name</Label>
                    <Input id={`name-${b.id}`} name="name" defaultValue={b.name} maxLength={100} required />
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor={`address-${b.id}`}>Address (optional)</Label>
                    <Input id={`address-${b.id}`} name="address" defaultValue={b.address ?? ""} maxLength={300} />
                  </div>
                  <div className="sm:col-span-6">
                    <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4 light:border-slate-200">
                  {!b.isMain && b.active && (
                    <form action={makeMainBranch.bind(null, b.id)}>
                      <Button type="submit" variant="secondary" size="sm">Make main branch</Button>
                    </form>
                  )}
                  {!b.isMain && (
                    <form action={setBranchActive.bind(null, b.id, !b.active)}>
                      <Button type="submit" variant={b.active ? "ghost" : "secondary"} size="sm">
                        {b.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </form>
                  )}
                  {b.isMain && (
                    <p className="text-xs text-slate-500">
                      The main branch is used for records created automatically, such as reorders and EDI orders.
                    </p>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <form action={createBranch} className="mt-6 max-w-3xl space-y-4 rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
        <p className="font-medium text-slate-50 light:text-slate-900">New branch</p>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-1">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" placeholder="CPT" maxLength={12} required className="font-mono uppercase" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Cape Town" maxLength={100} required />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" name="address" maxLength={300} />
          </div>
        </div>
        <SubmitButton pendingText="Creating...">Create branch</SubmitButton>
      </form>
    </div>
  );
}
