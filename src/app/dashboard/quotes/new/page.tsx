import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchPicker } from "@/lib/branches";
import { createQuote } from "@/lib/actions/quotes";
import { BackButton } from "@/components/ui-dark/back-button";
import { BranchSelect } from "@/components/layout/branch-select";
import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { defaultValidUntil } from "@/lib/quotes";
import { DEAL_STAGES } from "@/lib/crm-pipeline";
import { customerScope, dealScope } from "@/lib/crm-access";

export const metadata = { title: "New quote" };

/** Opened from the quotes list, a customer page (?customer=) or a deal page
 * (?deal=, which also fixes the customer). */
export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; deal?: string; error?: string }>;
}) {
  const session = await verifySession();
  const { customer, deal: dealParam, error } = await searchParams;

  const [customers, deals, branches] = await Promise.all([
    db.customer.findMany({ where: { companyId: session.companyId, ...(await customerScope()) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.deal.findMany({
      where: { companyId: session.companyId, ...(await dealScope()), stage: { in: DEAL_STAGES.filter((s) => s.open).map((s) => s.id) } },
      select: { id: true, title: true, customerId: true, customer: { select: { name: true } } },
      orderBy: { title: "asc" },
    }),
    branchPicker(),
  ]);

  const deal = deals.find((d) => d.id === dealParam);
  const customerId = deal?.customerId ?? customers.find((c) => c.id === customer)?.id ?? "";
  const validUntil = defaultValidUntil().toISOString().slice(0, 10);
  const back = deal ? `/dashboard/crm/deals/${deal.id}` : customerId && customer ? `/dashboard/crm/${customerId}` : "/dashboard/quotes";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href={back} label={deal ? "Back to deal" : customer ? "Back to customer" : "Back to quotes"} />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New quote</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">Create the quote first, then add its products on the next page.</p>
        <div className="mt-4">
          <ErrorBanner code={error} />
        </div>
        <form action={createQuote} className="mt-2 space-y-4 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <div>
            <Label htmlFor="customerId">Customer</Label>
            <Select id="customerId" name="customerId" required defaultValue={customerId}>
              <option value="" disabled>
                Choose a customer
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="dealId">Deal (optional)</Label>
            <Select id="dealId" name="dealId" defaultValue={deal?.id ?? ""}>
              <option value="">No deal</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.customer.name})
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">Accepting the quote marks this deal as won. It must belong to the same customer.</p>
          </div>
          <div>
            <Label htmlFor="validUntil">Valid until</Label>
            <Input id="validUntil" name="validUntil" type="date" defaultValue={validUntil} />
          </div>
          <div>
            <Label htmlFor="notes">Notes for the customer (optional)</Label>
            <Textarea id="notes" name="notes" rows={3} maxLength={5000} placeholder="Delivery within 5 working days. Prices exclude tax." />
          </div>
          {branches && <BranchSelect {...branches} />}
          <SubmitButton pendingText="Creating...">Create quote</SubmitButton>
        </form>
      </div>
    </div>
  );
}
