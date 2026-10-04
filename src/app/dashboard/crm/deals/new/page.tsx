import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { createDeal } from "@/lib/actions/pipeline";
import { DealForm } from "@/components/crm/deal-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BackButton } from "@/components/ui-dark/back-button";

export const metadata = { title: "New deal" };

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; error?: string }>;
}) {
  const session = await verifySession();
  const { customer, error } = await searchParams;

  const [customers, users] = await Promise.all([
    db.customer.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const preselected = customers.some((c) => c.id === customer) ? customer : undefined;
  // From a customer page, go back there after saving; otherwise open the new deal.
  const back = preselected ? `/dashboard/crm/${preselected}` : undefined;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href={back ?? "/dashboard/crm/deals"} label={back ? "Back to customer" : "Back to deals"} />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New deal</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ErrorBanner code={error} />
          {customers.length === 0 ? (
            <p className="text-sm text-slate-400">Add a customer first; every deal belongs to one.</p>
          ) : (
            <DealForm
              action={createDeal}
              customers={customers}
              customerId={preselected}
              users={users}
              currentUserId={session.userId}
              back={back}
              submitLabel="Create deal"
            />
          )}
        </div>
      </div>
    </div>
  );
}
