import { db } from "@/lib/db";

/**
 * A customer's Accounts Receivable: what's still owed on invoices that have
 * been sent, after part payments and credit notes. Draft invoices don't
 * count (never sent), paid invoices don't count (already settled).
 */
export async function getCustomerOutstandingBalance(customerId: string): Promise<number> {
  const result = await db.invoice.aggregate({
    where: { customerId, status: { in: ["SENT", "OVERDUE"] } },
    _sum: { totalAmount: true, amountPaid: true, amountCredited: true },
  });
  const owed = (result._sum.totalAmount ?? 0) - (result._sum.amountPaid ?? 0) - (result._sum.amountCredited ?? 0);
  return Math.max(0, Math.round(owed * 100) / 100);
}
