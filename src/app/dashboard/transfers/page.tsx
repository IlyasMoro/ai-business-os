import Link from "next/link";
import { ArrowRight, ArrowRightLeft, Plus } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getBranchContext } from "@/lib/branches";
import { Badge, StatusBadge } from "@/components/ui-dark/badge";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { buttonStyles } from "@/components/ui-dark/button";
import { TRANSFER_TONE } from "@/lib/transfer-rules";

export default async function TransfersPage() {
  const session = await verifySession();
  const ctx = await getBranchContext();

  // A locked employee sees their branch's transfers; others follow the
  // switcher. Either way a transfer shows when it leaves or arrives there.
  const branchId = ctx.viewBranchId;
  const transfers = await db.stockTransfer.findMany({
    where: {
      companyId: session.companyId,
      ...(branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}),
    },
    include: {
      fromBranch: { select: { name: true } },
      toBranch: { select: { name: true } },
      items: { select: { quantity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const inTransit = transfers.filter((t) => t.status === "SENT");
  const awaitingHere = branchId ? inTransit.filter((t) => t.toBranchId === branchId).length : inTransit.length;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Stock transfers</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Move stock between branches.{" "}
            {awaitingHere > 0 && (
              <span className="text-blue-300 light:text-blue-700">
                {awaitingHere} in transit{branchId ? ` to ${ctx.viewBranch?.name}` : ""}.
              </span>
            )}
          </p>
        </div>
        <Link href="/dashboard/transfers/new" className={buttonStyles("primary")}>
          <Plus className="h-4 w-4" />
          New transfer
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.09] glass light:border-white/80">
        {transfers.length === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title="No transfers yet"
            description="Send stock from one branch to another when one runs short and another has plenty."
            action={{ href: "/dashboard/transfers/new", label: "New transfer" }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                  <th className="px-5 py-3 font-medium">Transfer</th>
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium">Units</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/transfers/${t.id}`}
                        className="font-mono font-medium text-slate-50 hover:text-blue-400 light:text-slate-900"
                      >
                        {t.transferNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-300 light:text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        {t.fromBranch.name}
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                        {t.toBranch.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono tabular-nums text-slate-300 light:text-slate-600">
                      {t.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={t.status} tone={TRANSFER_TONE[t.status]} />
                        {t.autoCreated && t.status === "DRAFT" && <Badge tone="yellow">Needs approval</Badge>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 light:text-slate-500">{t.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
