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
import { deleteInvoice, removeInvoiceLineItem, sendInvoiceEmail, undoInvoicePayment } from "@/lib/actions/invoicing";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { markOverdueInvoices } from "@/lib/invoice-number";
import { canDeleteInvoice, canEditInvoice } from "@/lib/invoice-rules";
import { computeInvoiceSubtotal, computeInvoiceTax } from "@/lib/invoicing-math";
import { Download, Send } from "lucide-react";
import { EdiSendButton } from "@/components/edi/edi-send-button";
import { BackButton } from "@/components/ui-dark/back-button";
import { BranchTag } from "@/components/layout/branch-tag";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();
  // Late invoices show as Overdue even between scheduler runs.
  await markOverdueInvoices(session.companyId);

  const invoice = await db.invoice.findUnique({
    where: { id, companyId: session.companyId, ...(await lockedWhere()) },
    include: {
      branch: { select: { name: true } },
      customer: true,
      lineItems: true,
      order: { select: { id: true, orderNumber: true } },
      _count: { select: { transactions: true } },
    },
  });

  if (!invoice) notFound();

  const editable = canEditInvoice(invoice.status);
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
    select: { id: true, filename: true, size: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/invoicing" label="Back to invoices" />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold text-slate-50 light:text-slate-900">{invoice.invoiceNumber}</h1>
              <StatusBadge status={invoice.status} tone={statusTone[invoice.status]} />
              <BranchTag name={invoice.branch?.name} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">{invoice.customer.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              Issued {invoice.issueDate.toLocaleDateString()} · Due{" "}
              {invoice.dueDate.toLocaleDateString()}
              {invoice.sentAt && <> · Emailed {invoice.sentAt.toLocaleDateString()}</>}
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
            {invoice.status === "PAID" ? (
              isManager && (
                <form action={undoInvoicePayment.bind(null, invoice.id)}>
                  <SubmitButton variant="secondary" pendingText="Undoing...">
                    Undo payment
                  </SubmitButton>
                </form>
              )
            ) : (
              <InvoiceStatusForm invoiceId={invoice.id} status={invoice.status} />
            )}
            {isManager && deletable && <DeleteButton action={deleteInvoice.bind(null, invoice.id)} />}
          </div>
        </div>

        <ErrorBanner code={error} />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.lineItems.length > 0 && (
              <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                {invoice.lineItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-50 light:text-slate-900">{item.description}</p>
                      <p className="text-xs tabular-nums text-slate-500">
                        {item.quantity} × ${item.unitPrice.toFixed(2)} = $
                        {(item.quantity * item.unitPrice).toFixed(2)}
                      </p>
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
              <p className="text-xs text-slate-500">This invoice is paid, so its lines are locked to match the income in Accounting.</p>
            )}
            <div className="mt-4 space-y-1 text-right text-sm tabular-nums">
              <p className="text-slate-400 light:text-slate-500">Subtotal: ${subtotal.toFixed(2)}</p>
              {invoice.taxRate > 0 && (
                <p className="text-slate-400 light:text-slate-500">
                  Tax ({invoice.taxRate}%): ${taxAmount.toFixed(2)}
                </p>
              )}
              <p className="font-semibold text-amber-400">Total: ${invoice.totalAmount.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

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
