import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { deleteWorkOrder, updateWorkOrderStatus } from "@/lib/actions/mrp";
import { explodeBom, nextWorkOrderStatuses, type WorkOrderStatus } from "@/lib/mrp-math";

const statusTone = {
  PLANNED: "slate",
  IN_PROGRESS: "yellow",
  COMPLETED: "green",
  CANCELLED: "red",
} as const;

const actionLabel: Record<WorkOrderStatus, { text: string; pending: string; variant: "primary" | "secondary" | "danger" }> = {
  PLANNED: { text: "Reopen", pending: "Saving...", variant: "secondary" },
  IN_PROGRESS: { text: "Start", pending: "Starting...", variant: "primary" },
  COMPLETED: { text: "Complete", pending: "Completing...", variant: "primary" },
  CANCELLED: { text: "Cancel", pending: "Cancelling...", variant: "danger" },
};

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const wo = await db.workOrder.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          stockQty: true,
          bomComponents: {
            include: { component: { select: { id: true, name: true, sku: true, stockQty: true, cost: true } } },
            orderBy: { component: { name: "asc" } },
          },
        },
      },
    },
  });
  if (!wo) notFound();

  const lines = wo.product.bomComponents;
  const requirements = explodeBom(lines, wo.quantity).map((req) => {
    const line = lines.find((l) => l.componentId === req.componentId)!;
    return { ...req, line, short: Math.max(0, req.required - line.component.stockQty) };
  });
  const isOpen = wo.status === "PLANNED" || wo.status === "IN_PROGRESS";
  const anyShort = isOpen && requirements.some((r) => r.short > 0);
  const materialCost = requirements.reduce((sum, r) => sum + r.required * r.line.component.cost, 0);
  const action = updateWorkOrderStatus.bind(null, wo.id);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold text-slate-50 light:text-slate-900">{wo.woNumber}</h1>
              <StatusBadge status={wo.status} tone={statusTone[wo.status]} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              Make {wo.quantity} ×{" "}
              <Link href={`/dashboard/inventory/${wo.product.id}`} className="text-blue-400 hover:text-blue-300">
                {wo.product.name}
              </Link>
              {wo.dueDate && <> · Due {wo.dueDate.toLocaleDateString()}</>}
              {wo.startedAt && <> · Started {wo.startedAt.toLocaleDateString()}</>}
              {wo.completedAt && <> · Completed {wo.completedAt.toLocaleDateString()}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextWorkOrderStatuses(wo.status).map((target) => (
              <form key={target} action={action}>
                <input type="hidden" name="status" value={target} />
                <SubmitButton variant={actionLabel[target].variant} pendingText={actionLabel[target].pending}>
                  {actionLabel[target].text}
                </SubmitButton>
              </form>
            ))}
            {wo.status !== "COMPLETED" && (
              <DeleteButton action={deleteWorkOrder.bind(null, wo.id)} confirmMessage="Delete this work order?" />
            )}
          </div>
        </div>

        <div className="mt-4">
          <ErrorBanner code={error} />
        </div>

        <Card className="mt-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Components needed</CardTitle>
            {isOpen && (
              <span className={`text-sm ${anyShort ? "text-red-400" : "text-emerald-400"}`}>
                {anyShort ? "Some components are short" : "All components in stock"}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {requirements.length === 0 ? (
              <p className="text-sm text-slate-500">This product has no bill of materials anymore.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 font-medium">Component</th>
                    <th className="py-2 text-right font-medium">Per unit</th>
                    <th className="py-2 text-right font-medium">Needed</th>
                    <th className="py-2 text-right font-medium">In stock</th>
                    {isOpen && <th className="py-2 text-right font-medium">Short</th>}
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {requirements.map((r) => (
                    <tr key={r.componentId} className="border-t border-white/[0.04] light:border-slate-100">
                      <td className="py-2 font-sans">
                        <Link href={`/dashboard/inventory/${r.line.component.id}`} className="text-slate-50 light:text-slate-900 hover:text-blue-400">
                          {r.line.component.name}
                        </Link>
                      </td>
                      <td className="py-2 text-right text-slate-400">{r.line.quantity}</td>
                      <td className="py-2 text-right text-slate-300 light:text-slate-600">{r.required}</td>
                      <td className="py-2 text-right text-slate-300 light:text-slate-600">{r.line.component.stockQty}</td>
                      {isOpen && (
                        <td className={`py-2 text-right font-semibold ${r.short > 0 ? "text-red-400" : "text-slate-600"}`}>
                          {r.short}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-4 text-right font-mono text-sm tabular-nums text-slate-400 light:text-slate-500">
              Material cost: <span className="font-semibold text-amber-400">${materialCost.toFixed(2)}</span>
            </p>
            {wo.status === "COMPLETED" && (
              <p className="mt-2 text-xs text-slate-500">
                Components were taken from stock and {wo.quantity} × {wo.product.name} were added when this work order
                completed.
              </p>
            )}
          </CardContent>
        </Card>

        {wo.notes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-slate-300 light:text-slate-600">{wo.notes}</p>
            </CardContent>
          </Card>
        )}

        <p className="mt-6">
          <Link href="/dashboard/mrp/work-orders" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to work orders
          </Link>
        </p>
      </div>
    </div>
  );
}
