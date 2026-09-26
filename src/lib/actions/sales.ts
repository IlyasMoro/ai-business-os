"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere, resolveNewRecordBranch } from "@/lib/branches";
import { getCustomerOutstandingBalance } from "@/lib/customer-balance";
import { evaluateCreditCheck } from "@/lib/credit-math";
import { changeStock, quantitiesAt, stockBranchFor } from "@/lib/stock";
import { describeShortfalls, findBranchShortfalls } from "@/lib/stock-levels";
import { LotShortageError, getInventorySettings, takeFromLots } from "@/lib/lots";
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
    data: { customerId: customer.id, companyId: session.companyId, branchId: await resolveNewRecordBranch(formData) },
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
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: {
      status: true,
      totalAmount: true,
      customerId: true,
      branchId: true,
      customer: { select: { name: true, creditLimit: true } },
      items: {
        select: {
          quantity: true,
          product: { select: { id: true, name: true, stockQty: true, trackingMode: true } },
        },
      },
    },
  });
  if (!order) {
    return { message: "Order not found." };
  }

  // Goods leave from the order's own branch. Stock at other branches
  // doesn't count: it has to be moved over first.
  const branchId = await stockBranchFor(session.companyId, order.branchId);
  const branchShortfalls = async () => {
    const [atBranch, branch] = await Promise.all([
      quantitiesAt(branchId, order.items.map((i) => i.product.id)),
      db.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
    ]);
    const shortfalls = findBranchShortfalls(
      order.items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        branchQty: atBranch.get(item.product.id) ?? 0,
        totalQty: item.product.stockQty,
      }))
    );
    return shortfalls.length > 0 ? describeShortfalls(shortfalls, branch?.name ?? "this branch") : null;
  };

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
    const summary = await branchShortfalls();
    if (summary) {
      return { message: `Cannot confirm: not enough stock for ${summary}. Receive more stock or reduce the order.` };
    }
  }

  // Stock is only actually consumed once the order is fulfilled, the point
  // where goods physically leave, matching the course's "delivery" step.
  // Re-check availability here too, in case stock moved since confirmation.
  if (nextStatus === "FULFILLED" && order.status === "CONFIRMED") {
    const summary = await branchShortfalls();
    if (summary) {
      return { message: `Cannot fulfil: not enough stock for ${summary}. Receive more stock or reduce the order.` };
    }

    // Lot and serial products also ship from specific lots, picked by the
    // company's rule, so every unit can be traced to this order.
    const inventory = await getInventorySettings(session.companyId);
    try {
      await db.$transaction(async (tx) => {
        for (const item of order.items) {
          await changeStock(tx, { companyId: session.companyId, branchId, productId: item.product.id, delta: -item.quantity });
          if (item.product.trackingMode !== "NONE") {
            await takeFromLots(tx, {
              companyId: session.companyId,
              branchId,
              productId: item.product.id,
              productName: item.product.name,
              quantity: item.quantity,
              kind: "SALE",
              settings: inventory,
              links: { orderId },
            });
          }
        }
        await tx.order.update({
          where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
          data: { status: nextStatus, fulfilledAt: new Date() },
        });
      });
    } catch (e) {
      if (e instanceof LotShortageError) {
        return {
          message: `Cannot fulfil: ${e.message}${inventory.blockExpired ? " Expired lots can't be shipped." : ""}`,
        };
      }
      throw e;
    }

    revalidatePath(`/dashboard/sales/${orderId}`);
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");
    return undefined;
  }

  await db.order.update({
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
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
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
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
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
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
    where: { id: itemId, order: { companyId: session.companyId, ...(await lockedWhere()) } },
  });

  await recomputeOrderTotal(orderId);

  revalidatePath(`/dashboard/sales/${orderId}`);
}
