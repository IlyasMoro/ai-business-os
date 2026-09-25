import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Input, Label, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Badge } from "@/components/ui-dark/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { receivePurchaseOrder } from "@/lib/actions/lots";

export default async function ReceivePurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; why?: string }>;
}) {
  const { id } = await params;
  const { error, why } = await searchParams;
  const session = await verifySession();

  const po = await db.purchaseOrder.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true, sku: true, trackingMode: true, tracksExpiry: true } } } },
    },
  });
  if (!po) notFound();
  if (po.status === "RECEIVED" || po.status === "CANCELLED") redirect(`/dashboard/procurement/${po.id}`);

  const card = "rounded-2xl border border-white/[0.09] light:border-white/80 glass p-5";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Receive purchase order</h1>
        <p className="mt-1 text-slate-400 light:text-slate-500">
          From {po.supplier.name}. Stock for every line goes up; tracked lines also need their lot number or serials.
        </p>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {why && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{why}</p>}
        </div>

        <form action={receivePurchaseOrder.bind(null, po.id)} className="mt-4 space-y-4">
          {po.items.map((item) => {
            const p = item.product;
            return (
              <div key={item.id} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-50 light:text-slate-900">
                    {p.name} <span className="font-mono text-xs text-slate-500">{p.sku}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm tabular-nums text-slate-300">× {item.quantity}</span>
                    <Badge tone={p.trackingMode === "NONE" ? "slate" : p.trackingMode === "LOT" ? "blue" : "purple"}>
                      {p.trackingMode === "NONE" ? "Not tracked" : p.trackingMode === "LOT" ? "Lot" : "Serial"}
                    </Badge>
                  </div>
                </div>
                {p.trackingMode !== "NONE" && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {p.trackingMode === "LOT" ? (
                      <div>
                        <Label htmlFor={`lot_${item.id}`}>Lot number</Label>
                        <Input id={`lot_${item.id}`} name={`lot_${item.id}`} required maxLength={60} className="font-mono" />
                      </div>
                    ) : (
                      <div className="sm:col-span-2">
                        <Label htmlFor={`serials_${item.id}`}>Serial numbers, one per unit ({item.quantity})</Label>
                        <Textarea id={`serials_${item.id}`} name={`serials_${item.id}`} rows={Math.min(8, item.quantity + 1)} required className="font-mono text-xs" />
                      </div>
                    )}
                    {p.tracksExpiry && (
                      <div>
                        <Label htmlFor={`expiry_${item.id}`}>Expiry date</Label>
                        <Input id={`expiry_${item.id}`} name={`expiry_${item.id}`} type="date" required />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <SubmitButton pendingText="Receiving...">Receive into stock</SubmitButton>
        </form>

        <p className="mt-6">
          <Link href={`/dashboard/procurement/${po.id}`} className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to purchase order
          </Link>
        </p>
      </div>
    </div>
  );
}
