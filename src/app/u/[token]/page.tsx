import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { readUnsubscribeToken } from "@/lib/unsubscribe";
import { CustomerShell, publicButton } from "@/components/public/customer-shell";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/** Stops sequence emails for one customer. It asks first rather than
 * unsubscribing on open, because mail scanners open every link. */
async function unsubscribe(token: string) {
  "use server";
  const customerId = readUnsubscribeToken(token);
  if (!customerId) notFound();
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, companyId: true, emailOptOut: true } });
  if (!customer) notFound();
  if (!customer.emailOptOut) {
    await db.$transaction([
      db.customer.update({ where: { id: customer.id }, data: { emailOptOut: true } }),
      db.sequenceEnrollment.updateMany({
        where: { customerId: customer.id, status: "ACTIVE" },
        data: { status: "STOPPED", endReason: "Unsubscribed", endedAt: new Date(), nextSendAt: null },
      }),
      db.crmActivity.create({
        data: { type: "NOTE", body: "Unsubscribed from sequence emails.", companyId: customer.companyId, customerId: customer.id },
      }),
    ]);
    revalidatePath(`/dashboard/crm/${customer.id}`);
  }
  redirect(`/u/${token}`);
}

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const customerId = readUnsubscribeToken(token);
  if (!customerId) notFound();
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { emailOptOut: true, companyRef: { select: { id: true, name: true, logoMimeType: true } } },
  });
  if (!customer) notFound();
  const company = { id: customer.companyRef.id, name: customer.companyRef.name, hasLogo: Boolean(customer.companyRef.logoMimeType) };

  return (
    <CustomerShell company={company} width="max-w-md">
      {customer.emailOptOut ? (
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {company.name} won&apos;t send you any more of these emails. You&apos;ll still get emails about your own orders, quotes and invoices.
          </p>
        </div>
      ) : (
        <form action={unsubscribe.bind(null, token)} className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Unsubscribe from {company.name}?</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            You&apos;ll stop getting their follow up emails. Emails about your own orders, quotes and invoices still come through.
          </p>
          <button type="submit" className={publicButton + " mt-6"}>
            Unsubscribe
          </button>
        </form>
      )}
    </CustomerShell>
  );
}
