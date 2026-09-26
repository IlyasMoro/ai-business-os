"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { getBranchContext } from "@/lib/branches";
import { changeStock, quantitiesAt } from "@/lib/stock";
import { describeShortfalls, findBranchShortfalls } from "@/lib/stock-levels";
import { getInventorySettings, LotShortageError, putIntoLot, takeFromLots } from "@/lib/lots";
import {
  canActOnTransfer,
  canTransitionTransfer,
  formatTransferNumber,
  nextTransferSequence,
  planLotArrivals,
  transferRouteError,
  type TransferAction,
} from "@/lib/transfer-rules";

const BASE = "/dashboard/transfers";

function fail(back: string, message: string): never {
  redirect(`${back}?why=${encodeURIComponent(message)}`);
}

/** Thrown inside a transaction when a branch would go below zero. */
class BranchWentNegative extends Error {}

/**
 * Loads a transfer the user may act on, or sends them away. Other
 * branches' transfers look missing to a locked employee.
 */
async function loadTransfer(transferId: string, action: TransferAction) {
  const session = await verifySession();
  const ctx = await getBranchContext();
  const transfer = await db.stockTransfer.findUnique({
    where: { id: transferId, companyId: session.companyId },
    include: {
      fromBranch: { select: { name: true } },
      items: { include: { product: { select: { id: true, name: true, stockQty: true, trackingMode: true } } } },
    },
  });
  if (!transfer || !canActOnTransfer(ctx.lockedBranchId, transfer, "view")) redirect(BASE);
  const back = `${BASE}/${transfer.id}`;
  if (!canActOnTransfer(ctx.lockedBranchId, transfer, action)) redirect(`${back}?error=forbidden`);
  return { session, ctx, transfer, back };
}

const CreateSchema = z.object({
  fromBranchId: z.string().min(1),
  toBranchId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export async function createTransfer(formData: FormData) {
  const session = await verifySession();
  const ctx = await getBranchContext();
  const parsed = CreateSchema.safeParse({
    fromBranchId: formData.get("fromBranchId"),
    toBranchId: formData.get("toBranchId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect(`${BASE}/new?error=invalid`);

  // A locked employee can only send from their own branch.
  const fromBranchId = ctx.lockedBranchId ?? parsed.data.fromBranchId;
  const { toBranchId, note } = parsed.data;
  const routeError = transferRouteError(
    fromBranchId,
    toBranchId,
    ctx.branches.filter((b) => b.active).map((b) => b.id)
  );
  if (routeError) redirect(`${BASE}/new?error=${routeError}`);

  const existing = await db.stockTransfer.findMany({
    where: { companyId: session.companyId },
    select: { transferNumber: true },
  });
  const transfer = await db.stockTransfer.create({
    data: {
      transferNumber: formatTransferNumber(nextTransferSequence(existing.map((t) => t.transferNumber))),
      fromBranchId,
      toBranchId,
      note: note || null,
      companyId: session.companyId,
    },
  });
  await logAudit(session.companyId, session.userId, "transfer.created", "StockTransfer", transfer.id, {
    from: fromBranchId,
    to: toBranchId,
  });
  revalidatePath(BASE);
  redirect(`${BASE}/${transfer.id}`);
}

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
});

/** Adds a line, or tops up the line already there for that product. */
export async function addTransferItem(transferId: string, formData: FormData) {
  const { session, transfer, back } = await loadTransfer(transferId, "edit");
  if (transfer.status !== "DRAFT") redirect(`${back}?error=transfer-locked`);
  const parsed = ItemSchema.safeParse({ productId: formData.get("productId"), quantity: formData.get("quantity") });
  if (!parsed.success) redirect(`${back}?error=invalid`);

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId, companyId: session.companyId },
    select: { id: true },
  });
  if (!product) redirect(`${back}?error=invalid`);

  await db.stockTransferItem.upsert({
    where: { transferId_productId: { transferId: transfer.id, productId: product.id } },
    create: { transferId: transfer.id, productId: product.id, quantity: parsed.data.quantity },
    update: { quantity: { increment: parsed.data.quantity } },
  });
  revalidatePath(back);
}

export async function removeTransferItem(transferId: string, itemId: string) {
  const { transfer, back } = await loadTransfer(transferId, "edit");
  if (transfer.status !== "DRAFT") redirect(`${back}?error=transfer-locked`);
  await db.stockTransferItem.deleteMany({ where: { id: itemId, transferId: transfer.id } });
  revalidatePath(back);
}

/**
 * Sends the goods: they leave the source branch (and, when tracked, the
 * lots picked by the company's rule) and are in transit until received.
 * All or nothing; the source branch can never go below zero.
 */
