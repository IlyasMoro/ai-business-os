import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { CustomerForm } from "@/components/crm/customer-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { createCustomer } from "@/lib/actions/crm";
import { BackButton } from "@/components/ui-dark/back-button";

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
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/crm" label="Back to customers" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New customer</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ErrorBanner code={error} />
          <CustomerForm action={createCustomer} campaigns={campaigns} submitLabel="Create customer" />
        </div>
      </div>
    </div>
  );
}
