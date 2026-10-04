"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ProductEditSchema, ProductSchema, type ProductFormState, type StockAdjustState } from "@/lib/validation/inventory";
import { resolveNewRecordBranch } from "@/lib/branches";
import { changeStock, setStockAt } from "@/lib/stock";
import { logAudit } from "@/lib/audit";
import { ADJUSTMENT_REASON_IDS, planAdjustment, productDeleteBlocker, type StockAdjustmentReason } from "@/lib/stock-history";

export async function createProduct(
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const session = await verifySession();

  const validated = ProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description"),
    cost: formData.get("cost"),
    unitPrice: formData.get("unitPrice"),
    stockQty: formData.get("stockQty"),
    reorderLevel: formData.get("reorderLevel"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { description, stockQty, ...rest } = validated.data;

  const existing = await db.product.findUnique({
    where: { companyId_sku: { companyId: session.companyId, sku: rest.sku } },
    select: { id: true },
  });
  if (existing) {
    return { errors: { sku: ["A product with this SKU already exists."] } };
  }

  // Opening stock sits at the chosen branch; the total follows from it.
  const branchId = await resolveNewRecordBranch(formData);
  if (!branchId) return { message: "Choose a branch for this product's stock." };
  const product = await db.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: { ...rest, stockQty: 0, description: description || undefined, companyId: session.companyId },
    });
    await setStockAt(tx, {
      companyId: session.companyId,
      branchId,
      productId: created.id,
      quantity: stockQty,
      movement: { kind: "OPENING", userId: session.userId, note: "Opening stock when the product was added" },
    });
    return created;
  });

  revalidatePath("/dashboard/inventory");
  redirect(`/dashboard/inventory/${product.id}`);
}

export async function updateProduct(
  productId: string,
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const session = await verifySession();

  const validated = ProductEditSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description"),
    cost: formData.get("cost"),
    unitPrice: formData.get("unitPrice"),
    reorderLevel: formData.get("reorderLevel"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { description, ...rest } = validated.data;

  const existing = await db.product.findFirst({
    where: { companyId: session.companyId, sku: rest.sku, id: { not: productId } },
    select: { id: true },
  });
  if (existing) {
    return { errors: { sku: ["A product with this SKU already exists."] } };
  }

  // Stock isn't on this form any more: it changes through adjustStock, which
  // records a reason, or through sales, receipts, transfers and builds.
  const { count } = await db.product.updateMany({
    where: { id: productId, companyId: session.companyId },
    data: { ...rest, description: description || null },
  });
  if (count === 0) return { message: "Product not found." };

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/inventory/${productId}`);
  redirect(`/dashboard/inventory/${productId}`);
}

export async function applyReorderSuggestion(productId: string, suggestedLevel: number) {
  const session = await verifySession();

  await db.product.update({
    where: { id: productId, companyId: session.companyId },
    data: { reorderLevel: Math.round(suggestedLevel) },
  });

  revalidatePath(`/dashboard/inventory/${productId}`);
}

export async function deleteProduct(productId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/inventory?error=forbidden");
  }

  // Everything that points at the product. Quotes, deals, purchase orders
  // and returns can't lose their product (the database refuses), and lots
  // would take their traceability with them, so all of these block.
  const owned = { product: { companyId: session.companyId } };
  const [orders, quotes, deals, purchaseOrders, returns, workOrders, billsOfMaterials, transfers, lots] = await Promise.all([
    db.orderItem.findFirst({ where: { productId, ...owned }, select: { id: true } }),
    db.quoteItem.findFirst({ where: { productId, ...owned }, select: { id: true } }),
    db.dealItem.findFirst({ where: { productId, ...owned }, select: { id: true } }),
    db.purchaseOrderItem.findFirst({ where: { productId, ...owned }, select: { id: true } }),
    db.returnItem.findFirst({ where: { productId, ...owned }, select: { id: true } }),
    db.workOrder.findFirst({ where: { productId, companyId: session.companyId }, select: { id: true } }),
    // Components are protected; a product's own BOM lines go with it.
    db.bomLine.findFirst({ where: { componentId: productId, companyId: session.companyId }, select: { id: true } }),
    db.stockTransferItem.findFirst({ where: { productId, transfer: { companyId: session.companyId } }, select: { id: true } }),
    db.stockLot.findFirst({ where: { productId, companyId: session.companyId }, select: { id: true } }),
  ]);
  const blocker = productDeleteBlocker({
    orders: Boolean(orders),
    quotes: Boolean(quotes),
    deals: Boolean(deals),
    purchaseOrders: Boolean(purchaseOrders),
    returns: Boolean(returns),
    workOrders: Boolean(workOrders),
    billsOfMaterials: Boolean(billsOfMaterials),
    transfers: Boolean(transfers),
    lots: Boolean(lots),
  });
  if (blocker) {
    redirect(`/dashboard/inventory/${productId}?error=in-use&why=${encodeURIComponent(blocker)}`);
  }

  await db.product.delete({
    where: { id: productId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

/**
 * A branch's own reorder level for a product; blank goes back to the
 * product's level. Owners and admins only, like other stock policy.
 */
export async function setBranchReorderLevel(productId: string, branchId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/inventory/${productId}`;
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);

  const raw = String(formData.get("reorderLevel") ?? "").trim();
  const level = raw === "" ? null : Number(raw);
  if (level !== null && (!Number.isInteger(level) || level < 0 || level > 1_000_000)) redirect(`${back}?error=invalid`);

  const [product, branch] = await Promise.all([
    db.product.findUnique({ where: { id: productId, companyId: session.companyId }, select: { id: true } }),
    db.branch.findUnique({ where: { id: branchId, companyId: session.companyId }, select: { id: true } }),
  ]);
  if (!product || !branch) redirect(`${back}?error=invalid`);

  await db.branchStock.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { companyId: session.companyId, branchId, productId, quantity: 0, reorderLevel: level },
    update: { reorderLevel: level },
  });

  revalidatePath(back);
  revalidatePath("/dashboard/inventory");
  redirect(`${back}?saved=1`);
}

