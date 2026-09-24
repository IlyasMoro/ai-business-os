import { db } from "@/lib/db";

/**
 * A customer's Accounts Receivable: invoices that have been sent but not
 * yet paid. Draft invoices don't count (never sent), paid invoices don't
 * count (already settled).
 */
export async function getCustomerOutstandingBalance(customerId: string): Promise<number> {
  const result = await db.invoice.aggregate({
    where: { customerId, status: { in: ["SENT", "OVERDUE"] } },
    _sum: { totalAmount: true },
  });
  return result._sum.totalAmount ?? 0;
}
