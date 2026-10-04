"use server";

import { purchaseOrderPdf } from "@/lib/document-pdfs";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { escapeHtml } from "@/lib/invoice-rules";
import { bookPurchaseReceipt, removePurchaseExpense } from "@/lib/purchase-receipt";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { changeStock, stockBranchFor } from "@/lib/stock";
import { lockedWhere, resolveNewRecordBranch } from "@/lib/branches";
import { computePurchaseOrderTotal } from "@/lib/procurement-math";
import { takePurchaseOrderNumber } from "@/lib/order-number";
import { logAudit } from "@/lib/audit";
import { canChangePoStatus, canDeletePo, canEditPoLines, undoReceiptBlocker } from "@/lib/po-rules";
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

  // Purchase orders keep their supplier (the database refuses too), so
  // purchase and stock history never lose them.
  const inUse = await db.purchaseOrder.findFirst({ where: { supplierId, companyId: session.companyId }, select: { id: true } });
  if (inUse) redirect("/dashboard/procurement/suppliers?error=supplier-in-use");

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
      poNumber: await takePurchaseOrderNumber(db, session.companyId),
      supplierId: supplier.id,
      companyId: session.companyId,
      branchId: await resolveNewRecordBranch(formData),
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
    where: { id: purchaseOrderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: {
      status: true,
      poNumber: true,
      branchId: true,
      autoCreated: true,
      supplier: { select: { name: true } },
      items: { select: { productId: true, quantity: true, unitCost: true, product: { select: { trackingMode: true } } } },
    },
  });
  if (!current) return;
  // Only allowed steps (lib/po-rules.ts): never received twice, and leaving
  // Received goes through undoPurchaseOrderReceipt.
  if (!canChangePoStatus(current.status, nextStatus)) return;
  // A purchase order drafted by automation moves on only with an owner's or admin's approval.
  if (current.autoCreated && current.status === "DRAFT" && nextStatus !== "DRAFT" && !hasRole(session, ["OWNER", "ADMIN"])) {
    redirect(`/dashboard/procurement/${purchaseOrderId}?error=approval-needed`);
  }

  // Receiving a PO is what actually puts the ordered stock into Inventory —
  // without this, stock levels silently drift from what's really on hand.
  const isNewlyReceived = nextStatus === "RECEIVED" && current.status !== "RECEIVED";
  if (isNewlyReceived && current.items.some((i) => i.product.trackingMode !== "NONE")) {
    redirect(`/dashboard/procurement/${purchaseOrderId}/receive?error=lots-needed`);
  }

  // Stock arrives at the branch that ordered it.
  const branchId = await stockBranchFor(session.companyId, current.branchId);

  await db.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: nextStatus,
        receivedAt: isNewlyReceived ? new Date() : undefined,
      },
    });

    if (isNewlyReceived) {
      // Expense in Accounting and product cost, before stock goes up.
      await bookPurchaseReceipt(tx, {
        companyId: session.companyId,
        purchaseOrderId,
        poNumber: current.poNumber,
        supplierName: current.supplier.name,
        branchId,
        items: current.items,
      });
      for (const item of current.items) {
        await changeStock(tx, {
          companyId: session.companyId,
          branchId,
          productId: item.productId,
          delta: item.quantity,
          movement: { kind: "RECEIPT", userId: session.userId, links: { purchaseOrderId } },
        });
      }
    }
  });

  revalidatePath(`/dashboard/procurement/${purchaseOrderId}`);
  revalidatePath("/dashboard/procurement");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/accounting");
}

