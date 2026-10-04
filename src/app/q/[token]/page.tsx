import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { CustomerShell } from "@/components/public/customer-shell";
import { displayStatus } from "@/lib/quotes";
import { acceptQuoteOnline, declineQuoteOnline } from "./actions";
import { QuoteAnswer } from "./quote-answer";

export const metadata: Metadata = { title: "Your quote", robots: { index: false, follow: false } };

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The quote as the customer sees it from the emailed link, with Accept
 * and Decline while it is still open. */
export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  if (token.length < 20) notFound();

  const quote = await db.quote.findUnique({
    where: { publicToken: token },
    include: {
      items: { include: { product: { select: { name: true } } }, orderBy: { id: "asc" } },
      customer: { select: { name: true, company: true } },
      companyRef: { select: { id: true, name: true, logoMimeType: true } },
    },
  });
  if (!quote) notFound();

  // The first time the customer opens it, the salesperson sees it in the history.
  if (!quote.viewedAt && quote.status === "SENT") {
    const claimed = await db.quote.updateMany({ where: { id: quote.id, viewedAt: null }, data: { viewedAt: new Date() } });
    if (claimed.count > 0) {
      await db.crmActivity.create({
        data: {
          type: "NOTE",
          body: `${quote.customer.name} opened quote ${quote.quoteNumber} online.`,
          companyId: quote.companyId,
          customerId: quote.customerId,
          dealId: quote.dealId,
        },
      });
    }
  }

  const status = displayStatus(quote);
  const company = { id: quote.companyRef.id, name: quote.companyRef.name, hasLogo: Boolean(quote.companyRef.logoMimeType) };
  const accept = acceptQuoteOnline.bind(null, token);
  const decline = declineQuoteOnline.bind(null, token);

  return (
    <CustomerShell company={company}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Quote {quote.quoteNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            For {quote.customer.name}
            {quote.customer.company && quote.customer.company !== quote.customer.name ? `, ${quote.customer.company}` : ""}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{money(quote.totalAmount)}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        From {quote.companyRef.name}
        {quote.validUntil && status !== "ACCEPTED" && status !== "DECLINED" ? ` · Valid until ${day(quote.validUntil)}` : ""}
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Item</th>
              <th className="px-4 py-2.5 text-right font-medium">Qty</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{item.product.name}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{item.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(item.unitPrice)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(item.quantity * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">
                Total
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{money(quote.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {quote.notes && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{quote.notes}</p>}

      <div className="mt-8 border-t border-slate-200 pt-6">
        {status === "ACCEPTED" ? (
          <Outcome icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} title={done === "accepted" ? "Thank you, the quote is accepted" : "This quote has been accepted"}>
            {quote.signedName ? `Accepted by ${quote.signedName}` : "Accepted"}
            {quote.decidedAt ? ` on ${day(quote.decidedAt)}` : ""}. {quote.companyRef.name} will be in touch about the next steps.
          </Outcome>
        ) : status === "DECLINED" ? (
          <Outcome icon={<XCircle className="h-5 w-5 text-slate-500" />} title={done === "declined" ? "Thanks for letting us know" : "This quote was declined"}>
            If anything changes, just reply to the email this link came in, and {quote.companyRef.name} can send a new quote.
          </Outcome>
        ) : status === "EXPIRED" ? (
          <Outcome icon={<Clock className="h-5 w-5 text-amber-600" />} title="This quote has expired">
            It was valid until {quote.validUntil ? day(quote.validUntil) : "an earlier date"}. Reply to the email this link came in to ask {quote.companyRef.name} for an updated quote.
          </Outcome>
        ) : quote.items.length === 0 ? (
          <Outcome icon={<Clock className="h-5 w-5 text-slate-500" />} title="This quote isn't ready yet">
            {quote.companyRef.name} is still working on it.
          </Outcome>
        ) : (
          <>
            <h2 className="text-base font-semibold text-slate-900">Ready to go ahead?</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">Accept online and {quote.companyRef.name} will prepare your order.</p>
            <QuoteAnswer accept={accept} decline={decline} total={money(quote.totalAmount)} />
          </>
        )}
      </div>
    </CustomerShell>
  );
}

function Outcome({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{children}</p>
      </div>
    </div>
  );
}
