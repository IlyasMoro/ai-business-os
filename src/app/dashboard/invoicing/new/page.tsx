import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchPicker } from "@/lib/branches";
import { InvoiceForm } from "@/components/invoicing/invoice-form";
import { createInvoice } from "@/lib/actions/invoicing";
import { dateInputDaysFromNow } from "@/lib/utils";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function NewInvoicePage() {
  const session = await verifySession();
  const branches = await branchPicker();

  const [customers, company] = await Promise.all([
    db.customer.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.company.findUnique({ where: { id: session.companyId }, select: { defaultTaxRate: true } }),
  ]);

  const defaultDueDate = dateInputDaysFromNow(30);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/invoicing" label="Back to invoices" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New invoice</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <InvoiceForm branches={branches}
            action={createInvoice}
            customers={customers}
            defaultDueDate={defaultDueDate}
            defaultTaxRate={company?.defaultTaxRate ?? 0}
            submitLabel="Create invoice"
          />
        </div>
      </div>
    </div>
  );
}
