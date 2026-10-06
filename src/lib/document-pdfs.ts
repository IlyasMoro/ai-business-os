import "server-only";
import { db } from "@/lib/db";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { PO_STATUS_LABEL } from "@/lib/po-rules";
import { ORDER_STATUS_LABEL } from "@/lib/order-rules";

/* Purchase order and order confirmation PDFs, shared by the download links
   and the emails. Callers check access to the record first. */

export type BuiltPdf = { bytes: Uint8Array; filename: string; number: string; to: { name: string; email: string | null } };

const logo = (c: { logoData: Uint8Array | Buffer | null; logoMimeType: string | null }) => ({
  logoData: c.logoData ? new Uint8Array(c.logoData) : undefined,
  logoMimeType: c.logoMimeType,
});

export async function purchaseOrderPdf(companyId: string, purchaseOrderId: string): Promise<BuiltPdf | null> {
  const po = await db.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, companyId },
    select: {
      poNumber: true,
      status: true,
      createdAt: true,
      expectedDate: true,
      totalAmount: true,
      supplier: { select: { name: true, email: true } },
      companyRef: { select: { name: true, logoData: true, logoMimeType: true } },
      items: { select: { quantity: true, unitCost: true, product: { select: { name: true, sku: true, unit: true } } } },
    },
  });
  if (!po) return null;
  const bytes = await generateInvoicePdf({
    kind: "Purchase order",
    invoiceNumber: po.poNumber,
    status: PO_STATUS_LABEL[po.status],
    issueDate: po.createdAt,
    dueDate: po.expectedDate,
    taxRate: 0,
    totalAmount: po.totalAmount,
    companyName: po.companyRef.name,
    customerName: po.supplier.name,
    customerEmail: po.supplier.email,
    lineItems: po.items.map((i) => ({ description: `${i.product.name} (${i.product.sku})`, quantity: i.quantity, unitPrice: i.unitCost, unit: i.product.unit })),
    ...logo(po.companyRef),
  });
  return { bytes, filename: `${po.poNumber}.pdf`, number: po.poNumber, to: po.supplier };
}

export async function orderConfirmationPdf(companyId: string, orderId: string): Promise<BuiltPdf | null> {
  const order = await db.order.findFirst({
    where: { id: orderId, companyId },
    select: {
      orderNumber: true,
      status: true,
      createdAt: true,
      totalAmount: true,
      customerPoNumber: true,
      customer: { select: { name: true, email: true } },
      companyRef: { select: { name: true, logoData: true, logoMimeType: true } },
      items: { select: { quantity: true, unitPrice: true, product: { select: { name: true, unit: true } } } },
    },
  });
  if (!order) return null;
  const bytes = await generateInvoicePdf({
    kind: "Order",
    invoiceNumber: order.orderNumber,
    status: ORDER_STATUS_LABEL[order.status],
    issueDate: order.createdAt,
    taxRate: 0,
    totalAmount: order.totalAmount,
    companyName: order.companyRef.name,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    lineItems: order.items.map((i) => ({ description: i.product.name, quantity: i.quantity, unitPrice: i.unitPrice, unit: i.product.unit })),
    notes: order.customerPoNumber ? `Your PO number: ${order.customerPoNumber}` : null,
    ...logo(order.companyRef),
  });
  return { bytes, filename: `${order.orderNumber}.pdf`, number: order.orderNumber, to: order.customer };
}