export async function deletePurchaseOrder(purchaseOrderId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/procurement?error=forbidden");
  }

  // An order that was placed or received stays, for purchase and stock history.
  const existing = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { status: true },
  });
  if (!existing) redirect("/dashboard/procurement");
  if (!canDeletePo(existing.status)) redirect(`/dashboard/procurement/${purchaseOrderId}?error=po-delete-blocked`);

  await db.purchaseOrder.delete({
    where: { id: purchaseOrderId, companyId: session.companyId, ...(await lockedWhere()) },
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
    where: { id: purchaseOrderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { id: true, status: true },
  });
  if (!purchaseOrder) {
    redirect(`/dashboard/procurement/${purchaseOrderId}?error=invalid`);
  }
  if (!canEditPoLines(purchaseOrder.status)) {
    redirect(`/dashboard/procurement/${purchaseOrderId}?error=po-locked`);
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

  // deleteMany: does nothing (rather than an error page) once it's ordered.
  await db.purchaseOrderItem.deleteMany({
    where: { id: itemId, purchaseOrderId, purchaseOrder: { companyId: session.companyId, status: "DRAFT", ...(await lockedWhere()) } },
  });

  await recomputePurchaseOrderTotal(purchaseOrderId);

  revalidatePath(`/dashboard/procurement/${purchaseOrderId}`);
}

/**
 * Undoes a receipt: the stock that came in goes back out (recorded in each
 * product's stock history) and the order returns to Ordered. Owners and
 * admins only, and only while that stock is all still at the branch; lot and
 * serial products can't, as their units are already in specific lots.
 */
export async function undoPurchaseOrderReceipt(purchaseOrderId: string) {
  const session = await verifySession();
  const back = `/dashboard/procurement/${purchaseOrderId}`;
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);

  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: {
      status: true,
      poNumber: true,
      branchId: true,
      items: { select: { productId: true, quantity: true, product: { select: { name: true, trackingMode: true } } } },
    },
  });
  if (!po) redirect("/dashboard/procurement");
  const branchId = await stockBranchFor(session.companyId, po.branchId);

  const blockerFor = async (client: Pick<typeof db, "branchStock">) => {
    const rows = await client.branchStock.findMany({
      where: { branchId, productId: { in: po.items.map((i) => i.productId) } },
      select: { productId: true, quantity: true },
    });
    const onHand = new Map(rows.map((r) => [r.productId, r.quantity]));
    return undoReceiptBlocker({
      status: po.status,
      lines: po.items.map((i) => ({
        productName: i.product.name,
        quantity: i.quantity,
        onHand: onHand.get(i.productId) ?? 0,
        tracked: i.product.trackingMode !== "NONE",
      })),
    });
  };

  const blocker = await blockerFor(db);
  if (blocker) redirect(`${back}?why=${encodeURIComponent(`Can't undo the receipt. ${blocker}`)}`);

  try {
    await db.$transaction(async (tx) => {
      // Checked again inside the transaction, in case a sale got there first,
      // and only from Received, so a double click can't take the stock twice.
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id: purchaseOrderId, status: "RECEIVED" },
        data: { status: "ORDERED", receivedAt: null },
      });
      if (claimed.count !== 1) throw new UndoRejected("This purchase order isn't received any more.");
      const again = await blockerFor(tx);
      if (again) throw new UndoRejected(again);
      await removePurchaseExpense(tx, session.companyId, purchaseOrderId);
      for (const item of po.items) {
        await changeStock(tx, {
          companyId: session.companyId,
          branchId,
          productId: item.productId,
          delta: -item.quantity,
          movement: { kind: "RECEIPT_REVERSED", userId: session.userId, links: { purchaseOrderId } },
        });
      }
    });
  } catch (e) {
    if (e instanceof UndoRejected) redirect(`${back}?why=${encodeURIComponent(`Can't undo the receipt. ${e.message}`)}`);
    throw e;
  }

  await logAudit(session.companyId, session.userId, "purchase_order.receipt_undone", "PurchaseOrder", purchaseOrderId, { order: po.poNumber });
  revalidatePath(back);
  revalidatePath("/dashboard/procurement");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/accounting");
}

class UndoRejected extends Error {}

/** Emails the purchase order PDF to the supplier. Sending a draft places it
 * (Ordered); an automation draft still needs an owner or admin to send it. */
export async function sendPurchaseOrderEmail(purchaseOrderId: string) {
  const session = await verifySession();
  const back = `/dashboard/procurement/${purchaseOrderId}`;
  const po = await db.purchaseOrder.findUnique({
    where: { id: purchaseOrderId, companyId: session.companyId, ...(await lockedWhere()) },
    select: { status: true, autoCreated: true, _count: { select: { items: true } }, companyRef: { select: { name: true } } },
  });
  if (!po) redirect("/dashboard/procurement");
  if (po.status === "CANCELLED" || po._count.items === 0) redirect(`${back}?error=invalid`);
  if (po.autoCreated && po.status === "DRAFT" && !hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=approval-needed`);

  const pdf = await purchaseOrderPdf(session.companyId, purchaseOrderId);
  if (!pdf) redirect("/dashboard/procurement");
  if (!pdf.to.email) redirect(`${back}?error=supplier-no-email`);

  try {
    await sendEmailForCompany(session.companyId, {
      to: pdf.to.email,
      subject: `Purchase order ${pdf.number} from ${po.companyRef.name}`,
      html: `<p>Hello ${escapeHtml(pdf.to.name)},</p><p>Please find purchase order ${pdf.number} attached. Let us know if anything on it can't be supplied as listed.</p><p>Thank you.</p>`,
      attachments: [{ filename: pdf.filename, content: Buffer.from(pdf.bytes) }],
    });
  } catch (err) {
    console.error(`[procurement] send failed for purchase order ${purchaseOrderId}:`, err);
    redirect(`${back}?error=document-send-failed`);
  }

  await db.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { sentAt: new Date(), ...(po.status === "DRAFT" ? { status: "ORDERED" } : {}) },
  });
  await logAudit(session.companyId, session.userId, "purchase_order.sent", "PurchaseOrder", purchaseOrderId, { order: pdf.number });
  revalidatePath(back);
  revalidatePath("/dashboard/procurement");
  redirect(`${back}?sent=1`);
}

/** Edits a supplier's name and contact details. */
export async function updateSupplier(supplierId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/procurement/suppliers/${supplierId}`;
  const validated = SupplierSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });
  if (!validated.success) redirect(`${back}?error=invalid`);

  const { email, phone, notes, name } = validated.data;
  const { count } = await db.supplier.updateMany({
    where: { id: supplierId, companyId: session.companyId },
    data: { name, email: email || null, phone: phone || null, notes: notes || null },
  });
  if (count === 0) redirect("/dashboard/procurement/suppliers");
  revalidatePath(back);
  revalidatePath("/dashboard/procurement/suppliers");
  redirect(`${back}?saved=1`);
}
