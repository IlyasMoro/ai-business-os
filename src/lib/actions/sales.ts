"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  OrderSchema,
  OrderItemSchema,
  OrderStatusValues,
  type OrderFormState,
  type OrderItemFormState,
} from "@/lib/validation/sales";

async function recomputeOrderTotal(orderId: string) {
  const items = await db.orderItem.findMany({
    where: { orderId },
    select: { quantity: true, unitPrice: true },
  });
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  await db.order.update({ where: { id: orderId }, data: { totalAmount } });
}

export async function createOrder(
  _state: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const session = await verifySession();

  const validated = OrderSchema.safeParse({
    customerId: formData.get("customerId"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const customer = await db.customer.findUnique({
    where: { id: validated.data.customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return { errors: { customerId: ["Select a valid customer."] } };
  }

  const order = await db.order.create({
    data: { customerId: customer.id, companyId: session.companyId },
  });

  revalidatePath("/dashboard/sales");
  redirect(`/dashboard/sales/${order.id}`);
}

export async function updateOrderStatus(orderId: string, formData: FormData) {
  const session = await verifySession();

  const status = formData.get("status");
  if (typeof status !== "string" || !OrderStatusValues.includes(status as (typeof OrderStatusValues)[number])) {
    return;
  }

  await db.order.update({
    where: { id: orderId, companyId: session.companyId },
    data: { status: status as (typeof OrderStatusValues)[number] },
  });

  revalidatePath(`/dashboard/sales/${orderId}`);
  revalidatePath("/dashboard/sales");
}

export async function deleteOrder(orderId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/sales?error=forbidden");
  }

  await db.order.delete({
    where: { id: orderId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/sales");
  redirect("/dashboard/sales");
}

export async function addOrderItem(
  orderId: string,
  _state: OrderItemFormState,
  formData: FormData
): Promise<OrderItemFormState> {
  const session = await verifySession();

  const validated = OrderItemSchema.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const order = await db.order.findUnique({
    where: { id: orderId, companyId: session.companyId },
    select: { id: true },
  });
  if (!order) {
    return { message: "Order not found." };
  }

  const product = await db.product.findUnique({
    where: { id: validated.data.productId, companyId: session.companyId },
    select: { id: true, unitPrice: true },
  });
  if (!product) {
    return { errors: { productId: ["Select a valid product."] } };
  }

  await db.orderItem.create({
    data: {
      orderId,
      productId: product.id,
      quantity: validated.data.quantity,
      unitPrice: product.unitPrice,
    },
  });

  await recomputeOrderTotal(orderId);

  revalidatePath(`/dashboard/sales/${orderId}`);
  return undefined;
}

export async function removeOrderItem(orderId: string, itemId: string) {
  const session = await verifySession();

  await db.orderItem.delete({
    where: { id: itemId, order: { companyId: session.companyId } },
  });

  await recomputeOrderTotal(orderId);

  revalidatePath(`/dashboard/sales/${orderId}`);
}
