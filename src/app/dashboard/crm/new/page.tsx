import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { CustomerForm } from "@/components/crm/customer-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { createCustomer } from "@/lib/actions/crm";

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await verifySession();

  const campaigns = await db.campaign.findMany({
    where: { companyId: session.companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50">New customer</h1>
      <div className="mt-6 max-w-xl">
        <ErrorBanner code={error} />
        <CustomerForm action={createCustomer} campaigns={campaigns} submitLabel="Create customer" />
      </div>
    </div>
  );
}
