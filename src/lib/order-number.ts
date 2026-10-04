import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { formatOrderNumber } from "@/lib/order-rules";

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
