import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { CustomerForm } from "@/components/crm/customer-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { updateCustomer } from "@/lib/actions/crm";
import { BackButton } from "@/components/ui-dark/back-button";
import { customerScope } from "@/lib/crm-access";
import { asCustomValues } from "@/lib/custom-fields";

export const metadata = { title: "Edit customer" };

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

  const customer = await db.customer.findFirst({
    where: { id, companyId: session.companyId, ...(await customerScope()) },
    include: { tags: { select: { id: true } } },
  });

  if (!customer) notFound();

  const action = updateCustomer.bind(null, customer.id);

  const [campaigns, users, tags, fields] = await Promise.all([
    db.campaign.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.customerTag.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true, color: true }, orderBy: { name: "asc" } }),
    db.customField.findMany({
      where: { companyId: session.companyId },
      select: { id: true, label: true, type: true, options: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href={`/dashboard/crm/${id}`} label="Back to customer" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Edit customer</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ErrorBanner code={error} />
          <CustomerForm
            action={action}
            defaultValues={customer}
            campaigns={campaigns}
            users={users}
            currentUserId={session.userId}
            submitLabel="Save changes"
            tags={tags}
            selectedTagIds={customer.tags.map((t) => t.id)}
            fields={fields}
            values={asCustomValues(customer.customFields)}
          />
        </div>
      </div>
    </div>
  );
}
