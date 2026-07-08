import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { CustomerForm } from "@/components/crm/customer-form";
import { updateCustomer } from "@/lib/actions/crm";
import type { CustomerFormState } from "@/lib/validation/crm";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const customer = await db.customer.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!customer) notFound();

  const action = updateCustomer.bind(null, customer.id) as (
    state: CustomerFormState,
    formData: FormData
  ) => Promise<CustomerFormState>;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-[#0B1120] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50">Edit customer</h1>
      <div className="mt-6">
        <CustomerForm action={action} defaultValues={customer} submitLabel="Save changes" />
      </div>
    </div>
  );
}
