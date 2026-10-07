import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Download, Eye, Link2, Mail, PenLine } from "lucide-react";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { lockedWhere } from "@/lib/branches";
import {
  acceptQuote,
  declineQuote,
  deleteQuote,
  duplicateQuote,
  emailQuote,
  markQuoteSent,
  removeQuoteItem,
  shareQuoteLink,
  updateQuoteDetails,
} from "@/lib/actions/quotes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { BackButton } from "@/components/ui-dark/back-button";
import { Input, Label, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { buttonStyles } from "@/components/ui-dark/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BranchTag } from "@/components/layout/branch-tag";
import { QuoteItemForm } from "@/components/quotes/quote-item-form";
import { ActionButton } from "@/components/quotes/confirm-action";
import { QuoteStatusBadge, money, shortDate } from "@/components/quotes/quote-parts";
import { acceptBlocker, displayStatus, isEditable } from "@/lib/quotes";
import { quoteScope } from "@/lib/crm-access";
import { quoteLink } from "@/lib/quote-accept";
import { CopyField } from "@/components/ui-dark/copy-field";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { getWhatsAppContext } from "@/lib/whatsapp-context";
import { formatQty } from "@/lib/quantity";

export const metadata = { title: "Quote" };

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; sent?: string; link?: string }>;
}) {
  const { id } = await params;
  const { error, saved, sent, link } = await searchParams;
  const session = await verifySession();

  const quote = await db.quote.findFirst({
    where: { id, companyId: session.companyId, ...(await lockedWhere()), ...(await quoteScope()) },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      deal: { select: { id: true, title: true } },
      owner: { select: { name: true } },
      branch: { select: { name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      items: { include: { product: { select: { name: true, sku: true, unit: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!quote) notFound();

  const editable = isEditable(quote.status);
  const products = editable
    ? await db.product.findMany({
        where: { companyId: session.companyId },
        select: { id: true, name: true, sku: true, unitPrice: true },
        orderBy: { name: "asc" },
      })
    : [];

  const shown = displayStatus(quote);
  const blocker = acceptBlocker({ status: quote.status, validUntil: quote.validUntil, itemCount: quote.items.length });
  const canDelete = quote.ownerId === session.userId || hasRole(session, ["OWNER", "ADMIN"]);
  const customerLink = quote.publicToken ? quoteLink(quote.publicToken) : null;
  const wa = await getWhatsAppContext();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/quotes" label="Back to quotes" />
        <ErrorBanner code={error} />
        {(saved || sent) && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
            {sent ? `Quote emailed to ${quote.customer.email}, with a link to accept it online.` : "Saved."}
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold text-slate-50 light:text-slate-900">{quote.quoteNumber}</h1>
              <QuoteStatusBadge status={shown} />
              <BranchTag name={quote.branch?.name} />
            </div>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              For{" "}
              <Link href={`/dashboard/crm/${quote.customer.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                {quote.customer.name}
              </Link>
              {quote.deal && (
                <>
                  {" · deal "}
                  <Link href={`/dashboard/crm/deals/${quote.deal.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                    {quote.deal.title}
                  </Link>
                </>
              )}
              {" · created "}
              {shortDate(quote.createdAt)}
              {quote.owner && ` by ${quote.owner.name}`}
              {quote.sentAt && ` · sent ${shortDate(quote.sentAt)}`}
            </p>
            {quote.viewedAt && quote.status === "SENT" && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-blue-300 light:text-blue-700">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                The customer opened it online on {shortDate(quote.viewedAt)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noopener" className={buttonStyles("secondary", "sm")}>
              <Download className="h-4 w-4" />
              PDF
            </a>
            <ActionButton action={duplicateQuote.bind(null, quote.id)}>
              <Copy className="h-4 w-4" />
              Copy to new quote
            </ActionButton>
            {canDelete && (
              <DeleteButton action={deleteQuote.bind(null, quote.id)} confirmMessage={`Delete quote ${quote.quoteNumber}?`} label="Delete" />
            )}
          </div>
        </div>

        {/* What happens next, in the order it usually happens. */}
        {editable ? (
          <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.09] p-4 glass light:border-white/80">
            <p className="mr-auto text-sm text-slate-300 light:text-slate-600">
              {quote.status === "DRAFT"
                ? "Add the products, then send the quote to the customer."
                : shown === "EXPIRED"
                  ? "This quote has expired. Move the valid until date to reopen it, or copy it to a new quote."
                  : "Waiting for the customer. Record their answer here."}
            </p>
            {quote.customer.email ? (
              <ActionButton action={emailQuote.bind(null, quote.id)} variant={quote.status === "DRAFT" ? "primary" : "secondary"}>
                <Mail className="h-4 w-4" />
                {quote.status === "DRAFT" ? "Email to customer" : "Email again"}
              </ActionButton>
            ) : (
              <span className="text-xs text-slate-500">Add an email to the customer to send it from here.</span>
            )}
            {quote.items.length > 0 && shown !== "EXPIRED" && (
              <WhatsAppButton
                number={wa.number(quote.customer.phone)}
                customerId={quote.customer.id}
                customerName={quote.customer.name}
                senderName={wa.senderName}
                myCompany={wa.myCompany}
                dealId={quote.dealId ?? undefined}
                quote={{ id: quote.id, number: quote.quoteNumber }}
                size="md"
                label="Send on WhatsApp"
              />
            )}
            {quote.status === "DRAFT" && <ActionButton action={markQuoteSent.bind(null, quote.id)}>Mark as sent</ActionButton>}
            {!customerLink && quote.items.length > 0 && shown !== "EXPIRED" && (
              <ActionButton action={shareQuoteLink.bind(null, quote.id)}>
                <Link2 className="h-4 w-4" />
                Get a link
              </ActionButton>
            )}
            {!blocker && (
              <ActionButton
                action={acceptQuote.bind(null, quote.id)}
                variant="primary"
                confirmMessage={`Mark ${quote.quoteNumber} as accepted and create an order for ${money(quote.totalAmount, true)}?${quote.deal ? " The deal will be marked as won." : ""}`}
              >
                Accept and create order
              </ActionButton>
            )}
            {quote.status === "SENT" && (
              <ActionButton action={declineQuote.bind(null, quote.id)} variant="danger" confirmMessage={`Mark ${quote.quoteNumber} as declined?`}>
                Customer declined
              </ActionButton>
            )}
          </div>
        ) : quote.order ? (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300 light:text-emerald-800">
            {quote.signedName ? (
              <span className="mb-1 flex items-center gap-1.5 font-medium">
                <PenLine className="h-4 w-4" aria-hidden />
                Accepted online by {quote.signedName}
                {quote.decidedAt ? ` on ${formatDateTime(quote.decidedAt)}` : ""}
                {quote.signedIp ? ` from ${quote.signedIp}` : ""}.
              </span>
            ) : null}
            Accepted {quote.decidedAt && shortDate(quote.decidedAt)}.{" "}
            <Link href={`/dashboard/sales/${quote.order.id}`} className="font-medium underline">
              Open order {quote.order.orderNumber}
            </Link>{" "}
            ({quote.order.status.toLowerCase()}).
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-white/[0.09] p-4 text-sm text-slate-400 glass light:border-white/80">
            {quote.status === "ACCEPTED" ? "Accepted, but its order has since been deleted." : `Declined ${quote.decidedAt ? shortDate(quote.decidedAt) : ""}.`}{" "}
            {quote.declineReason && <span className="text-slate-300 light:text-slate-600">Their reason: &ldquo;{quote.declineReason}&rdquo;. </span>}
            Copy it to a new quote to offer again.
          </div>
        )}

        {editable && customerLink && (
          <div id="share" className="mt-4 scroll-mt-24 rounded-xl border border-white/[0.09] p-4 glass light:border-white/80">
            <p className="mb-2 text-sm font-medium text-slate-200 light:text-slate-700">
              {link ? "Here is the customer's link. " : "Customer link. "}
              <span className="font-normal text-slate-400 light:text-slate-500">They can view the quote and accept it online by typing their name.</span>
            </p>
            <CopyField value={customerLink} label="Customer link to the quote" />
          </div>
        )}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
              {quote.items.length === 0 ? (
                <p className="mb-4 text-sm text-slate-500">No products on this quote yet.</p>
              ) : (
                <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                  {quote.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-50 light:text-slate-900">{item.product.name}</p>
                        <p className="text-xs tabular-nums text-slate-500">
                          {formatQty(item.quantity, item.product.unit)} × {money(item.unitPrice, true)} = {money(item.quantity * item.unitPrice, true)}
                        </p>
                      </div>
                      {editable && (
                        <DeleteButton action={removeQuoteItem.bind(null, quote.id, item.id)} confirmMessage="Remove this line?" label="" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {editable && <QuoteItemForm quoteId={quote.id} products={products} />}
              <p className="mt-4 text-right text-sm font-semibold tabular-nums text-amber-400 light:text-amber-700">
                Total: {money(quote.totalAmount, true)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Terms</CardTitle>
            </CardHeader>
            <CardContent>
              {editable ? (
                <form action={updateQuoteDetails.bind(null, quote.id)} className="space-y-4">
                  <div>
                    <Label htmlFor="validUntil">Valid until</Label>
                    <Input id="validUntil" name="validUntil" type="date" defaultValue={quote.validUntil?.toISOString().slice(0, 10) ?? ""} />
                    <p className="mt-1 text-xs text-slate-500">Leave empty for no time limit.</p>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes for the customer</Label>
                    <Textarea id="notes" name="notes" rows={4} maxLength={5000} defaultValue={quote.notes ?? ""} />
                  </div>
                  <SubmitButton pendingText="Saving..." variant="secondary">
                    Save terms
                  </SubmitButton>
                </form>
              ) : (
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Valid until</dt>
                    <dd className="text-slate-200 light:text-slate-800">{quote.validUntil ? shortDate(quote.validUntil) : "No limit"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Notes</dt>
                    <dd className="whitespace-pre-line text-slate-200 light:text-slate-800">{quote.notes || "None"}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
