import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { hasRole, verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getBranchContext } from "@/lib/branches";
import { quantitiesAt } from "@/lib/stock";
import { canActOnTransfer, TRANSFER_TONE } from "@/lib/transfer-rules";
import {
  addTransferItem,
  cancelTransfer,
  receiveTransfer,
  removeTransferItem,
  sendTransfer,
} from "@/lib/actions/transfers";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { Input, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function TransferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; why?: string }>;
}) {
  const { id } = await params;
  const { error, why } = await searchParams;
  const session = await verifySession();
  const ctx = await getBranchContext();

  const transfer = await db.stockTransfer.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      fromBranch: { select: { name: true } },
      toBranch: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true, trackingMode: true } } },
        orderBy: { product: { name: "asc" } },
      },
    },
  });
  // Other branches' transfers look missing to a locked employee.
  if (!transfer || !canActOnTransfer(ctx.lockedBranchId, transfer, "view")) notFound();

  // Automation drafts need an owner or admin for anything but viewing and receiving.
  const isAdmin = hasRole(session, ["OWNER", "ADMIN"]);
  const can = (action: "edit" | "send" | "cancel" | "receive") =>
    canActOnTransfer(ctx.lockedBranchId, transfer, action) && (!transfer.autoCreated || action === "receive" || isAdmin);
  const awaitingApproval = transfer.autoCreated && transfer.status === "DRAFT";
  const isDraft = transfer.status === "DRAFT";

  const [products, lotMoves] = await Promise.all([
    isDraft && can("edit")
      ? db.product.findMany({
          where: { companyId: session.companyId },
          select: { id: true, name: true, sku: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    transfer.status === "DRAFT"
      ? Promise.resolve([])
      : db.lotMovement.findMany({
          where: { transferId: transfer.id, companyId: session.companyId, kind: "TRANSFER_OUT" },
          select: { id: true, quantity: true, lot: { select: { lotNumber: true, product: { select: { name: true } } } } },
          orderBy: { createdAt: "asc" },
        }),
  ]);
  // While drafting, show what the sending branch has so shortfalls show early.
  const atSource = isDraft
    ? await quantitiesAt(transfer.fromBranchId, [...new Set([...transfer.items.map((i) => i.productId), ...products.map((p) => p.id)])])
    : new Map<string, number>();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/transfers" label="Back to transfers" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold text-slate-50 light:text-slate-900">{transfer.transferNumber}</h1>
              <StatusBadge status={transfer.status} tone={TRANSFER_TONE[transfer.status]} />
            </div>
            <p className="mt-1 inline-flex items-center gap-1.5 text-slate-300 light:text-slate-600">
              {transfer.fromBranch.name}
              <ArrowRight className="h-4 w-4 text-slate-500" />
              {transfer.toBranch.name}
            </p>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Created {transfer.createdAt.toLocaleDateString()}
              {transfer.sentAt && <> · Sent {transfer.sentAt.toLocaleDateString()}</>}
              {transfer.receivedAt && <> · Received {transfer.receivedAt.toLocaleDateString()}</>}
            </p>
            {transfer.note && <p className="mt-2 text-sm text-slate-300 light:text-slate-600">{transfer.note}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDraft && can("send") && (
              <form action={sendTransfer.bind(null, transfer.id)}>
                <SubmitButton pendingText="Sending...">{transfer.autoCreated ? "Approve and send" : "Send"}</SubmitButton>
              </form>
            )}
            {transfer.status === "SENT" && can("receive") && (
              <form action={receiveTransfer.bind(null, transfer.id)}>
                <SubmitButton pendingText="Receiving...">Receive</SubmitButton>
              </form>
            )}
            {isDraft && can("cancel") && (
              <DeleteButton
                action={cancelTransfer.bind(null, transfer.id)}
                confirmMessage="Cancel this transfer? Nothing has moved yet."
                label="Cancel transfer"
              />
            )}
          </div>
        </div>

        <div className="mt-4">
          <ErrorBanner code={error} />
          {why && (
            <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{why}</p>
          )}
          {awaitingApproval && (
            <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 light:text-amber-800">
              Suggested by automation. Nothing moves until an owner or admin checks the lines and approves it
              {isAdmin ? " with Approve and send, or cancels it." : "."}
            </p>
          )}
          {transfer.status === "SENT" && (
            <p className="mb-4 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300 light:text-blue-700">
              In transit: this stock has left {transfer.fromBranch.name} and counts at neither branch until{" "}
              {transfer.toBranch.name} receives it.
            </p>
          )}
        </div>

        <Card className="mt-2">
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            {transfer.items.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">No products yet.</p>
            ) : (
              <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                {transfer.items.map((item) => {
                  const available = atSource.get(item.productId) ?? 0;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-50 light:text-slate-900">
                          {item.product.name} <span className="font-mono text-xs text-slate-500">{item.product.sku}</span>
                        </p>
                        {isDraft && (
                          <p className={`text-xs ${available < item.quantity ? "text-red-400" : "text-slate-500"}`}>
                            {available} at {transfer.fromBranch.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono tabular-nums text-slate-200 light:text-slate-700">{item.quantity}</span>
                        {isDraft && can("edit") && (
                          <DeleteButton
                            action={removeTransferItem.bind(null, transfer.id, item.id)}
                            confirmMessage="Remove this product?"
                            label=""
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {isDraft && can("edit") && (
              <form action={addTransferItem.bind(null, transfer.id)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="col-span-2">
                  <Select name="productId" defaultValue="" required aria-label="Product">
                    <option value="" disabled>
                      Select a product
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}), {atSource.get(p.id) ?? 0} at {transfer.fromBranch.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input name="quantity" type="number" min="1" step="1" defaultValue={1} required aria-label="Quantity" />
                <SubmitButton variant="secondary" pendingText="Adding...">
                  Add product
                </SubmitButton>
              </form>
            )}
          </CardContent>
        </Card>

        {lotMoves.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Lots and serials moved</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {lotMoves.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-300 light:text-slate-600">
                      {m.lot.product.name}{" "}
                      <Link
                        href={`/dashboard/inventory/trace?q=${encodeURIComponent(m.lot.lotNumber)}`}
                        className="font-mono text-slate-50 hover:text-blue-400 light:text-slate-900"
                      >
                        {m.lot.lotNumber}
                      </Link>
                    </span>
                    <span className="font-mono tabular-nums text-slate-300">{-m.quantity}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
