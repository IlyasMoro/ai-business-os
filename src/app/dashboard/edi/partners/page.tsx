import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { Badge } from "@/components/ui-dark/badge";
import { createEdiPartner, deleteEdiPartner, updateEdiPartnerFlags } from "@/lib/actions/edi";

const FLAGS = [
  { name: "receive850", label: "Receives their 850 orders" },
  { name: "send810", label: "Send them 810 invoices" },
  { name: "send856", label: "Send them 856 ship notices" },
  { name: "send850", label: "Send them 850 orders" },
  { name: "useEdiPrices", label: "Accept their prices" },
] as const;

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300 light:text-slate-600">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-blue-500" />
      {label}
    </label>
  );
}

export default async function EdiPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;

  const [partners, customers, suppliers] = await Promise.all([
    db.ediPartner.findMany({
      where: { companyId: session.companyId },
      include: { customer: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    db.customer.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const card = "rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Trading partners</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Customers and suppliers you exchange EDI files with, and which documents go each way.
      </p>

      <div className="mt-4 max-w-3xl space-y-3">
        <ErrorBanner code={error} />
        {saved && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</div>
        )}
      </div>

      <div className="mt-4 max-w-3xl space-y-4">
        {partners.length === 0 && <p className="text-sm text-slate-500">No trading partners yet. Add the first one below.</p>}
        {partners.map((p) => (
          <div key={p.id} className={card}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-medium text-slate-50 light:text-slate-900">
                  {p.name}
                  {!p.enabled && <Badge tone="slate">Off</Badge>}
                </p>
                <p className="font-mono text-xs text-slate-500">
                  ISA {p.isaQualifier}:{p.isaId} · GS {p.gsId}
                </p>
                <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                  {p.customer && (
                    <>
                      Customer{" "}
                      <Link href={`/dashboard/crm/${p.customer.id}`} className="text-blue-400 hover:text-blue-300">
                        {p.customer.name}
                      </Link>
                    </>
                  )}
                  {p.customer && p.supplier && " · "}
                  {p.supplier && <>Supplier {p.supplier.name}</>}
                </p>
              </div>
              <DeleteButton action={deleteEdiPartner.bind(null, p.id)} confirmMessage={`Remove ${p.name}?`} label="" />
            </div>
            <form action={updateEdiPartnerFlags.bind(null, p.id)} className="mt-4 grid gap-2 sm:grid-cols-2">
              <Check name="enabled" label="Partner is active" defaultChecked={p.enabled} />
              {FLAGS.map((f) => (
                <Check key={f.name} name={f.name} label={f.label} defaultChecked={p[f.name]} />
              ))}
              <div className="sm:col-span-2">
                <SubmitButton variant="secondary" pendingText="Saving...">
                  Save
                </SubmitButton>
              </div>
            </form>
          </div>
        ))}
      </div>

      <form action={createEdiPartner} className={`mt-6 max-w-3xl space-y-4 ${card}`}>
        <p className="font-medium text-slate-50 light:text-slate-900">Add a trading partner</p>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={200} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="isaQualifier">ISA qualifier</Label>
            <Input id="isaQualifier" name="isaQualifier" defaultValue="ZZ" maxLength={2} required />
          </div>
          <div>
            <Label htmlFor="isaId">ISA ID</Label>
            <Input id="isaId" name="isaId" maxLength={15} required />
          </div>
          <div>
            <Label htmlFor="gsId">GS ID</Label>
            <Input id="gsId" name="gsId" maxLength={15} required />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="customerId">Customer (they send you orders)</Label>
            <Select id="customerId" name="customerId" defaultValue="">
              <option value="">None</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="supplierId">Supplier (you send them orders)</Label>
            <Select id="supplierId" name="supplierId" defaultValue="">
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FLAGS.map((f) => (
            <Check key={f.name} name={f.name} label={f.label} defaultChecked />
          ))}
        </div>
        <SubmitButton pendingText="Adding...">Add partner</SubmitButton>
      </form>

      <p className="mt-6">
        <Link href="/dashboard/edi" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
          ← Back to EDI
        </Link>
      </p>
    </div>
  );
}
