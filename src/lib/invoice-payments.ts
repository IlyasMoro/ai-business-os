import "server-only";
import { db } from "@/lib/db";
import { formatCreditNumber, statusAfterSettlement, type PaymentMethod } from "@/lib/invoice-rules";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export const PAYMENT_INCOME_CATEGORY = "Invoice payment";

const METHOD_WORD: Record<PaymentMethod, string> = { CASH: "cash", CARD: "card", BANK_TRANSFER: "bank transfer", OTHER: "payment" };

/**
 * Recomputes an invoice's amountPaid and amountCredited from its payment and
 * credit note rows, and its status from those (lib/invoice-rules.ts). Always
 * from the rows, so the running totals can't drift.
 */
export async function settleInvoice(tx: Tx, invoiceId: string) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { status: true, totalAmount: true, dueDate: true },
  });
  const [paid, credited] = await Promise.all([
    tx.invoicePayment.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
    tx.creditNote.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
  ]);
  const amountPaid = paid._sum.amount ?? 0;
  const amountCredited = credited._sum.amount ?? 0;
  const status = statusAfterSettlement({ ...invoice, amountPaid, amountCredited });
  await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid, amountCredited, status } });
  return { amountPaid, amountCredited, status };
}

/** Money received: books the income in Accounting (dated when paid, at the
 * invoice's branch) and records the payment against the invoice. */
export async function recordPayment(
  tx: Tx,
  p: {
    companyId: string;
    invoice: { id: string; invoiceNumber: string; branchId: string | null };
    amount: number;
    paidAt: Date;
    method: PaymentMethod;
    reference?: string | null;
    userId: string | null;
  }
) {
  const income = await tx.transaction.create({
    data: {
      companyId: p.companyId,
      type: "INCOME",
      category: PAYMENT_INCOME_CATEGORY,
      amount: p.amount,
      date: p.paidAt,
      description: `Payment for invoice ${p.invoice.invoiceNumber} (${METHOD_WORD[p.method]}${p.reference ? `, ${p.reference}` : ""})`,
      invoiceId: p.invoice.id,
      branchId: p.invoice.branchId,
    },
    select: { id: true },
  });
  const payment = await tx.invoicePayment.create({
    data: {
      amount: p.amount,
      paidAt: p.paidAt,
      method: p.method,
      reference: p.reference || null,
      invoiceId: p.invoice.id,
      companyId: p.companyId,
      userId: p.userId,
      transactionId: income.id,
    },
    select: { id: true },
  });
  const settled = await settleInvoice(tx, p.invoice.id);
  return { paymentId: payment.id, ...settled };
}

/** Removes a payment and the income it booked. */
export async function removePayment(tx: Tx, companyId: string, invoiceId: string, paymentId: string) {
  const payment = await tx.invoicePayment.findFirst({ where: { id: paymentId, invoiceId, companyId }, select: { transactionId: true } });
  if (!payment) return null;
  await tx.invoicePayment.delete({ where: { id: paymentId } });
  if (payment.transactionId) await tx.transaction.deleteMany({ where: { id: payment.transactionId, companyId } });
  return settleInvoice(tx, invoiceId);
}

/** A credit note against the invoice, numbered CN0001 per company. */
export async function issueCreditNote(
  tx: Tx,
  c: { companyId: string; invoiceId: string; amount: number; reason: string; userId: string | null }
) {
  const { creditNoteSeq } = await tx.company.update({
    where: { id: c.companyId },
    data: { creditNoteSeq: { increment: 1 } },
    select: { creditNoteSeq: true },
  });
  const note = await tx.creditNote.create({
    data: {
      creditNumber: formatCreditNumber(creditNoteSeq),
      amount: c.amount,
      reason: c.reason,
      invoiceId: c.invoiceId,
      companyId: c.companyId,
      userId: c.userId,
    },
    select: { id: true, creditNumber: true },
  });
  const settled = await settleInvoice(tx, c.invoiceId);
  return { ...note, ...settled };
}

export async function removeCreditNote(tx: Tx, companyId: string, invoiceId: string, creditNoteId: string) {
  const { count } = await tx.creditNote.deleteMany({ where: { id: creditNoteId, invoiceId, companyId } });
  if (count === 0) return null;
  return settleInvoice(tx, invoiceId);
}
