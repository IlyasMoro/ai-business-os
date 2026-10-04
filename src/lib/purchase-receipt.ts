import "server-only";
import { db } from "@/lib/db";
import { computePurchaseOrderTotal } from "@/lib/procurement-math";
import { costAfterReceipt, type CostMethod } from "@/lib/cost-math";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export const PURCHASE_EXPENSE_CATEGORY = "Stock purchases";

/**
 * The money side of receiving a purchase order, inside the receiving
 * transaction and BEFORE stock goes up (the average needs the stock on hand
 * before the delivery):
 * - books one expense in Accounting for the order total, at the order's
 *   branch and linked to the order, so the profit and loss shows what stock cost;
 * - updates each product's cost by the company's cost method.
 * Undoing the receipt removes the expense (removePurchaseExpense).
 */
export async function bookPurchaseReceipt(
  tx: Tx,
  po: {
    companyId: string;
    purchaseOrderId: string;
    poNumber: string;
    supplierName: string;
    branchId: string | null;
    items: { productId: string; quantity: number; unitCost: number }[];
  }
) {
  const total = computePurchaseOrderTotal(po.items);
  if (total > 0) {
    await tx.transaction.create({
      data: {
        companyId: po.companyId,
        type: "EXPENSE",
        category: PURCHASE_EXPENSE_CATEGORY,
        amount: total,
        description: `Stock received on ${po.poNumber} from ${po.supplierName}`,
        purchaseOrderId: po.purchaseOrderId,
        branchId: po.branchId,
      },
    });
  }

  const settings = await tx.inventorySettings.findUnique({ where: { companyId: po.companyId }, select: { costMethod: true } });
  const method: CostMethod = settings?.costMethod ?? "MANUAL";
  if (method === "MANUAL") return;

  const byProduct = new Map<string, { quantity: number; unitCost: number }[]>();
  for (const item of po.items) byProduct.set(item.productId, [...(byProduct.get(item.productId) ?? []), item]);
  for (const [productId, lines] of byProduct) {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { cost: true, stockQty: true } });
    if (!product) continue;
    const cost = costAfterReceipt({ method, currentCost: product.cost, onHand: product.stockQty, lines });
    if (cost !== product.cost) await tx.product.update({ where: { id: productId }, data: { cost } });
  }
}

/** Undoing a receipt takes its expense back out of Accounting. Product cost
 * isn't rolled back: later receipts may already have averaged it. */
export async function removePurchaseExpense(tx: Tx, companyId: string, purchaseOrderId: string) {
  await tx.transaction.deleteMany({
    where: { companyId, purchaseOrderId, type: "EXPENSE", category: PURCHASE_EXPENSE_CATEGORY },
  });
}
