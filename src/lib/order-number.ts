import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { db } from "@/lib/db";
import { formatOrderNumber } from "@/lib/order-rules";
import { formatPoNumber } from "@/lib/po-rules";

/** The company's next sales order number. Call inside the transaction that
 * creates the order: the counter is bumped atomically, so two orders at
 * once never share a number. */
export async function takeOrderNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const { orderSeq } = await tx.company.update({
    where: { id: companyId },
    data: { orderSeq: { increment: 1 } },
    select: { orderSeq: true },
  });
  return formatOrderNumber(orderSeq);
}

/** The company's next purchase order number, from its own counter (same
 * idea as sales orders). Works with or without a transaction. */
export async function takePurchaseOrderNumber(client: Prisma.TransactionClient | typeof db, companyId: string): Promise<string> {
  const { purchaseOrderSeq } = await client.company.update({
    where: { id: companyId },
    data: { purchaseOrderSeq: { increment: 1 } },
    select: { purchaseOrderSeq: true },
  });
  return formatPoNumber(purchaseOrderSeq);
}
