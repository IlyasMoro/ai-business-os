"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { computePurchaseOrderTotal } from "@/lib/procurement-math";
import {
  SupplierSchema,
  PurchaseOrderSchema,
  PurchaseOrderItemSchema,
  PurchaseOrderStatusValues,
} from "@/lib/validation/procurement";

async function recomputePurchaseOrderTotal(purchaseOrderId: string) {
  const items = await db.purchaseOrderItem.findMany({
    where: { purchaseOrderId },
    select: { quantity: true, unitCost: true },
  });
  const totalAmount = computePurchaseOrderTotal(items);
  await db.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { totalAmount } });
}

export async function createSupplier(formData: FormData) {
  const session = await verifySession();

  const validated = SupplierSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });

  if (!validated.success) {
    redirect("/dashboard/procurement/suppliers?error=invalid");
  }

  const { email, ...rest } = validated.data;

  await db.supplier.create({
    data: { ...rest, email: email || undefined, companyId: session.companyId },
  });

  revalidatePath("/dashboard/procurement/suppliers");
  redirect("/dashboard/procurement/suppliers");
}

export async function deleteSupplier(supplierId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/procurement/suppliers?error=forbidden");
  }

  await db.supplier.delete({
    where: { id: supplierId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/procurement/suppliers");
  redirect("/dashboard/procurement/suppliers");
}

export async function createPurchaseOrder(formData: FormData) {
  const session = await verifySession();

  const validated = PurchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    expectedDate: formData.get("expectedDate"),
  });

  if (!validated.success) {
    redirect("/dashboard/procurement/new?error=invalid");
  }

  const supplier = await db.supplier.findUnique({
    where: { id: validated.data.supplierId, companyId: session.companyId },
    select: { id: true },
  });
  if (!supplier) {
    redirect("/dashboard/procurement/new?error=invalid");
  }

  const purchaseOrder = await db.purchaseOrder.create({
    data: {
      supplierId: supplier.id,
      companyId: session.companyId,
      expectedDate: validated.data.expectedDate ? new Date(validated.data.expectedDate) : undefined,
    },
  });

  revalidatePath("/dashboard/procurement");
  redirect(`/dashboard/procurement/${purchaseOrder.id}`);
}

export async function updatePurchaseOrderStatus(purchaseOrderId: string, formData: FormData) {
  const session = await verifySession();

  const status = formData.get("status");
  if (
    typeof status !== "string" ||
    !PurchaseOrderStatusValues.includes(status as (typeof PurchaseOrderStatusValues)[number])
  ) {
    return;
  }
  const nextStatus = status as (typeof PurchaseOrderStatusValues)[number];

  const current = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId, companyId: session.companyId },
    select: { status: true, items: { select: { productId: true, quantity: true } } },
  });
  if (!current) return;

  // Receiving a PO is what actually puts the ordered stock into Inventory —
  // without this, stock levels silently drift from what's really on hand.
  const isNewlyReceived = nextStatus === "RECEIVED" && current.status !== "RECEIVED";

  await db.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: nextStatus,
        receivedAt: isNewlyReceived ? new Date() : undefined,
      },
    });

    if (isNewlyReceived) {
      for (const item of current.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
    }
  });

  revalidatePath(`/dashboard/procurement/${purchaseOrderId}`);
  revalidatePath("/dashboard/procurement");
  revalidatePath("/dashboard/inventory");
}

export async function deletePurchaseOrder(purchaseOrderId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/procurement?error=forbidden");
  }

  await db.purchaseOrder.delete({
    where: { id: purchaseOrderId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/procurement");
  redirect("/dashboard/procurement");
}

export async function addPurchaseOrderItem(purchaseOrderId: string, formData: FormData) {
  const session = await verifySession();

  const validated = PurchaseOrderItemSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    unitCost: formData.get("unitCost"),
  });

  if (!validated.success) {
    redirect(`/dashboard/procurement/${purchaseOrderId}?error=invalid`);
  }

  const purchaseOrder = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId, companyId: session.companyId },
    select: { id: true },
  });
  if (!purchaseOrder) {
    redirect(`/dashboard/procurement/${purchaseOrderId}?error=invalid`);
  }

  const product = await db.product.findUnique({
    where: { id: validated.data.productId, companyId: session.companyId },
    select: { id: true },
  });
  if (!product) {
    redirect(`/dashboard/procurement/${purchaseOrderId}?error=invalid`);
  }

  await db.purchaseOrderItem.create({
    data: {
      purchaseOrderId,
      productId: product.id,
      quantity: validated.data.quantity,
      unitCost: validated.data.unitCost,
    },
  });

  await recomputePurchaseOrderTotal(purchaseOrderId);

  revalidatePath(`/dashboard/procurement/${purchaseOrderId}`);
  redirect(`/dashboard/procurement/${purchaseOrderId}`);
}

export async function removePurchaseOrderItem(purchaseOrderId: string, itemId: string) {
  const session = await verifySession();

  await db.purchaseOrderItem.delete({
    where: { id: itemId, purchaseOrder: { companyId: session.companyId } },
  });

  await recomputePurchaseOrderTotal(purchaseOrderId);

  revalidatePath(`/dashboard/procurement/${purchaseOrderId}`);
}
