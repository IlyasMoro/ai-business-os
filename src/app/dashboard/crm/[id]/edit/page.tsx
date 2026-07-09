import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { CustomerForm } from "@/components/crm/customer-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { updateCustomer } from "@/lib/actions/crm";

export default async function EditCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const customer = await db.customer.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!customer) notFound();

  const action = updateCustomer.bind(null, customer.id);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50">Edit customer</h1>
      <div className="mt-6 max-w-xl">
        <ErrorBanner code={error} />
        <CustomerForm action={action} defaultValues={customer} submitLabel="Save changes" />
      </div>
    </div>
  );
}