export async function sendTransfer(transferId: string) {
  const { session, transfer, back } = await loadTransfer(transferId, "send");
  if (!canTransitionTransfer(transfer.status, "SENT")) redirect(`${back}?error=transfer-locked`);
  if (transfer.items.length === 0) redirect(`${back}?error=transfer-empty`);

  const atSource = await quantitiesAt(transfer.fromBranchId, transfer.items.map((i) => i.productId));
  const shortfalls = findBranchShortfalls(
    transfer.items.map((i) => ({
      productId: i.productId,
      productName: i.product.name,
      quantity: i.quantity,
      branchQty: atSource.get(i.productId) ?? 0,
      totalQty: i.product.stockQty,
    }))
  );
  if (shortfalls.length > 0) {
    fail(back, `Not enough stock to send: ${describeShortfalls(shortfalls, transfer.fromBranch.name)}.`);
  }

  const settings = await getInventorySettings(session.companyId);
  try {
    await db.$transaction(async (tx) => {
      for (const item of transfer.items) {
        await changeStock(tx, {
          companyId: session.companyId,
          branchId: transfer.fromBranchId,
          productId: item.productId,
          delta: -item.quantity,
        });
        // Re-check inside the transaction in case a sale got there first.
        const left = await tx.branchStock.findUnique({
          where: { branchId_productId: { branchId: transfer.fromBranchId, productId: item.productId } },
          select: { quantity: true },
        });
        if ((left?.quantity ?? 0) < 0) throw new BranchWentNegative(item.product.name);
        if (item.product.trackingMode !== "NONE") {
          await takeFromLots(tx, {
            companyId: session.companyId,
            branchId: transfer.fromBranchId,
            productId: item.productId,
            productName: item.product.name,
            quantity: item.quantity,
            kind: "TRANSFER_OUT",
            settings,
            links: { transferId: transfer.id },
          });
        }
      }
      // Only a draft can be sent: a double click can't send twice.
      const updated = await tx.stockTransfer.updateMany({
        where: { id: transfer.id, status: "DRAFT" },
        data: { status: "SENT", sentAt: new Date() },
      });
      if (updated.count !== 1) throw new BranchWentNegative("state");
    });
  } catch (e) {
    if (e instanceof LotShortageError) fail(back, `Can't send: ${e.message}`);
    if (e instanceof BranchWentNegative) redirect(`${back}?error=transfer-changed`);
    throw e;
  }

  await logAudit(session.companyId, session.userId, "transfer.sent", "StockTransfer", transfer.id, {
    lines: transfer.items.length,
  });
  revalidatePath(back);
  revalidatePath(BASE);
  revalidatePath("/dashboard/inventory");
}

/**
 * Receives the goods at the destination. Tracked products arrive in the
 * same lots (same numbers, expiry and receipt date) they left from.
 */
export async function receiveTransfer(transferId: string) {
  const { session, transfer, back } = await loadTransfer(transferId, "receive");
  if (!canTransitionTransfer(transfer.status, "RECEIVED")) redirect(`${back}?error=transfer-locked`);

  const outs = await db.lotMovement.findMany({
    where: { transferId: transfer.id, companyId: session.companyId, kind: "TRANSFER_OUT" },
    select: {
      quantity: true,
      lot: { select: { productId: true, lotNumber: true, expiresAt: true, receivedAt: true, source: true } },
    },
  });
  const arrivals = planLotArrivals(outs.map((o) => ({ ...o.lot, quantity: o.quantity })));

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.stockTransfer.updateMany({
        where: { id: transfer.id, status: "SENT" },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
      if (updated.count !== 1) throw new BranchWentNegative("state");
      for (const item of transfer.items) {
        await changeStock(tx, {
          companyId: session.companyId,
          branchId: transfer.toBranchId,
          productId: item.productId,
          delta: item.quantity,
        });
      }
      for (const lot of arrivals) {
        await putIntoLot(tx, {
          companyId: session.companyId,
          branchId: transfer.toBranchId,
          productId: lot.productId,
          lotNumber: lot.lotNumber,
          quantity: lot.quantity,
          expiresAt: lot.expiresAt,
          receivedAt: lot.receivedAt,
          source: lot.source,
          kind: "TRANSFER_IN",
          links: { transferId: transfer.id },
        });
      }
    });
  } catch (e) {
    if (e instanceof BranchWentNegative) redirect(`${back}?error=transfer-changed`);
    throw e;
  }

  await logAudit(session.companyId, session.userId, "transfer.received", "StockTransfer", transfer.id, {
    lines: transfer.items.length,
  });
  revalidatePath(back);
  revalidatePath(BASE);
  revalidatePath("/dashboard/inventory");
}

/** Only a draft can be cancelled: nothing has moved yet. */
export async function cancelTransfer(transferId: string) {
  const { session, transfer, back } = await loadTransfer(transferId, "cancel");
  if (!canTransitionTransfer(transfer.status, "CANCELLED")) redirect(`${back}?error=transfer-locked`);
  await db.stockTransfer.updateMany({ where: { id: transfer.id, status: "DRAFT" }, data: { status: "CANCELLED" } });
  await logAudit(session.companyId, session.userId, "transfer.cancelled", "StockTransfer", transfer.id, {});
  revalidatePath(back);
  revalidatePath(BASE);
}
