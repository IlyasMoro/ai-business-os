import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Plus } from "lucide-react";

const statusTone = {
  DRAFT: "slate",
  SENT: "blue",
  PAID: "green",
  OVERDUE: "red",
} as const;

export default async function InvoicingPage() {
  const session = await verifySession();

  const invoices = await db.invoice.findMany({
    where: { companyId: session.companyId },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoicing</h1>
          <p className="mt-1 text-sm text-slate-500">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
          </p>
        </div>
        <LinkButton href="/dashboard/invoicing/new">
          <Plus className="h-4 w-4" />
          New invoice
        </LinkButton>
      </div>

      <Card className="mt-6">
        {invoices.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No invoices yet. Create your first one to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Due date</th>
                <th className="px-5 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/invoicing/${invoice.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{invoice.customer.name}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[invoice.status]}>{invoice.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {invoice.dueDate.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-slate-600">${invoice.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
