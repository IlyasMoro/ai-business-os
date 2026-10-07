import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere } from "@/lib/branches";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { Button, LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { InvoiceLineItemForm } from "@/components/invoicing/invoice-line-item-form";
import { InvoiceStatusForm } from "@/components/invoicing/invoice-status-form";
import { DocumentsSection } from "@/components/documents/documents-section";
import {
  createCreditNote,
  deleteCreditNote,
  deleteInvoice,
  deleteInvoicePayment,
  recordInvoicePayment,
  removeInvoiceLineItem,
  sendInvoiceEmail,
  updateInvoiceDetails,
  updateInvoiceLineItem,
} from "@/lib/actions/invoicing";
import { Select } from "@/components/ui-dark/input";
import { Input, Label } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { markOverdueInvoices } from "@/lib/invoice-number";
import { PAYMENT_METHODS, balanceDue, canDeleteInvoice, canEditInvoice } from "@/lib/invoice-rules";
import { computeInvoiceSubtotal, computeInvoiceTax } from "@/lib/invoicing-math";
import { Download, Send } from "lucide-react";
import { EdiSendButton } from "@/components/edi/edi-send-button";
import { BackButton } from "@/components/ui-dark/back-button";
import { BranchTag } from "@/components/layout/branch-tag";
import { formatQty, qtyStep } from "@/lib/quantity";

export const metadata = { title: "Invoice" };

const statusTone = {
  DRAFT: "slate",
  SENT: "blue",
  PAID: "green",
  OVERDUE: "red",
} as const;

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; why?: string }>;
}) {
  const { id } = await params;
  const { error, why } = await searchParams;
  const session = await verifySession();
  // Late invoices show as Overdue even between scheduler runs.
  await markOverdueInvoices(session.companyId);

  const invoice = await db.invoice.findUnique({
    where: { id, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      branch: { select: { name: true } },
      customer: true,
      lineItems: { include: { product: { select: { unit: true } } } },
      order: { select: { id: true, orderNumber: true } },
      _count: { select: { transactions: true } },
      payments: { orderBy: { paidAt: "asc" }, select: { id: true, amount: true, paidAt: true, method: true, reference: true } },
      creditNotes: { orderBy: { createdAt: "asc" }, select: { id: true, creditNumber: true, amount: true, reason: true, createdAt: true } },
    },
  });

  if (!invoice) notFound();

  const editable = canEditInvoice(invoice.status, invoice);
  const balance = balanceDue(invoice);
  const methodLabel = (m: string) => PAYMENT_METHODS.find((x) => x.id === m)?.label ?? m;
  const isManager = hasRole(session, ["OWNER", "ADMIN"]);
  const deletable = canDeleteInvoice({ status: invoice.status, hasBookedIncome: invoice._count.transactions > 0 });
  const subtotal = computeInvoiceSubtotal(invoice.lineItems);
  const taxAmount = computeInvoiceTax(subtotal, invoice.taxRate);

  const products = await db.product.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true, sku: true, unitPrice: true },
    orderBy: { name: "asc" },
  });

  const documents = await db.document.findMany({
    where: { companyId: session.companyId, entityType: "INVOICE", entityId: invoice.id },
    select: { id: true, filename: true, size: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/invoicing" label="Back to invoices" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-mono text-2xl font-semibold text-slate-50 light:text-slate-900">{invoice.invoiceNumber}</h1>
              <StatusBadge status={invoice.status} tone={statusTone[invoice.status]} />
              <BranchTag name={invoice.branch?.name} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">{invoice.customer.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              Issued {formatDate(invoice.issueDate)} · Due{" "}
              {formatDate(invoice.dueDate)}
              {invoice.sentAt && <> · Emailed {formatDate(invoice.sentAt)}</>}
              {invoice.order && (
                <>
                  {" · from order "}
                  <Link href={`/dashboard/sales/${invoice.order.id}`} className="font-mono text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800">
                    {invoice.order.orderNumber}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form action={sendInvoiceEmail.bind(null, invoice.id)}>
              <Button type="submit" variant="secondary" size="sm">
                <Send className="h-4 w-4" />
                {invoice.sentAt ? "Resend" : "Send invoice"}
              </Button>
            </form>
            <LinkButton href={`/api/invoices/${invoice.id}/pdf`} variant="secondary" size="sm">
              <Download className="h-4 w-4" />
              PDF
            </LinkButton>
            <EdiSendButton docType="810" recordId={invoice.id} customerId={invoice.customerId} />
            {invoice.status !== "PAID" && <InvoiceStatusForm invoiceId={invoice.id} status={invoice.status} />}
            {isManager && deletable && <DeleteButton action={deleteInvoice.bind(null, invoice.id)} />}
          </div>
        </div>

        <ErrorBanner code={error} />
        {why && <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 light:text-red-700">{why}</p>}

        {editable && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateInvoiceDetails.bind(null, invoice.id)} className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="inv-due">Due date</Label>
                  <Input id="inv-due" name="dueDate" type="date" required defaultValue={invoice.dueDate.toISOString().slice(0, 10)} />
                </div>
                <div>
                  <Label htmlFor="inv-tax">Tax rate (%)</Label>
                  <Input id="inv-tax" name="taxRate" type="number" min="0" max="100" step="0.01" required defaultValue={invoice.taxRate} className="w-28" />
                </div>
                <SubmitButton variant="secondary" pendingText="Saving...">
                  Save
                </SubmitButton>
              </form>
              {invoice.sentAt && <p className="mt-2 text-xs text-slate-500">Already emailed: resend it after changing anything the customer should see.</p>}
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.lineItems.length > 0 && (
              <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                {invoice.lineItems.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-50 light:text-slate-900">{item.description}</p>
                      <p className="text-xs tabular-nums text-slate-500">
                        {formatQty(item.quantity, item.product?.unit)} × {formatCurrency(item.unitPrice)} ={" "}
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </p>
                      {editable && (
                        <details className="mt-1">
                          <summary className="cursor-pointer list-none text-xs font-medium text-blue-400 hover:text-blue-300 light:text-blue-700">Edit</summary>
                          <form action={updateInvoiceLineItem.bind(null, invoice.id, item.id)} className="mt-2 flex flex-wrap items-end gap-2">
                            <Input name="description" defaultValue={item.description} required aria-label="Description" className="min-w-48 flex-1" />
                            <Input name="quantity" type="number" min="0.001" step={item.product ? qtyStep(item.product.unit) : "any"} defaultValue={item.quantity} required aria-label="Quantity" className="w-20" />
                            <Input name="unitPrice" type="number" min="0" step="0.01" defaultValue={item.unitPrice} required aria-label="Unit price" className="w-28" />
                            <SubmitButton variant="secondary" pendingText="Saving...">
                              Save
                            </SubmitButton>
                          </form>
                        </details>
                      )}
                    </div>
                    {editable && (
                      <DeleteButton
                        action={removeInvoiceLineItem.bind(null, invoice.id, item.id)}
                        confirmMessage="Remove this line item?"
                        label=""
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable ? (
              <InvoiceLineItemForm invoiceId={invoice.id} products={products} />
            ) : (
              <p className="text-xs text-slate-500">Payments or credit notes are recorded, so the lines are locked to match them.</p>
            )}
            <div className="mt-4 space-y-1 text-right text-sm tabular-nums">
              <p className="text-slate-400 light:text-slate-500">Subtotal: {formatCurrency(subtotal)}</p>
              {invoice.taxRate > 0 && (
                <p className="text-slate-400 light:text-slate-500">
                  Tax ({invoice.taxRate}%): {formatCurrency(taxAmount)}
                </p>
              )}
              <p className="font-semibold text-amber-400 light:text-amber-800">Total: {formatCurrency(invoice.totalAmount)}</p>
              {invoice.amountPaid > 0 && <p className="text-slate-400 light:text-slate-500">Paid: {formatCurrency(invoice.amountPaid)}</p>}
              {invoice.amountCredited > 0 && <p className="text-slate-400 light:text-slate-500">Credited: {formatCurrency(invoice.amountCredited)}</p>}
              {(invoice.amountPaid > 0 || invoice.amountCredited > 0) && (
                <p className={`font-semibold ${balance > 0 ? "text-red-400 light:text-red-700" : "text-emerald-400 light:text-emerald-700"}`}>
                  Balance due: {formatCurrency(balance)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {invoice.payments.length === 0 ? (
                <p className="text-slate-500">No payments recorded yet.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                  {invoice.payments.map((pay) => (
                    <li key={pay.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <p className="tabular-nums text-slate-50 light:text-slate-900">{formatCurrency(pay.amount)}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(pay.paidAt)} · {methodLabel(pay.method)}
                          {pay.reference && ` · ${pay.reference}`}
                        </p>
                      </div>
                      {isManager && (
                        <DeleteButton
                          action={deleteInvoicePayment.bind(null, invoice.id, pay.id)}
                          confirmMessage="Remove this payment? Its income comes out of Accounting too."
                          label=""
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {balance > 0 && invoice.totalAmount > 0 && (
                <form action={recordInvoicePayment.bind(null, invoice.id)} className="space-y-3 border-t border-white/[0.06] pt-4 light:border-slate-200">
                  <p className="font-medium text-slate-200 light:text-slate-800">Record a payment</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="pay-amount">Amount</Label>
                      <Input id="pay-amount" name="amount" type="number" min="0.01" step="0.01" max={balance} defaultValue={balance} required />
                    </div>
                    <div>
                      <Label htmlFor="pay-date">Paid on</Label>
                      <Input id="pay-date" name="paidAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} />
                    </div>
                    <div>
                      <Label htmlFor="pay-method">Method</Label>
                      <Select id="pay-method" name="method" defaultValue="BANK_TRANSFER">
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="pay-ref">Reference</Label>
                      <Input id="pay-ref" name="reference" maxLength={100} placeholder="Optional" />
                    </div>
                  </div>
                  <SubmitButton pendingText="Recording...">Record payment</SubmitButton>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credit notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {invoice.creditNotes.length === 0 ? (
                <p className="text-slate-500">No credit notes. Use one to lower what the customer owes, for example a price correction.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                  {invoice.creditNotes.map((cn) => (
                    <li key={cn.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-slate-50 light:text-slate-900">
                          <span className="font-mono">{cn.creditNumber}</span> · <span className="tabular-nums">{formatCurrency(cn.amount)}</span>
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {formatDate(cn.createdAt)} · {cn.reason}
                        </p>
                      </div>
                      {isManager && (
                        <DeleteButton action={deleteCreditNote.bind(null, invoice.id, cn.id)} confirmMessage="Remove this credit note?" label="" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isManager && balance > 0 && invoice.totalAmount > 0 && (
                <form action={createCreditNote.bind(null, invoice.id)} className="space-y-3 border-t border-white/[0.06] pt-4 light:border-slate-200">
                  <p className="font-medium text-slate-200 light:text-slate-800">Issue a credit note</p>
                  <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                    <div>
                      <Label htmlFor="cn-amount">Amount</Label>
                      <Input id="cn-amount" name="amount" type="number" min="0.01" step="0.01" max={balance} required />
                    </div>
                    <div>
                      <Label htmlFor="cn-reason">Reason</Label>
                      <Input id="cn-reason" name="reason" maxLength={500} required placeholder="What the customer will see" />
                    </div>
                  </div>
                  <SubmitButton variant="secondary" pendingText="Issuing...">
                    Issue credit note
                  </SubmitButton>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <DocumentsSection
          entityType="INVOICE"
          entityId={invoice.id}
          redirectPath={`/dashboard/invoicing/${invoice.id}`}
          documents={documents}
        />

      </div>
    </div>
  );
}
