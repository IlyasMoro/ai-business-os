"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { changeStock, stockBranchFor } from "@/lib/stock";
import { lockedWhere } from "@/lib/branches";
import { logAudit } from "@/lib/audit";
import { putIntoLot } from "@/lib/lots";
import { INVENTORY_PRESETS, isInventoryPreset } from "@/lib/inventory-presets";
import { PickingRuleValues, TrackingModeValues, generateSerials, isValidTrackingCode, parseSerials } from "@/lib/lot-math";

const OPENING_SERIAL_LIMIT = 500;

function fail(back: string, message: string): never {
  redirect(`${back}${back.includes("?") ? "&" : "?"}why=${encodeURIComponent(message)}`);
}

/**
 * Receives a purchase order, asking for a lot number (and expiry, when the
 * product tracks it) per lot tracked line, and one serial per unit on
 * serial tracked lines. All or nothing.
 */
export async function receivePurchaseOrder(purchaseOrderId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/procurement/${purchaseOrderId}/receive`;

  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: {
      id: true,
      status: true,
      branchId: true,
      items: {
        select: {
          id: true,
          quantity: true,
          product: { select: { id: true, name: true, trackingMode: true, tracksExpiry: true } },
        },
      },
    },
  });
  if (!po) redirect("/dashboard/procurement");
  if (po.status === "RECEIVED" || po.status === "CANCELLED") redirect(`/dashboard/procurement/${po.id}`);

  type Plan = { productId: string; entries: { lotNumber: string; quantity: number; expiresAt: Date | null }[] };
  const plans: Plan[] = [];
  const seen = new Map<string, Set<string>>();

  for (const item of po.items) {
    const p = item.product;
    if (p.trackingMode === "NONE") continue;

    let expiresAt: Date | null = null;
    if (p.tracksExpiry) {
      const raw = String(formData.get(`expiry_${item.id}`) ?? "");
      const parsed = z.iso.date().safeParse(raw);
      if (!parsed.success) fail(back, `Enter an expiry date for ${p.name}.`);
      expiresAt = new Date(`${parsed.data}T00:00:00Z`);
    }

    let entries: Plan["entries"];
    if (p.trackingMode === "LOT") {
      const lotNumber = String(formData.get(`lot_${item.id}`) ?? "").trim();
      if (!isValidTrackingCode(lotNumber)) fail(back, `Enter a lot number for ${p.name}.`);
      entries = [{ lotNumber, quantity: item.quantity, expiresAt }];
    } else {
      const { serials, error } = parseSerials(String(formData.get(`serials_${item.id}`) ?? ""), item.quantity);
      if (error) fail(back, `${p.name}: ${error}`);
      const existing = await db.stockLot.findMany({
        where: { productId: p.id, lotNumber: { in: serials } },
        select: { lotNumber: true },
      });
      if (existing.length > 0) fail(back, `${p.name}: serial ${existing[0].lotNumber} already exists.`);
      entries = serials.map((lotNumber) => ({ lotNumber, quantity: 1, expiresAt }));
    }

    // The same serial can't appear on two lines of one order either.
    const set = seen.get(p.id) ?? new Set();
    for (const e of entries) {
      if (p.trackingMode === "SERIAL" && set.has(e.lotNumber)) fail(back, `${p.name}: serial ${e.lotNumber} is entered twice.`);
      set.add(e.lotNumber);
    }
    seen.set(p.id, set);
    plans.push({ productId: p.id, entries });
  }

  const branchId = await stockBranchFor(session.companyId, po.branchId);
  await db.$transaction(async (tx) => {
    for (const item of po.items) {
      await changeStock(tx, { companyId: session.companyId, branchId, productId: item.product.id, delta: item.quantity });
    }
    for (const plan of plans) {
      for (const e of plan.entries) {
        await putIntoLot(tx, {
          companyId: session.companyId,
          branchId,
          productId: plan.productId,
          lotNumber: e.lotNumber,
          quantity: e.quantity,
          expiresAt: e.expiresAt,
          source: "PO",
          kind: "RECEIPT",
          links: { purchaseOrderId: po.id },
        });
      }
    }
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "RECEIVED", receivedAt: new Date() } });
  });
  await logAudit(session.companyId, session.userId, "purchase_order.received_with_lots", "PurchaseOrder", po.id, {
    lots: plans.reduce((s, p) => s + p.entries.length, 0),
  });

  revalidatePath(`/dashboard/procurement/${po.id}`);
  revalidatePath("/dashboard/procurement");
  revalidatePath("/dashboard/inventory");
  redirect(`/dashboard/procurement/${po.id}`);
}

/**
 * Switches a product's tracking. Stock already on hand becomes an opening
 * lot (or opening serials) so lots and stock always agree. Switching
 * between lot and serial needs the shelf to be empty first.
 */
export async function setProductTracking(productId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/inventory/${productId}`;
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);

  const mode = z.enum(TrackingModeValues).safeParse(formData.get("trackingMode"));
  if (!mode.success) redirect(`${back}?error=invalid`);
  const tracksExpiry = formData.get("tracksExpiry") === "on" && mode.data !== "NONE";

  const product = await db.product.findUnique({
    where: { id: productId, companyId: session.companyId },
    select: {
      id: true,
      stockQty: true,
      trackingMode: true,
      lots: { where: { quantity: { gt: 0 } }, select: { id: true } },
      branchStock: { where: { quantity: { gt: 0 } }, select: { branchId: true, quantity: true, branch: { select: { code: true, isMain: true } } } },
    },
  });
  if (!product) redirect("/dashboard/inventory");

  const from = product.trackingMode;
  const to = mode.data;
  if (from !== "NONE" && to !== "NONE" && from !== to && product.stockQty > 0) {
    fail(back, "Switching between lot and serial tracking needs zero stock on hand first.");
  }
  if (from === "NONE" && to === "SERIAL" && product.stockQty > OPENING_SERIAL_LIMIT) {
    fail(back, `Serial tracking can start with at most ${OPENING_SERIAL_LIMIT} units on hand.`);
  }

  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { trackingMode: to, tracksExpiry } });
    // Starting to track: what's on each branch's shelf becomes that
    // branch's opening lot (or serials). Serials stay unique across
    // branches by carrying the branch code outside the main branch.
    if (from === "NONE" && to !== "NONE" && product.stockQty > 0 && product.lots.length === 0) {
      for (const bs of product.branchStock) {
        const prefix = bs.branch.isMain ? "OPEN" : `OPEN-${bs.branch.code}-`;
        const codes = to === "LOT" ? ["OPENING"] : generateSerials(prefix, bs.quantity);
        for (const lotNumber of codes) {
          await putIntoLot(tx, {
            companyId: session.companyId,
            branchId: bs.branchId,
            productId: product.id,
            lotNumber,
            quantity: to === "LOT" ? bs.quantity : 1,
            source: "OPENING",
            kind: "OPENING",
            links: {},
          });
        }
      }
    }
  });
  await logAudit(session.companyId, session.userId, "product.tracking_changed", "Product", product.id, { from, to });

  revalidatePath(back);
  revalidatePath("/dashboard/inventory");
  redirect(`${back}?saved=1`);
}

