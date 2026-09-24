"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { buildMrpPlan, getMrpSettings } from "@/lib/mrp";
import { MRP_PRESETS, isMrpPreset } from "@/lib/mrp-settings-presets";
import { computePurchaseOrderTotal } from "@/lib/procurement-math";
import { findStockShortfalls } from "@/lib/stock-math";
import {
  WorkOrderStatusValues,
  canTransitionWorkOrder,
  explodeBom,
  formatWorkOrderNumber,
  wouldCreateBomCycle,
  type WorkOrderStatus,
} from "@/lib/mrp-math";
import { BomLineSchema, MrpSettingsSchema, PlanningFieldsSchema, WorkOrderSchema } from "@/lib/validation/mrp";

async function nextWorkOrderNumber(companyId: string) {
  const count = await db.workOrder.count({ where: { companyId } });
  return formatWorkOrderNumber(count + 1);
}

async function requireMrpEnabled(companyId: string, back: string) {
  const settings = await getMrpSettings(companyId);
  if (!settings.enabled) redirect(`${back}?error=mrp-disabled`);
  return settings;
}

// ---------- Bill of materials & planning fields ----------

export async function addBomLine(productId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/inventory/${productId}`;

  const validated = BomLineSchema.safeParse({
    componentId: formData.get("componentId"),
    quantity: formData.get("quantity"),
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  const [parent, component] = await Promise.all([
    db.product.findUnique({ where: { id: productId, companyId: session.companyId }, select: { id: true } }),
    db.product.findUnique({
      where: { id: validated.data.componentId, companyId: session.companyId },
      select: { id: true },
    }),
  ]);
  if (!parent || !component) redirect(`${back}?error=invalid`);

  const bom = await db.bomLine.findMany({
    where: { companyId: session.companyId },
    select: { parentId: true, componentId: true, quantity: true },
  });
  if (wouldCreateBomCycle(bom, parent.id, component.id)) redirect(`${back}?error=bom-cycle`);

  await db.bomLine.upsert({
    where: { parentId_componentId: { parentId: parent.id, componentId: component.id } },
    create: {
      parentId: parent.id,
      componentId: component.id,
      quantity: validated.data.quantity,
      companyId: session.companyId,
    },
    update: { quantity: validated.data.quantity },
  });

  revalidatePath(back);
  revalidatePath("/dashboard/mrp");
  redirect(back);
}

export async function removeBomLine(productId: string, lineId: string) {
  const session = await verifySession();
  await db.bomLine.delete({ where: { id: lineId, parentId: productId, companyId: session.companyId } });
  revalidatePath(`/dashboard/inventory/${productId}`);
  revalidatePath("/dashboard/mrp");
}

export async function updatePlanningFields(productId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/inventory/${productId}`;

  const validated = PlanningFieldsSchema.safeParse({
    leadTimeDays: formData.get("leadTimeDays"),
    lotSize: formData.get("lotSize"),
    preferredSupplierId: formData.get("preferredSupplierId") || undefined,
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  let preferredSupplierId: string | null = null;
  if (validated.data.preferredSupplierId) {
    const supplier = await db.supplier.findUnique({
      where: { id: validated.data.preferredSupplierId, companyId: session.companyId },
      select: { id: true },
    });
    if (!supplier) redirect(`${back}?error=invalid`);
    preferredSupplierId = supplier.id;
  }

  await db.product.update({
    where: { id: productId, companyId: session.companyId },
    data: { leadTimeDays: validated.data.leadTimeDays, lotSize: validated.data.lotSize, preferredSupplierId },
  });

  revalidatePath(back);
  revalidatePath("/dashboard/mrp");
  redirect(`${back}?saved=1`);
}

// ---------- Work orders ----------

async function insertWorkOrder(
  companyId: string,
  userId: string,
  data: { productId: string; quantity: number; dueDate?: Date; notes?: string }
) {
  const wo = await db.workOrder.create({
    data: { ...data, woNumber: await nextWorkOrderNumber(companyId), companyId },
  });
  await logAudit(companyId, userId, "work_order.created", "WorkOrder", wo.id, {
    woNumber: wo.woNumber,
    quantity: wo.quantity,
  });
  return wo;
}

export async function createWorkOrder(formData: FormData) {
  const session = await verifySession();
  await requireMrpEnabled(session.companyId, "/dashboard/mrp/work-orders");

  const validated = WorkOrderSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes") || undefined,
  });
  if (!validated.success) redirect("/dashboard/mrp/work-orders/new?error=invalid");

  // Only products with a bill of materials can be made.
  const product = await db.product.findUnique({
    where: { id: validated.data.productId, companyId: session.companyId },
    select: { id: true, _count: { select: { bomComponents: true } } },
  });
  if (!product) redirect("/dashboard/mrp/work-orders/new?error=invalid");
  if (product._count.bomComponents === 0) redirect("/dashboard/mrp/work-orders/new?error=not-made");

  const wo = await insertWorkOrder(session.companyId, session.userId, {
    productId: product.id,
    quantity: validated.data.quantity,
    dueDate: validated.data.dueDate ? new Date(validated.data.dueDate) : undefined,
    notes: validated.data.notes,
  });

  revalidatePath("/dashboard/mrp");
  redirect(`/dashboard/mrp/work-orders/${wo.id}`);
}

