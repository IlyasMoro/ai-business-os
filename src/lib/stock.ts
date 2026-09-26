import "server-only";
import { db } from "@/lib/db";
import { ensureMainBranch } from "@/lib/branches";
import { lowStockRows, type BranchStockRow } from "@/lib/stock-levels";

/* Stock per branch. Product.stockQty is the company total and must always
   equal the sum of the product's BranchStock rows, so every change to
   stock goes through changeStock or setStockAt, never straight to
   product.stockQty. */

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Adds `delta` (negative to take) at one branch and to the company total. */
export async function changeStock(
  tx: Tx,
  opts: { companyId: string; branchId: string; productId: string; delta: number }
) {
  if (opts.delta === 0) return;
  await tx.branchStock.upsert({
    where: { branchId_productId: { branchId: opts.branchId, productId: opts.productId } },
    create: { companyId: opts.companyId, branchId: opts.branchId, productId: opts.productId, quantity: opts.delta },
    update: { quantity: { increment: opts.delta } },
  });
  await tx.product.update({ where: { id: opts.productId }, data: { stockQty: { increment: opts.delta } } });
}

/** Sets the count at one branch (a stock take) and moves the total by the difference. */
export async function setStockAt(
  tx: Tx,
  opts: { companyId: string; branchId: string; productId: string; quantity: number }
) {
  const current = await tx.branchStock.findUnique({
    where: { branchId_productId: { branchId: opts.branchId, productId: opts.productId } },
    select: { quantity: true },
  });
  await changeStock(tx, { ...opts, delta: opts.quantity - (current?.quantity ?? 0) });
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
