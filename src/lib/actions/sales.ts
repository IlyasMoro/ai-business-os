"use server";

import { orderConfirmationPdf } from "@/lib/document-pdfs";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { escapeHtml } from "@/lib/invoice-rules";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere, resolveNewRecordBranch } from "@/lib/branches";
import { getCustomerOutstandingBalance } from "@/lib/customer-balance";
import { evaluateCreditCheck } from "@/lib/credit-math";
import { changeStock, quantitiesAt, stockBranchFor } from "@/lib/stock";
import { describeShortfalls, findBranchShortfalls } from "@/lib/stock-levels";
import { LotShortageError, getInventorySettings, returnToLots, takeFromLots } from "@/lib/lots";
import { markCustomerActive } from "@/lib/crm-auto";
import { takeOrderNumber } from "@/lib/order-number";
import { createDraftInvoiceForOrder } from "@/lib/invoice-from-order";
import { hasFeature } from "@/lib/plan-limits";
import { ORDER_STATUS_LABEL, canChangeStatus, canDelete, canEditLines, cancelBlocker } from "@/lib/order-rules";
import {
  OrderSchema,
  OrderItemSchema,
  OrderItemEditSchema,
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

  const branchId = await resolveNewRecordBranch(formData);
  const order = await db.$transaction(async (tx) =>
    tx.order.create({
      data: { orderNumber: await takeOrderNumber(tx, session.companyId), customerId: customer.id, companyId: session.companyId, branchId },
    })
  );

  await markCustomerActive(order.customerId);
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
      orderNumber: true,
      totalAmount: true,
      customerId: true,
      branchId: true,
      invoice: { select: { id: true } },
      _count: { select: { returns: true } },
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
  if (nextStatus === order.status) return undefined;
  if (!canChangeStatus(order.status, nextStatus)) {
    return {
      message: `A ${ORDER_STATUS_LABEL[order.status].toLowerCase()} order can't be moved to ${ORDER_STATUS_LABEL[nextStatus].toLowerCase()}.${
        order.status === "FULFILLED" ? " Use a return for goods coming back, or cancel the order to put all its stock back." : ""
      }`,
    };
  }
  if (nextStatus === "CANCELLED") {
    const blocker = cancelBlocker({ status: order.status, hasInvoice: Boolean(order.invoice), returnCount: order._count.returns });
    if (blocker) return { message: `Cannot cancel: ${blocker}` };
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
      return { message: `Cannot confirm: not enough stock for ${summary}. ${summary.includes("more at other branches") ? "Transfer stock from another branch, receive more, or reduce the order." : "Receive more stock or reduce the order."}` };
    }
  }

  // Stock is only actually consumed once the order is fulfilled, the point
  // where goods physically leave, matching the course's "delivery" step.
  // Re-check availability here too, in case stock moved since confirmation.
  if (nextStatus === "FULFILLED" && order.status === "CONFIRMED") {
    const summary = await branchShortfalls();
    if (summary) {
      return { message: `Cannot fulfil: not enough stock for ${summary}. ${summary.includes("more at other branches") ? "Transfer stock from another branch, receive more, or reduce the order." : "Receive more stock or reduce the order."}` };
    }

    // Lot and serial products also ship from specific lots, picked by the
    // company's rule, so every unit can be traced to this order.
    const inventory = await getInventorySettings(session.companyId);
    try {
      await db.$transaction(async (tx) => {
        for (const item of order.items) {
          await changeStock(tx, {
            companyId: session.companyId,
            branchId,
            productId: item.product.id,
            delta: -item.quantity,
            movement: { kind: "SALE", userId: session.userId, links: { orderId } },
          });
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

    // "Draft invoice on fulfil" automation: the invoice is only a draft, sent
    // by a person, so nothing reaches the customer without someone looking.
    const automation = await db.automationSettings.findUnique({
      where: { companyId: session.companyId },
      select: { draftInvoiceOnFulfil: true },
    });
    if (automation?.draftInvoiceOnFulfil && (await hasFeature(session.companyId, "automation"))) {
      try {
        await createDraftInvoiceForOrder(session.companyId, orderId, { userId: session.userId, automatic: true });
        revalidatePath("/dashboard/invoicing");
      } catch (err) {
        // The order is fulfilled either way; the invoice can be made by hand.
        console.error(`[automations] draft invoice on fulfil failed for order ${orderId}:`, err);
      }
    }

    revalidatePath(`/dashboard/sales/${orderId}`);
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/inventory");
    return undefined;
  }

  // Cancelling a fulfilled order puts everything it shipped back where it
  // left from: the branch stock and, for lot and serial products, the same
  // lots (lib/lots.ts returnToLots, with the order number as fallback lot).
  if (nextStatus === "CANCELLED" && order.status === "FULFILLED") {
    await db.$transaction(async (tx) => {
      for (const item of order.items) {
        await changeStock(tx, {
          companyId: session.companyId,
          branchId,
          productId: item.product.id,
          delta: item.quantity,
          movement: { kind: "SALE_CANCELLED", userId: session.userId, links: { orderId } },
        });
        if (item.product.trackingMode !== "NONE") {
          await returnToLots(tx, {
            companyId: session.companyId,
            branchId,
            orderId,
            productId: item.product.id,
            quantity: item.quantity,
            returnNumber: order.orderNumber,
          });
        }
      }
      await tx.order.update({
        where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
        data: { status: "CANCELLED", fulfilledAt: null },
      });
    });

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

  // A confirmed or fulfilled order is cancelled first, so its stock checks
  // and shipped goods are dealt with; deleting it would lose them.
  const existing = await db.order.findUnique({
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { status: true },
  });
  if (!existing) redirect("/dashboard/sales");
  if (!canDelete(existing.status)) redirect(`/dashboard/sales/${orderId}?error=order-delete-blocked`);

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
    select: { id: true, status: true },
  });
  if (!order) {
    return { message: "Order not found." };
  }
  if (!canEditLines(order.status)) {
    return { message: "Only pending orders can change. Move it back to pending first." };
  }

  const product = await db.product.findUnique({
    where: { id: validated.data.productId, companyId: session.companyId },
    select: { id: true, unitPrice: true },
  });
  if (!product) {
    return { errors: { productId: ["Select a valid product."] } };
  }

  // The same product again adds to its line instead of a second one.
  const sameProduct = await db.orderItem.findFirst({ where: { orderId, productId: product.id }, select: { id: true } });
  if (sameProduct) {
    await db.orderItem.update({ where: { id: sameProduct.id }, data: { quantity: { increment: validated.data.quantity } } });
  } else {
    await db.orderItem.create({
      data: {
        orderId,
        productId: product.id,
        quantity: validated.data.quantity,
        unitPrice: product.unitPrice,
      },
    });
  }

  await recomputeOrderTotal(orderId);

  revalidatePath(`/dashboard/sales/${orderId}`);
  return undefined;
}

export async function removeOrderItem(orderId: string, itemId: string) {
  const session = await verifySession();

  // Same rule as adding: lines are locked once the order is confirmed.
  // deleteMany: nothing happens (rather than an error page) on a locked order.
  await db.orderItem.deleteMany({
    where: { id: itemId, orderId, order: { companyId: session.companyId, status: "PENDING", ...(await lockedWhere()) } },
  });

  await recomputeOrderTotal(orderId);

  revalidatePath(`/dashboard/sales/${orderId}`);
}

/** A pending order's line: quantity for anyone, price for owners and admins. */
export async function updateOrderItem(orderId: string, itemId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/sales/${orderId}`;
  const rawPrice = formData.get("unitPrice");
  const parsed = OrderItemEditSchema.safeParse({
    quantity: formData.get("quantity"),
    unitPrice: typeof rawPrice === "string" && rawPrice.trim() !== "" ? rawPrice : undefined,
  });
  if (!parsed.success) redirect(`${back}?error=invalid`);
  const canPrice = hasRole(session, ["OWNER", "ADMIN"]);
  if (parsed.data.unitPrice !== undefined && !canPrice) redirect(`${back}?error=forbidden`);

  const { count } = await db.orderItem.updateMany({
    where: { id: itemId, orderId, order: { companyId: session.companyId, status: "PENDING", ...(await lockedWhere()) } },
    data: { quantity: parsed.data.quantity, ...(parsed.data.unitPrice !== undefined ? { unitPrice: parsed.data.unitPrice } : {}) },
  });
  if (count === 0) redirect(`${back}?error=order-locked`);
  await recomputeOrderTotal(orderId);
  revalidatePath(back);
  redirect(back);
}

/** Emails the order confirmation PDF to the customer. */
export async function sendOrderConfirmation(orderId: string) {
  const session = await verifySession();
  const back = `/dashboard/sales/${orderId}`;
  const order = await db.order.findUnique({
    where: { id: orderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { status: true, _count: { select: { items: true } }, companyRef: { select: { name: true } } },
  });
  if (!order) redirect("/dashboard/sales");
  if (order.status === "CANCELLED" || order._count.items === 0) redirect(`${back}?error=invalid`);

  const pdf = await orderConfirmationPdf(session.companyId, orderId);
  if (!pdf) redirect("/dashboard/sales");
  if (!pdf.to.email) redirect(`${back}?error=customer-no-email`);

  try {
    await sendEmailForCompany(session.companyId, {
      to: pdf.to.email,
      subject: `Order confirmation ${pdf.number} from ${order.companyRef.name}`,
      html: `<p>Hi ${escapeHtml(pdf.to.name)},</p><p>Thank you for your order. Order ${pdf.number} is attached with everything on it. We'll be in touch when it ships.</p>`,
      attachments: [{ filename: pdf.filename, content: Buffer.from(pdf.bytes) }],
    });
  } catch (err) {
    console.error(`[sales] confirmation failed for order ${orderId}:`, err);
    redirect(`${back}?error=document-send-failed`);
  }

  await db.order.update({ where: { id: orderId }, data: { confirmationSentAt: new Date() } });
  await logAudit(session.companyId, session.userId, "order.confirmation_sent", "Order", orderId, { order: pdf.number });
  revalidatePath(back);
  redirect(`${back}?sent=1`);
}
