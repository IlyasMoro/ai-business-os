import "server-only";
import { db } from "@/lib/db";
import { ensureMainBranch } from "@/lib/branches";
import { lowStockRows, type BranchStockRow } from "@/lib/stock-levels";
import { roundQty } from "@/lib/quantity";
import type { StockAdjustmentReason, StockMovementKind } from "@/generated/prisma/client";

/* Stock per branch. Product.stockQty is the company total and must always
   equal the sum of the product's BranchStock rows, so every change to
   stock goes through changeStock or setStockAt, never straight to
   product.stockQty. Every change also writes a StockMovement row, so a
   product's history explains its stock; `movement` is required for that. */

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export type StockMovementInfo = {
  kind: StockMovementKind;
  /** Who did it; leave out for automatic changes. */
  userId?: string | null;
  reason?: StockAdjustmentReason;
  note?: string;
  links?: { orderId?: string; purchaseOrderId?: string; transferId?: string; returnId?: string; workOrderId?: string };
};

/** Adds `delta` (negative to take) at one branch and to the company total,
 * and records the movement. */
export async function changeStock(
  tx: Tx,
  opts: { companyId: string; branchId: string; productId: string; delta: number; movement: StockMovementInfo }
) {
  const delta = roundQty(opts.delta);
  if (delta === 0) return;
  const row = await tx.branchStock.upsert({
    where: { branchId_productId: { branchId: opts.branchId, productId: opts.productId } },
    create: { companyId: opts.companyId, branchId: opts.branchId, productId: opts.productId, quantity: delta },
    update: { quantity: { increment: delta } },
    select: { id: true, quantity: true },
  });
  const product = await tx.product.update({
    where: { id: opts.productId },
    data: { stockQty: { increment: delta } },
    select: { stockQty: true },
  });
  // Weighed stock is a float: snap both totals back to 3 decimals so float
  // noise (1.35 + 0.1 = 1.4500000000000002) never builds up. Safe inside the
  // transaction: the increments above hold both rows locked until commit.
  const branchQty = roundQty(row.quantity);
  if (branchQty !== row.quantity) await tx.branchStock.update({ where: { id: row.id }, data: { quantity: branchQty } });
  const totalQty = roundQty(product.stockQty);
  if (totalQty !== product.stockQty) await tx.product.update({ where: { id: opts.productId }, data: { stockQty: totalQty } });
  const { kind, userId, reason, note, links } = opts.movement;
  await tx.stockMovement.create({
    data: {
      kind,
      delta,
      quantityAfter: branchQty,
      reason: reason ?? null,
      note: note ?? null,
      userId: userId ?? null,
      companyId: opts.companyId,
      branchId: opts.branchId,
      productId: opts.productId,
      ...links,
    },
  });
}

/** Sets the count at one branch (a stock take) and moves the total by the difference. */
export async function setStockAt(
  tx: Tx,
  opts: { companyId: string; branchId: string; productId: string; quantity: number; movement: StockMovementInfo }
) {
  const current = await tx.branchStock.findUnique({
    where: { branchId_productId: { branchId: opts.branchId, productId: opts.productId } },
    select: { quantity: true },
  });
  await changeStock(tx, { ...opts, delta: roundQty(opts.quantity - (current?.quantity ?? 0)) });
  if (!current) {
    // A count of zero still records that the branch stocks this product.
    await tx.branchStock.upsert({
      where: { branchId_productId: { branchId: opts.branchId, productId: opts.productId } },
      create: { companyId: opts.companyId, branchId: opts.branchId, productId: opts.productId, quantity: opts.quantity },
      update: {},
    });
  }
}

/**
 * Branch that stock for a record moves at. Records from before branches
 * existed were all moved to the main branch, so a missing one means main.
 */
export async function stockBranchFor(companyId: string, recordBranchId: string | null | undefined): Promise<string> {
  return recordBranchId ?? ensureMainBranch(companyId);
}

/** productId → quantity on hand at one branch (missing rows are zero). */
export async function quantitiesAt(branchId: string, productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.branchStock.findMany({
    where: { branchId, productId: { in: productIds } },
    select: { productId: true, quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r.quantity]));
}

/** Every branch stock row for the company, or just one branch's. */
export async function stockRows(companyId: string, branchId: string | null): Promise<BranchStockRow[]> {
  const rows = await db.branchStock.findMany({
    where: { companyId, ...(branchId ? { branchId } : {}), branch: { active: true } },
    select: {
      quantity: true,
      reorderLevel: true,
      productId: true,
      branchId: true,
      product: { select: { name: true, reorderLevel: true } },
      branch: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    productId: r.productId,
    productName: r.product.name,
    branchId: r.branchId,
    branchName: r.branch.name,
    quantity: r.quantity,
    reorderLevel: r.reorderLevel,
    productReorderLevel: r.product.reorderLevel,
  }));
}

/** Low stock at one branch, or at every active branch when branchId is null. */
export async function lowStockAt(companyId: string, branchId: string | null): Promise<BranchStockRow[]> {
  return lowStockRows(await stockRows(companyId, branchId));
}
