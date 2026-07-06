import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { InvoiceForm } from "@/components/invoicing/invoice-form";
import { createInvoice } from "@/lib/actions/invoicing";
import { dateInputDaysFromNow } from "@/lib/utils";

export default async function NewInvoicePage() {
  const session = await verifySession();

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const defaultDueDate = dateInputDaysFromNow(30);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New invoice</h1>
      <div className="mt-6">
        <InvoiceForm
          action={createInvoice}
          customers={customers}
          defaultDueDate={defaultDueDate}
          submitLabel="Create invoice"
        />
      </div>
    </div>
  );
}
