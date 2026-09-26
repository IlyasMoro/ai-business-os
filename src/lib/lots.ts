import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { pickLots, type PickingRule } from "@/lib/lot-math";

export type InventorySettingsValues = { pickingRule: PickingRule; blockExpired: boolean; expiryWarningDays: number };

export const DEFAULT_INVENTORY_SETTINGS: InventorySettingsValues = { pickingRule: "FIFO", blockExpired: true, expiryWarningDays: 30 };

export const getInventorySettings = cache(async (companyId: string): Promise<InventorySettingsValues> => {
  const s = await db.inventorySettings.findUnique({
    where: { companyId },
    select: { pickingRule: true, blockExpired: true, expiryWarningDays: true },
  });
  return s ?? DEFAULT_INVENTORY_SETTINGS;
});

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type Links = { orderId?: string; purchaseOrderId?: string; workOrderId?: string; returnId?: string; transferId?: string };

export class LotShortageError extends Error {
  constructor(public productName: string, public shortfall: number) {
    super(`Not enough usable lots for ${productName}: ${shortfall} short.`);
  }
}

/**
 * Takes `quantity` units of a tracked product out of its lots inside a
 * transaction, following the company's picking rule, and records a
 * movement per lot. Throws LotShortageError if usable lots run out, which
 * rolls the whole transaction back.
 */
export async function takeFromLots(
  tx: Tx,
  opts: {
    companyId: string;
    /** Only lots at this branch are picked. */
    branchId: string;
    productId: string;
    productName: string;
    quantity: number;
    kind: "SALE" | "CONSUMPTION" | "TRANSFER_OUT";
    settings: InventorySettingsValues;
    links: Links;
  }
) {
  const lots = await tx.stockLot.findMany({
    where: { productId: opts.productId, companyId: opts.companyId, branchId: opts.branchId, quantity: { gt: 0 } },
    select: { id: true, lotNumber: true, quantity: true, expiresAt: true, receivedAt: true },
  });
  const { allocations, shortfall } = pickLots(lots, opts.quantity, {
    rule: opts.settings.pickingRule,
    blockExpired: opts.settings.blockExpired,
  });
  if (shortfall > 0) throw new LotShortageError(opts.productName, shortfall);

  for (const a of allocations) {
    await tx.stockLot.update({ where: { id: a.lotId }, data: { quantity: { decrement: a.quantity } } });
    await tx.lotMovement.create({
      data: { kind: opts.kind, quantity: -a.quantity, lotId: a.lotId, companyId: opts.companyId, ...opts.links },
    });
  }
  return allocations;
}

/** Adds units into a named lot, creating it if new, with a movement. */
export async function putIntoLot(
  tx: Tx,
  opts: {
    companyId: string;
    branchId: string;
    productId: string;
    lotNumber: string;
    quantity: number;
    expiresAt?: Date | null;
    /** Kept from the original lot on a transfer, so oldest first picking still holds. */
    receivedAt?: Date;
    source: "PO" | "WO" | "OPENING" | "RETURN" | (string & {});
    kind: "RECEIPT" | "PRODUCTION" | "OPENING" | "RETURN" | "TRANSFER_IN";
    links: Links;
  }
) {
  const lot = await tx.stockLot.upsert({
    where: { productId_branchId_lotNumber: { productId: opts.productId, branchId: opts.branchId, lotNumber: opts.lotNumber } },
    create: {
      lotNumber: opts.lotNumber,
      quantity: opts.quantity,
      expiresAt: opts.expiresAt ?? null,
      ...(opts.receivedAt ? { receivedAt: opts.receivedAt } : {}),
      source: opts.source,
      purchaseOrderId: opts.links.purchaseOrderId,
      workOrderId: opts.links.workOrderId,
      productId: opts.productId,
      branchId: opts.branchId,
      companyId: opts.companyId,
    },
    update: { quantity: { increment: opts.quantity } },
  });
  await tx.lotMovement.create({
    data: { kind: opts.kind, quantity: opts.quantity, lotId: lot.id, companyId: opts.companyId, ...opts.links },
  });
  return lot;
}

/**
 * Puts returned units back into the lots they shipped from on that order,
 * in the order they shipped, never more than shipped minus already returned. Any
 * units that can't be matched go into a lot named after the return.
 */
export async function returnToLots(
  tx: Tx,
  opts: {
    companyId: string;
    /** The order's branch; units that can't be matched to a lot land here. */
    branchId: string;
    orderId: string;
    productId: string;
    quantity: number;
    returnId: string;
    returnNumber: string;
  }
) {
  const moves = await tx.lotMovement.findMany({
    where: { orderId: opts.orderId, companyId: opts.companyId, lot: { productId: opts.productId }, kind: { in: ["SALE", "RETURN"] } },
    select: { lotId: true, quantity: true, kind: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const outstanding = new Map<string, number>();
  for (const m of [...moves].reverse()) {
    // SALE is negative (shipped), RETURN positive (came back).
    outstanding.set(m.lotId, (outstanding.get(m.lotId) ?? 0) - m.quantity);
  }

  let remaining = opts.quantity;
  for (const [lotId, shipped] of outstanding) {
    if (remaining <= 0) break;
    const back = Math.min(shipped, remaining);
    if (back <= 0) continue;
    await tx.stockLot.update({ where: { id: lotId }, data: { quantity: { increment: back } } });
    await tx.lotMovement.create({
      data: { kind: "RETURN", quantity: back, lotId, orderId: opts.orderId, returnId: opts.returnId, companyId: opts.companyId },
    });
    remaining -= back;
  }
  if (remaining > 0) {
    await putIntoLot(tx, {
      companyId: opts.companyId,
      branchId: opts.branchId,
      productId: opts.productId,
      lotNumber: opts.returnNumber,
      quantity: remaining,
      source: "RETURN",
      kind: "RETURN",
      links: { orderId: opts.orderId, returnId: opts.returnId },
    });
  }
}