/**
 * A recorded stock correction at one branch: a counted quantity, or a change
 * up or down, with a reason. Owners and admins only. Lot and serial products
 * change through their lots (receiving, shipping, building) instead.
 */
export async function adjustStock(productId: string, _state: StockAdjustState, formData: FormData): Promise<StockAdjustState> {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) return { message: "Only owners and admins can adjust stock." };

  const mode = formData.get("mode") === "change" ? "change" : "count";
  const rawValue = String(formData.get("quantity") ?? "").trim();
  const value = Number(rawValue);
  const reason = String(formData.get("reason") ?? "") as StockAdjustmentReason;
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const branchId = String(formData.get("branchId") ?? "");
  if (rawValue === "" || !Number.isFinite(value)) return { message: "Enter a quantity." };
  if (!ADJUSTMENT_REASON_IDS.includes(reason)) return { message: "Choose a reason." };
  if (reason === "OTHER" && !note) return { message: "Add a note saying what happened." };

  const [product, branch] = await Promise.all([
    db.product.findUnique({ where: { id: productId, companyId: session.companyId }, select: { name: true, trackingMode: true } }),
    db.branch.findFirst({ where: { id: branchId, companyId: session.companyId, active: true }, select: { id: true, name: true } }),
  ]);
  if (!product) return { message: "Product not found." };
  if (!branch) return { message: "Choose a branch." };
  if (product.trackingMode !== "NONE") {
    return { message: "This product is lot or serial tracked, so its stock changes through its lots: receiving, shipping, returns and builds." };
  }

  let delta = 0;
  try {
    await db.$transaction(async (tx) => {
      // Read inside the transaction so the plan uses the latest count.
      const row = await tx.branchStock.findUnique({
        where: { branchId_productId: { branchId: branch.id, productId } },
        select: { quantity: true },
      });
      const plan = planAdjustment({ mode, value, current: row?.quantity ?? 0, reason });
      if ("error" in plan) throw new AdjustmentRejected(plan.error);
      delta = plan.delta;
      await changeStock(tx, {
        companyId: session.companyId,
        branchId: branch.id,
        productId,
        delta,
        movement: { kind: "ADJUSTMENT", userId: session.userId, reason, note: note || undefined },
      });
    });
  } catch (e) {
    if (e instanceof AdjustmentRejected) return { message: e.message };
    throw e;
  }

  await logAudit(session.companyId, session.userId, "stock.adjusted", "Product", productId, {
    product: product.name,
    branch: branch.name,
    change: delta,
    reason,
  });
  revalidatePath(`/dashboard/inventory/${productId}`);
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}

class AdjustmentRejected extends Error {}
