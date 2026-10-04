import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/branches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { Input, Label, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { BackButton } from "@/components/ui-dark/back-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { updateSupplier } from "@/lib/actions/procurement";
import { PO_STATUS_LABEL } from "@/lib/po-rules";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Supplier" };

const statusTone = { DRAFT: "slate", ORDERED: "blue", RECEIVED: "green", CANCELLED: "red" } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/** One supplier: their details, what's been spent with them, how reliably
 * they deliver, and every purchase order. */
export default async function SupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const session = await verifySession();

  const supplier = await db.supplier.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true, name: true, email: true, phone: true, notes: true },
  });
  if (!supplier) notFound();

  const orders = await db.purchaseOrder.findMany({
    where: { supplierId: supplier.id, companyId: session.companyId, ...(await branchWhere()) },
    orderBy: { createdAt: "desc" },
    select: { id: true, poNumber: true, status: true, totalAmount: true, createdAt: true, expectedDate: true, receivedAt: true },
  });

  const received = orders.filter((o) => o.status === "RECEIVED" && o.receivedAt);
  const spent = received.reduce((s, o) => s + o.totalAmount, 0);
  const onOrder = orders.filter((o) => o.status === "ORDERED").reduce((s, o) => s + o.totalAmount, 0);
  const leadTimes = received.map((o) => Math.max(0, (o.receivedAt!.getTime() - o.createdAt.getTime()) / DAY_MS));
  const avgLead = leadTimes.length ? leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length : null;
  const withExpected = received.filter((o) => o.expectedDate);
  const onTime = withExpected.length ? (withExpected.filter((o) => o.receivedAt! <= o.expectedDate!).length / withExpected.length) * 100 : null;

  const stat = (label: string, value: string) => (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-50 light:text-slate-900">{value}</p>
    </div>
  );

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <BackButton href="/dashboard/procurement/suppliers" label="Back to suppliers" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{supplier.name}</h1>
        <div className="mt-4">
          <ErrorBanner code={error} />
          {saved && <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">Saved.</p>}
        </div>

        <Card className="mt-2">
          <CardContent className="grid grid-cols-2 gap-4 pt-5 text-sm sm:grid-cols-4">
            {stat("Spent (received)", formatCurrency(spent))}
            {stat("On order", formatCurrency(onOrder))}
            {stat("Average lead time", avgLead === null ? "n/a" : `${avgLead.toFixed(1)} days`)}
            {stat("Delivered on time", onTime === null ? "n/a" : `${Math.round(onTime)}%`)}
          </CardContent>
        </Card>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateSupplier.bind(null, supplier.id)} className="space-y-3">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required defaultValue={supplier.name} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={supplier.email ?? ""} />
                    <p className="mt-1 text-xs text-slate-500">Purchase orders are emailed here.</p>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" defaultValue={supplier.phone ?? ""} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" rows={3} defaultValue={supplier.notes ?? ""} />
                </div>
                <SubmitButton pendingText="Saving...">Save supplier</SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-slate-500">No purchase orders with this supplier yet.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06] text-sm light:divide-slate-200">
                  {orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <Link href={`/dashboard/procurement/${o.id}`} className="font-mono font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                          {o.poNumber}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {o.createdAt.toLocaleDateString()}
                          {o.receivedAt ? ` · received ${o.receivedAt.toLocaleDateString()}` : o.expectedDate ? ` · expected ${o.expectedDate.toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums text-slate-300 light:text-slate-600">{formatCurrency(o.totalAmount)}</span>
                        <StatusBadge status={PO_STATUS_LABEL[o.status]} tone={statusTone[o.status]} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
