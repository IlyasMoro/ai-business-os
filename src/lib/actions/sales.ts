"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getCustomerOutstandingBalance } from "@/lib/customer-balance";
import { evaluateCreditCheck } from "@/lib/credit-math";
import { findStockShortfalls } from "@/lib/stock-math";
import {
  OrderSchema,
  OrderItemSchema,
  OrderStatusValues,
  type OrderFormState,
  type OrderItemFormState,
  type OrderStatusFormState,
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

export async function updateOrderStatus(
  orderId: string,
  _state: OrderStatusFormState,
  formData: FormData
): Promise<OrderStatusFormState> {
  const session = await verifySession();

  const status = formData.get("status");
  if (typeof status !== "string" || !OrderStatusValues.includes(status as (typeof OrderStatusValues)[number])) {
    return undefined;
  }
  const nextStatus = status as (typeof OrderStatusValues)[number];

  const order = await db.order.findUnique({
    where: { id: orderId, companyId: session.companyId },
    select: {
      status: true,
      totalAmount: true,
      customerId: true,
      customer: { select: { name: true, creditLimit: true } },
      items: {
        select: {
          quantity: true,
          product: { select: { id: true, name: true, stockQty: true } },
        },
      },
    },
  });
  if (!order) {
    return { message: "Order not found." };
  }

  // Credit check runs at the moment an order moves from pending to
  // confirmed, matching the course's ERP credit management scenario: check
  // outstanding balance plus this order against the customer's limit
  // before letting the order through.
  if (nextStatus === "CONFIRMED" && order.status === "PENDING") {
    const outstandingBalance = await getCustomerOutstandingBalance(order.customerId);
    const check = evaluateCreditCheck({
      outstandingBalance,
      creditLimit: order.customer.creditLimit,
      orderTotal: order.totalAmount,
    });

    if (!check.withinLimit) {
      return {
        message: `Cannot confirm: ${order.customer.name}'s balance would be $${check.projectedBalance.toFixed(2)}, which is $${check.amountOverLimit.toFixed(2)} over their $${order.customer.creditLimit!.toFixed(2)} credit limit. Raise the limit, collect payment first, or reduce this order.`,
      };
    }

    // Available to Promise check: confirm every line item is actually
    // covered by stock on hand before promising the order to the customer.
    const shortfalls = findStockShortfalls(
      order.items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        stockQty: item.product.stockQty,
      }))
    );
    if (shortfalls.length > 0) {
      const summary = shortfalls.map((s) => `${s.productName} (${s.available} in stock, ${s.requested} requested)`).join(", ");
      return { message: `Cannot confirm: not enough stock for ${summary}. Receive more stock or reduce the order.` };
    }
  }

  // Stock is only actually consumed once the order is fulfilled, the point
  // where goods physically leave, matching the course's "delivery" step.
  // Re-check availability here too, in case stock moved since confirmation.
  if (nextStatus === "FULFILLED" && order.status === "CONFIRMED") {
    const shortfalls = findStockShortfalls(
      order.items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        stockQty: item.product.stockQty,
      }))
    );
    if (shortfalls.length > 0) {
      const summary = shortfalls.map((s) => `${s.productName} (${s.available} in stock, ${s.requested} requested)`).join(", ");
      return { message: `Cannot fulfil: not enough stock for ${summary}. Receive more stock or reduce the order.` };
    }

    await db.$transaction([
      ...order.items.map((item) =>
        db.product.update({
          where: { id: item.product.id },
          data: { stockQty: { decrement: item.quantity } },
        })
      ),
      db.order.update({
        where: { id: orderId, companyId: session.companyId },
        data: { status: nextStatus, fulfilledAt: new Date() },
      }),
    ]);

    revalidatePath(`/dashboard/sales/${orderId}`);
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");
    return undefined;
  }

  await db.order.update({
    where: { id: orderId, companyId: session.companyId },
    data: { status: nextStatus },
  });

  revalidatePath(`/dashboard/sales/${orderId}`);
  revalidatePath("/dashboard/sales");
  return undefined;
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
