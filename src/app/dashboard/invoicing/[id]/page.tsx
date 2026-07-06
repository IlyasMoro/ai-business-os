import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { InvoiceLineItemForm } from "@/components/invoicing/invoice-line-item-form";
import { InvoiceStatusForm } from "@/components/invoicing/invoice-status-form";
import { deleteInvoice, removeInvoiceLineItem } from "@/lib/actions/invoicing";

const statusTone = {
  DRAFT: "slate",
  SENT: "blue",
  PAID: "green",
  OVERDUE: "red",
} as const;

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const invoice = await db.invoice.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      lineItems: true,
    },
  });

  if (!invoice) notFound();

  const products = await db.product.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true, sku: true, unitPrice: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{invoice.invoiceNumber}</h1>
            <Badge tone={statusTone[invoice.status]}>{invoice.status}</Badge>
          </div>
          <p className="mt-1 text-slate-500">{invoice.customer.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            Issued {invoice.issueDate.toLocaleDateString()} · Due{" "}
            {invoice.dueDate.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusForm invoiceId={invoice.id} status={invoice.status} />
          <DeleteButton action={deleteInvoice.bind(null, invoice.id)} />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.lineItems.length > 0 && (
            <ul className="mb-4 divide-y divide-slate-100">
              {invoice.lineItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{item.description}</p>
                    <p className="text-slate-500">
                      {item.quantity} × ${item.unitPrice.toFixed(2)} = $
                      {(item.quantity * item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                  <DeleteButton
                    action={removeInvoiceLineItem.bind(null, invoice.id, item.id)}
                    confirmMessage="Remove this line item?"
                    label=""
                  />
                </li>
              ))}
            </ul>
          )}
          <InvoiceLineItemForm invoiceId={invoice.id} products={products} />
          <p className="mt-4 text-right text-sm font-semibold text-slate-900">
            Total: ${invoice.totalAmount.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      <p className="mt-6">
        <Link href="/dashboard/invoicing" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to invoices
        </Link>
      </p>
    </div>
  );
}