const InventorySettingsSchema = z.object({
  pickingRule: z.enum(PickingRuleValues),
  blockExpired: z.boolean(),
  expiryWarningDays: z.coerce.number().int().min(0).max(3650),
});


export async function updateInventorySettings(formData: FormData) {
  const session = await verifySession();
  const back = "/dashboard/inventory/settings";
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);
  const validated = InventorySettingsSchema.safeParse({
    pickingRule: formData.get("pickingRule"),
    blockExpired: formData.get("blockExpired") === "on",
    expiryWarningDays: formData.get("expiryWarningDays"),
  });
  if (!validated.success) redirect(`${back}?error=invalid`);
  await db.inventorySettings.upsert({
    where: { companyId: session.companyId },
    create: { ...validated.data, companyId: session.companyId },
    update: validated.data,
  });
  revalidatePath("/dashboard/inventory", "layout");
  redirect(`${back}?saved=1`);
}

export async function applyInventoryPreset(preset: string) {
  const session = await verifySession();
  const back = "/dashboard/inventory/settings";
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);
  if (!isInventoryPreset(preset)) redirect(`${back}?error=invalid`);
  const values = INVENTORY_PRESETS[preset].values;
  await db.inventorySettings.upsert({
    where: { companyId: session.companyId },
    create: { ...values, companyId: session.companyId },
    update: values,
  });
  revalidatePath("/dashboard/inventory", "layout");
  redirect(`${back}?saved=1`);
}
