import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui-dark/badge";
import { getInventorySettings } from "@/lib/lots";
import { expiryWarningCutoff, isExpired, isExpiringSoon } from "@/lib/lot-math";
import { Search } from "lucide-react";
import { fieldStyles } from "@/components/ui-dark/input";

const KIND_LABEL = {
  RECEIPT: "Received",
  SALE: "Shipped",
  CONSUMPTION: "Used in production",
  PRODUCTION: "Built",
  RETURN: "Returned",
  OPENING: "Opening stock",
  TRANSFER_OUT: "Sent",
  TRANSFER_IN: "Arrived",
} as const;

export default async function LotTracePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await verifySession();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const inventory = await getInventorySettings(session.companyId);
  const card = "rounded-2xl border border-white/[0.09] light:border-white/80 glass";

  const lots = query
    ? await db.stockLot.findMany({
        where: { companyId: session.companyId, lotNumber: { contains: query, mode: "insensitive" } },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          branch: { select: { name: true } },
          movements: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { receivedAt: "desc" },
        take: 25,
      })
    : [];

  // Resolve every linked record in one go for readable movement lines.
  const ids = (key: "orderId" | "purchaseOrderId" | "workOrderId" | "returnId") => [
    ...new Set(lots.flatMap((l) => [...l.movements.map((m) => m[key]), key === "purchaseOrderId" ? l.purchaseOrderId : key === "workOrderId" ? l.workOrderId : null]).filter((x): x is string => !!x)),
  ];
  const transferIds = [...new Set(lots.flatMap((l) => l.movements.map((m) => m.transferId)).filter((x): x is string => !!x))];
  const [orders, pos, wos, rmas, transfers] = await Promise.all([
    db.order.findMany({ where: { id: { in: ids("orderId") }, companyId: session.companyId }, select: { id: true, customerPoNumber: true, customer: { select: { id: true, name: true } } } }),
    db.purchaseOrder.findMany({ where: { id: { in: ids("purchaseOrderId") }, companyId: session.companyId }, select: { id: true, supplier: { select: { name: true } } } }),
    db.workOrder.findMany({ where: { id: { in: ids("workOrderId") }, companyId: session.companyId }, select: { id: true, woNumber: true } }),
    db.returnAuthorization.findMany({ where: { id: { in: ids("returnId") }, companyId: session.companyId }, select: { id: true, rmaNumber: true } }),
    db.stockTransfer.findMany({
      where: { id: { in: transferIds }, companyId: session.companyId },
      select: { id: true, transferNumber: true, fromBranch: { select: { name: true } }, toBranch: { select: { name: true } } },
    }),
  ]);
  const transferMap = new Map(transfers.map((t) => [t.id, t]));
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const poMap = new Map(pos.map((p) => [p.id, p]));
  const woMap = new Map(wos.map((w) => [w.id, w]));
  const rmaMap = new Map(rmas.map((r) => [r.id, r]));

  const warnCutoff = expiryWarningCutoff(inventory.expiryWarningDays);
  const expiring = query
    ? []
    : await db.stockLot.findMany({
        where: { companyId: session.companyId, quantity: { gt: 0 }, expiresAt: { not: null, lte: warnCutoff } },
        include: { product: { select: { id: true, name: true } } },
        orderBy: { expiresAt: "asc" },
        take: 50,
      });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Lot trace</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Find a lot or serial number to see where it came from and which customers received it.
      </p>

      <form method="GET" className="relative mt-4 max-w-md">
        <Search className="pointer-events-none absolute z-10 left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Lot or serial number..."
          className={fieldStyles("pl-9 font-mono")}
        />
      </form>

      {query && lots.length === 0 && <p className="mt-6 text-sm text-slate-500">No lot or serial matches &quot;{query}&quot;.</p>}

      <div className="mt-6 max-w-4xl space-y-4">
        {lots.map((lot) => {
          const customers = new Map<string, string>();
          for (const m of lot.movements) {
            const o = m.kind === "SALE" && m.orderId ? orderMap.get(m.orderId) : undefined;
            if (o) customers.set(o.customer.id, o.customer.name);
          }
          return (
            <div key={lot.id} className={`${card} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-semibold text-slate-50 light:text-slate-900">
                    {lot.lotNumber} <span className="font-sans text-sm font-normal text-slate-400">at {lot.branch.name}</span>
                  </p>
                  <Link href={`/dashboard/inventory/${lot.product.id}`} className="text-sm text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                    {lot.product.name} ({lot.product.sku})
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  {lot.expiresAt && <span className="text-xs text-slate-400">Expires {lot.expiresAt.toLocaleDateString()}</span>}
                  {isExpired(lot) && <Badge tone="red">Expired</Badge>}
                  <Badge tone={lot.quantity > 0 ? "green" : "slate"}>{lot.quantity > 0 ? `${lot.quantity} on hand` : "None left"}</Badge>
                </div>
              </div>

              {customers.size > 0 && (
                <p className="mt-3 text-sm text-slate-300 light:text-slate-600">
                  Customers who received it:{" "}
                  {[...customers].map(([id, name], i) => (
                    <span key={id}>
                      {i > 0 && ", "}
                      <Link href={`/dashboard/crm/${id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                        {name}
                      </Link>
                    </span>
                  ))}
                </p>
              )}

              <ol className="mt-4 space-y-1 border-l border-white/[0.08] pl-4 text-sm light:border-slate-200">
                {lot.movements.map((m) => {
                  const o = m.orderId ? orderMap.get(m.orderId) : undefined;
                  const po = m.purchaseOrderId ? poMap.get(m.purchaseOrderId) : undefined;
                  const wo = m.workOrderId ? woMap.get(m.workOrderId) : undefined;
                  const rma = m.returnId ? rmaMap.get(m.returnId) : undefined;
                  const tr = m.transferId ? transferMap.get(m.transferId) : undefined;
                  return (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-300 light:text-slate-600">
                        <span className="text-slate-500">{m.createdAt.toLocaleDateString()}</span> {KIND_LABEL[m.kind]}
                        {tr && (
                          <>
                            {m.kind === "TRANSFER_OUT" ? ` to ${tr.toBranch.name} on ` : ` from ${tr.fromBranch.name} on `}
                            <Link href={`/dashboard/transfers/${tr.id}`} className="font-mono text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                              {tr.transferNumber}
                            </Link>
                          </>
                        )}
                        {po && (
                          <>
                            {" from "}
                            <Link href={`/dashboard/procurement/${po.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                              {po.supplier.name}
                            </Link>
                          </>
                        )}
                        {wo && (
                          <>
                            {" on "}
                            <Link href={`/dashboard/mrp/work-orders/${wo.id}`} className="font-mono text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                              {wo.woNumber}
                            </Link>
                          </>
                        )}
                        {o && !rma && (
                          <>
                            {" to "}
                            <Link href={`/dashboard/sales/${o.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                              {o.customer.name}
                              {o.customerPoNumber ? ` (PO ${o.customerPoNumber})` : ""}
                            </Link>
                          </>
                        )}
                        {rma && (
                          <>
                            {" on "}
                            <Link href={`/dashboard/returns/${rma.id}`} className="font-mono text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                              {rma.rmaNumber}
                            </Link>
                          </>
                        )}
                      </span>
                      <span className={`font-mono tabular-nums ${m.quantity < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {m.quantity > 0 ? "+" : "−"}
                        {Math.abs(m.quantity)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>

      {!query && (
        <div className={`${card} mt-2 max-w-4xl overflow-x-auto`}>
          <h2 className="px-5 pt-4 text-sm font-semibold text-slate-50 light:text-slate-900">
            Expired or expiring within {inventory.expiryWarningDays} days
          </h2>
          {expiring.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Nothing on hand is expired or close to expiry.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {expiring.map((lot) => (
                  <tr key={lot.id} className="border-t border-white/[0.04] light:border-slate-100">
                    <td className="px-5 py-2">
                      <Link href={`/dashboard/inventory/trace?q=${encodeURIComponent(lot.lotNumber)}`} className="font-mono text-slate-50 hover:text-blue-400 light:text-slate-900">
                        {lot.lotNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-2 text-slate-400">{lot.product.name}</td>
                    <td className="px-5 py-2 text-slate-400">{lot.expiresAt!.toLocaleDateString()}</td>
                    <td className="px-5 py-2">
                      {isExpired(lot) ? <Badge tone="red">Expired</Badge> : isExpiringSoon(lot, inventory.expiryWarningDays) ? <Badge tone="yellow">Expires soon</Badge> : null}
                    </td>
                    <td className="px-5 py-2 text-right font-mono tabular-nums text-slate-300">{lot.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
