"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { changeStock, stockBranchFor } from "@/lib/stock";
import { lockedWhere } from "@/lib/branches";
import { logAudit } from "@/lib/audit";
import { getReturnPolicy } from "@/lib/returns-policy";
import { returnToLots } from "@/lib/lots";
import { RETURN_POLICY_PRESETS, isReturnPolicyPreset } from "@/lib/returns-policy-presets";
import {
  ReturnStatusValues,
  canTransitionReturn,
  computeRefund,
  formatRmaNumber,
  initialReturnStatus,
  isReturnEditable,
  isWithinReturnWindow,
  returnableQuantity,
  shouldRestock,
  type ReturnStatus,
} from "@/lib/returns-math";
import { ReturnSchema, ReturnItemSchema, ReturnPolicySchema } from "@/lib/validation/returns";

async function nextRmaNumber(companyId: string) {
  const count = await db.returnAuthorization.count({ where: { companyId } });
  return formatRmaNumber(count + 1);
}

/** Units of an order line already claimed by other returns that weren't rejected. */
async function alreadyReturnedQuantity(orderItemId: string) {
  const agg = await db.returnItem.aggregate({
    where: { orderItemId, rma: { status: { not: "REJECTED" } } },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

async function recomputeRefund(returnId: string) {
  const rma = await db.returnAuthorization.findUniqueOrThrow({
    where: { id: returnId },
    select: { restockingFeePercent: true, items: { select: { quantity: true, unitPrice: true } } },
  });
  const { refund } = computeRefund(rma.items, rma.restockingFeePercent);
  await db.returnAuthorization.update({ where: { id: returnId }, data: { refundAmount: refund } });
}

export async function createReturn(formData: FormData) {
  const session = await verifySession();
  const policy = await getReturnPolicy(session.companyId);
  if (!policy.enabled) redirect("/dashboard/returns?error=returns-disabled");

  const orderIdField = formData.get("orderId");
  const back = `/dashboard/returns/new${typeof orderIdField === "string" && orderIdField ? `?orderId=${encodeURIComponent(orderIdField)}&` : "?"}`;

  const validated = ReturnSchema.safeParse({
    orderId: orderIdField,
    reason: formData.get("reason"),
    notes: formData.get("notes") || undefined,
  });
  if (!validated.success) redirect(`${back}error=invalid`);

  const order = await db.order.findUnique({
    where: { id: validated.data.orderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { id: true, status: true, createdAt: true, fulfilledAt: true },
  });
  if (!order || order.status !== "FULFILLED") redirect(`${back}error=not-returnable`);
  if (!isWithinReturnWindow(order.fulfilledAt ?? order.createdAt, policy.windowDays)) {
    redirect(`${back}error=return-window`);
  }

  const rma = await db.returnAuthorization.create({
    data: {
      rmaNumber: await nextRmaNumber(session.companyId),
      status: initialReturnStatus(policy.requireApproval),
      reason: validated.data.reason,
      notes: validated.data.notes,
      restockingFeePercent: policy.restockingFeePercent,
      orderId: order.id,
      companyId: session.companyId,
    },
  });

  await logAudit(session.companyId, session.userId, "return.created", "ReturnAuthorization", rma.id, {
    rmaNumber: rma.rmaNumber,
    orderId: order.id,
  });

  revalidatePath("/dashboard/returns");
  revalidatePath(`/dashboard/sales/${order.id}`);
  redirect(`/dashboard/returns/${rma.id}`);
}

export async function addReturnItem(returnId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/returns/${returnId}`;

  const validated = ReturnItemSchema.safeParse({
    orderItemId: formData.get("orderItemId"),
    quantity: formData.get("quantity"),
    condition: formData.get("condition"),
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  const rma = await db.returnAuthorization.findUnique({
    where: { id: returnId, companyId: session.companyId },
    select: { id: true, status: true, orderId: true },
  });
  if (!rma) redirect(`${back}?error=invalid`);
  if (!isReturnEditable(rma.status)) redirect(`${back}?error=return-locked`);

  // The line must belong to the order this return was opened against.
  const orderItem = await db.orderItem.findUnique({
    where: { id: validated.data.orderItemId, orderId: rma.orderId },
    select: { id: true, quantity: true, unitPrice: true, productId: true },
  });
  if (!orderItem) redirect(`${back}?error=invalid`);

  const remaining = returnableQuantity(orderItem.quantity, await alreadyReturnedQuantity(orderItem.id));
  if (validated.data.quantity > remaining) redirect(`${back}?error=return-qty`);

  await db.returnItem.create({
    data: {
      returnId: rma.id,
      orderItemId: orderItem.id,
      productId: orderItem.productId,
      quantity: validated.data.quantity,
      unitPrice: orderItem.unitPrice,
      condition: validated.data.condition,
    },
  });
  await recomputeRefund(rma.id);

  revalidatePath(back);
  revalidatePath("/dashboard/returns");
  redirect(back);
}

export async function removeReturnItem(returnId: string, itemId: string) {
  const session = await verifySession();

  const rma = await db.returnAuthorization.findUnique({
    where: { id: returnId, companyId: session.companyId },
    select: { status: true },
  });
  if (!rma || !isReturnEditable(rma.status)) return;

  await db.returnItem.delete({ where: { id: itemId, returnId } });
  await recomputeRefund(returnId);

  revalidatePath(`/dashboard/returns/${returnId}`);
  revalidatePath("/dashboard/returns");
}

export async function updateReturnStatus(returnId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/returns/${returnId}`;

  const status = formData.get("status");
  if (typeof status !== "string" || !ReturnStatusValues.includes(status as ReturnStatus)) return;
  const nextStatus = status as ReturnStatus;

  const rma = await db.returnAuthorization.findUnique({
    where: { id: returnId, companyId: session.companyId },
    select: {
      id: true,
      rmaNumber: true,
      status: true,
      refundAmount: true,
      orderId: true,
      order: { select: { branchId: true } },
      items: { select: { productId: true, quantity: true, condition: true, product: { select: { trackingMode: true } } } },
    },
  });
  if (!rma) return;
  if (!canTransitionReturn(rma.status, nextStatus)) redirect(`${back}?error=invalid`);
  if ((nextStatus === "APPROVED" || nextStatus === "RECEIVED") && rma.items.length === 0) {
    redirect(`${back}?error=return-empty`);
  }

  const policy = await getReturnPolicy(session.companyId);
  const now = new Date();
  // Returned goods go back to the branch that shipped them.
  const branchId = await stockBranchFor(session.companyId, rma.order.branchId);

  await db.$transaction(async (tx) => {
    await tx.returnAuthorization.update({
      where: { id: rma.id },
      data: {
        status: nextStatus,
        receivedAt: nextStatus === "RECEIVED" ? now : undefined,
        refundedAt: nextStatus === "REFUNDED" ? now : undefined,
      },
    });

    // Receiving is when goods physically come back, so that's when
    // resellable units (and damaged ones, if the policy says so) go back
    // into Inventory.
    if (nextStatus === "RECEIVED") {
      for (const item of rma.items) {
        if (!shouldRestock(item.condition, policy.restockDamaged)) continue;
        await changeStock(tx, { companyId: session.companyId, branchId, productId: item.productId, delta: item.quantity });
        if (item.product.trackingMode !== "NONE") {
          await returnToLots(tx, {
            companyId: session.companyId,
            branchId,
            orderId: rma.orderId,
            productId: item.productId,
            quantity: item.quantity,
            returnId: rma.id,
            returnNumber: rma.rmaNumber,
          });
        }
      }
    }

    // Paying the refund is money leaving the business, recorded in
    // Accounting like any other expense.
    if (nextStatus === "REFUNDED" && rma.refundAmount > 0) {
      await tx.transaction.create({
        data: {
          type: "EXPENSE",
          category: "Refunds",
          amount: rma.refundAmount,
          description: `Refund for ${rma.rmaNumber}`,
          date: now,
          companyId: session.companyId,
          // Charged to the branch that made the sale.
          branchId,
        },
      });
    }
  });

  await logAudit(session.companyId, session.userId, "return.status_changed", "ReturnAuthorization", rma.id, {
    from: rma.status,
    to: nextStatus,
  });

  revalidatePath(back);
  revalidatePath("/dashboard/returns");
  revalidatePath(`/dashboard/sales/${rma.orderId}`);
  if (nextStatus === "RECEIVED") revalidatePath("/dashboard/inventory");
  if (nextStatus === "REFUNDED") revalidatePath("/dashboard/accounting");
}

export async function deleteReturn(returnId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect(`/dashboard/returns/${returnId}?error=forbidden`);
  }

  const rma = await db.returnAuthorization.findUnique({
    where: { id: returnId, companyId: session.companyId },
    select: { status: true },
  });
  if (!rma) redirect("/dashboard/returns");
  // Once stock or money has moved, the record has to stay for the books.
  if (rma.status === "RECEIVED" || rma.status === "REFUNDED") {
    redirect(`/dashboard/returns/${returnId}?error=return-locked`);
  }

  await db.returnAuthorization.delete({ where: { id: returnId, companyId: session.companyId } });

  revalidatePath("/dashboard/returns");
  redirect("/dashboard/returns");
}

export async function updateReturnPolicy(formData: FormData) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/returns/policy?error=forbidden");

  const validated = ReturnPolicySchema.safeParse({
    enabled: formData.get("enabled") === "on",
    windowDays: formData.get("windowDays"),
    requireApproval: formData.get("requireApproval") === "on",
    restockingFeePercent: formData.get("restockingFeePercent"),
    restockDamaged: formData.get("restockDamaged") === "on",
    reasons: formData.get("reasons") ?? "",
  });
  if (!validated.success) redirect("/dashboard/returns/policy?error=invalid");

  await db.returnPolicy.upsert({
    where: { companyId: session.companyId },
    create: { ...validated.data, companyId: session.companyId },
    update: validated.data,
  });
  await logAudit(session.companyId, session.userId, "return_policy.updated", "ReturnPolicy", session.companyId);

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/returns/policy?saved=1");
}

export async function applyReturnPolicyPreset(preset: string) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/returns/policy?error=forbidden");
  if (!isReturnPolicyPreset(preset)) redirect("/dashboard/returns/policy?error=invalid");

  const values = RETURN_POLICY_PRESETS[preset].values;
  await db.returnPolicy.upsert({
    where: { companyId: session.companyId },
    create: { ...values, companyId: session.companyId },
    update: values,
  });
  await logAudit(session.companyId, session.userId, "return_policy.preset_applied", "ReturnPolicy", session.companyId, {
    preset,
  });

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/returns/policy?saved=1");
}