export async function updateWorkOrderStatus(workOrderId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/mrp/work-orders/${workOrderId}`;

  const status = formData.get("status");
  if (typeof status !== "string" || !WorkOrderStatusValues.includes(status as WorkOrderStatus)) return;
  const nextStatus = status as WorkOrderStatus;

  const wo = await db.workOrder.findUnique({
    where: { id: workOrderId, companyId: session.companyId },
    select: {
      id: true,
      status: true,
      quantity: true,
      productId: true,
      product: {
        select: {
          bomComponents: {
            select: { componentId: true, quantity: true, component: { select: { name: true, stockQty: true } } },
          },
        },
      },
    },
  });
  if (!wo) return;
  if (!canTransitionWorkOrder(wo.status, nextStatus)) redirect(`${back}?error=invalid`);

  const now = new Date();

  if (nextStatus === "COMPLETED") {
    const settings = await getMrpSettings(session.companyId);
    const lines = wo.product.bomComponents;
    const requirements = explodeBom(lines, wo.quantity);

    if (!settings.allowNegativeStock) {
      const shortfalls = findStockShortfalls(
        requirements.map((req) => {
          const line = lines.find((l) => l.componentId === req.componentId)!;
          return {
            productId: req.componentId,
            productName: line.component.name,
            quantity: req.required,
            stockQty: line.component.stockQty,
          };
        })
      );
      if (shortfalls.length > 0) redirect(`${back}?error=component-short`);
    }

    // Completing a work order is the point the build physically happens:
    // components leave stock and finished units arrive, all or nothing.
    await db.$transaction([
      ...requirements.map((req) =>
        db.product.update({ where: { id: req.componentId }, data: { stockQty: { decrement: req.required } } })
      ),
      db.product.update({ where: { id: wo.productId }, data: { stockQty: { increment: wo.quantity } } }),
      db.workOrder.update({ where: { id: wo.id }, data: { status: nextStatus, completedAt: now } }),
    ]);
  } else {
    await db.workOrder.update({
      where: { id: wo.id },
      data: { status: nextStatus, startedAt: nextStatus === "IN_PROGRESS" ? now : undefined },
    });
  }

  await logAudit(session.companyId, session.userId, "work_order.status_changed", "WorkOrder", wo.id, {
    from: wo.status,
    to: nextStatus,
  });

  revalidatePath(back);
  revalidatePath("/dashboard/mrp");
  revalidatePath("/dashboard/mrp/work-orders");
  if (nextStatus === "COMPLETED") revalidatePath("/dashboard/inventory");
}

export async function deleteWorkOrder(workOrderId: string) {
  const session = await verifySession();
  const back = `/dashboard/mrp/work-orders/${workOrderId}`;
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);

  const wo = await db.workOrder.findUnique({
    where: { id: workOrderId, companyId: session.companyId },
    select: { status: true },
  });
  if (!wo) redirect("/dashboard/mrp/work-orders");
  // A completed work order moved stock, so it stays for the record.
  if (wo.status === "COMPLETED") redirect(`${back}?error=work-order-locked`);

  await db.workOrder.delete({ where: { id: workOrderId, companyId: session.companyId } });

  revalidatePath("/dashboard/mrp");
  revalidatePath("/dashboard/mrp/work-orders");
  redirect("/dashboard/mrp/work-orders");
}

// ---------- Acting on the plan ----------
// These always rerun the plan on the server rather than trusting numbers
// from the page, which may be stale.

export async function createWorkOrderFromPlan(productId: string) {
  const session = await verifySession();
  const settings = await requireMrpEnabled(session.companyId, "/dashboard/mrp");

  const row = (await buildMrpPlan(session.companyId, settings)).find((r) => r.productId === productId);
  if (!row || row.action !== "MAKE" || row.plannedQty <= 0) redirect("/dashboard/mrp?error=plan-changed");

  const wo = await insertWorkOrder(session.companyId, session.userId, {
    productId,
    quantity: row.plannedQty,
    dueDate: row.availableBy,
    notes: "Created from the planning run.",
  });

  revalidatePath("/dashboard/mrp");
  redirect(`/dashboard/mrp/work-orders/${wo.id}`);
}

/**
 * Turns Buy suggestions into draft purchase orders, one per supplier.
 * Pass a product id to act on a single line, or nothing for all of them.
 */
export async function createPurchaseOrdersFromPlan(productId: string | null) {
  const session = await verifySession();
  const settings = await requireMrpEnabled(session.companyId, "/dashboard/mrp");

  const rows = (await buildMrpPlan(session.companyId, settings)).filter(
    (r) => r.action === "BUY" && r.plannedQty > 0 && (productId === null || r.productId === productId)
  );
  if (rows.length === 0) redirect("/dashboard/mrp?error=plan-changed");
  if (rows.some((r) => !r.preferredSupplierId) && productId !== null) redirect("/dashboard/mrp?error=no-supplier");

  const costs = new Map(
    (
      await db.product.findMany({
        where: { id: { in: rows.map((r) => r.productId) }, companyId: session.companyId },
        select: { id: true, cost: true },
      })
    ).map((p) => [p.id, p.cost])
  );

  const bySupplier = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.preferredSupplierId) continue;
    bySupplier.set(row.preferredSupplierId, [...(bySupplier.get(row.preferredSupplierId) ?? []), row]);
  }
  if (bySupplier.size === 0) redirect("/dashboard/mrp?error=no-supplier");

  const created: string[] = [];
  for (const [supplierId, supplierRows] of bySupplier) {
    const items = supplierRows.map((r) => ({
      productId: r.productId,
      quantity: r.plannedQty,
      unitCost: costs.get(r.productId) ?? 0,
    }));
    const latest = Math.max(...supplierRows.map((r) => r.availableBy.getTime()));
    const po = await db.purchaseOrder.create({
      data: {
        supplierId,
        companyId: session.companyId,
        expectedDate: new Date(latest),
        totalAmount: computePurchaseOrderTotal(items),
        items: { create: items },
      },
    });
    created.push(po.id);
  }

  await logAudit(session.companyId, session.userId, "mrp.purchase_orders_created", "PurchaseOrder", created[0], {
    count: created.length,
  });

  revalidatePath("/dashboard/mrp");
  revalidatePath("/dashboard/procurement");
  redirect(created.length === 1 ? `/dashboard/procurement/${created[0]}` : "/dashboard/procurement");
}

// ---------- Settings ----------

export async function updateMrpSettings(formData: FormData) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/mrp/settings?error=forbidden");

  const validated = MrpSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    includePendingOrders: formData.get("includePendingOrders") === "on",
    useSafetyStock: formData.get("useSafetyStock") === "on",
    allowNegativeStock: formData.get("allowNegativeStock") === "on",
  });
  if (!validated.success) redirect("/dashboard/mrp/settings?error=invalid");

  await db.mrpSettings.upsert({
    where: { companyId: session.companyId },
    create: { ...validated.data, companyId: session.companyId },
    update: validated.data,
  });
  await logAudit(session.companyId, session.userId, "mrp_settings.updated", "MrpSettings", session.companyId);

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/mrp/settings?saved=1");
}

export async function applyMrpPreset(preset: string) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/mrp/settings?error=forbidden");
  if (!isMrpPreset(preset)) redirect("/dashboard/mrp/settings?error=invalid");

  const values = MRP_PRESETS[preset].values;
  await db.mrpSettings.upsert({
    where: { companyId: session.companyId },
    create: { ...values, companyId: session.companyId },
    update: values,
  });
  await logAudit(session.companyId, session.userId, "mrp_settings.preset_applied", "MrpSettings", session.companyId, {
    preset,
  });

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/mrp/settings?saved=1");
}
