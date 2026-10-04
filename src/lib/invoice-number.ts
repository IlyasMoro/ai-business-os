import "server-only";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatInvoiceNumber } from "@/lib/invoice-rules";

/** The company's next invoice number from its counter, bumped atomically,
 * so numbers never repeat even after invoices are deleted. Pass a
 * transaction client to tie it to the invoice being created. */
export async function takeInvoiceNumber(client: Prisma.TransactionClient | typeof db, companyId: string): Promise<string> {
  const { invoiceSeq } = await client.company.update({
    where: { id: companyId },
    data: { invoiceSeq: { increment: 1 } },
    select: { invoiceSeq: true },
  });
  return formatInvoiceNumber(invoiceSeq);
}

/** Sent invoices whose due date has passed become Overdue. Runs from the
 * 15 minute scheduler for every company, and when invoices are opened for
 * one company, so the status is right even between runs. */
export async function markOverdueInvoices(companyId?: string): Promise<number> {
  const { count } = await db.invoice.updateMany({
    where: { ...(companyId ? { companyId } : {}), status: "SENT", dueDate: { lt: startOfDay(new Date()) } },
    data: { status: "OVERDUE" },
  });
  return count;
}
