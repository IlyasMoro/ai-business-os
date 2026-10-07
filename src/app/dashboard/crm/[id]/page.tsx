import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge, StatusBadge } from "@/components/ui-dark/badge";
import { LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ContactForm } from "@/components/crm/contact-form";
import { QuoteListCard } from "@/components/quotes/quote-list-card";
import { lockedWhere } from "@/lib/branches";
import { DocumentsSection } from "@/components/documents/documents-section";
import { deleteCustomer, deleteContact } from "@/lib/actions/crm";
import { getCustomerOutstandingBalance } from "@/lib/customer-balance";
import { Pencil } from "lucide-react";
import { BackButton } from "@/components/ui-dark/back-button";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { FollowUpList } from "@/components/crm/follow-up-list";
import { sourceLabel, stageInfo } from "@/lib/crm-pipeline";
import { Plus } from "lucide-react";
import { customerScope } from "@/lib/crm-access";
import { refreshLeadScores } from "@/lib/lead-score-data";
import { hasFeature } from "@/lib/plan-limits";
import { asCustomValues, formatCustomValue } from "@/lib/custom-fields";
import { TagChips, ScoreBadge } from "@/components/crm/crm-chips";
import { LeadScoreCard } from "@/components/crm/lead-score-card";
import { CustomerSequences } from "@/components/crm/customer-sequences";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { getWhatsAppContext } from "@/lib/whatsapp-context";

export const metadata = { title: "Customer" };

const dealStageTone = { NEW: "slate", QUALIFIED: "blue", PROPOSAL: "purple", NEGOTIATION: "yellow", WON: "green", LOST: "red" } as const;

const statusTone = {
  LEAD: "yellow",
  ACTIVE: "green",
  INACTIVE: "slate",
} as const;

const orderStatusTone = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  FULFILLED: "green",
  CANCELLED: "red",
} as const;

const invoiceStatusTone = {
  DRAFT: "slate",
  SENT: "blue",
  PAID: "green",
  OVERDUE: "red",
} as const;

const ticketStatusTone = {
  OPEN: "blue",
  IN_PROGRESS: "purple",
  RESOLVED: "green",
  CLOSED: "slate",
} as const;

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; merged?: string; enrolled?: string }>;
}) {
  const { id } = await params;
  const { error, merged, enrolled } = await searchParams;
  const session = await verifySession();

  const customer = await db.customer.findFirst({
    where: { id, companyId: session.companyId, ...(await customerScope()) },
    include: {
      contacts: true,
      owner: { select: { name: true } },
      tags: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
    },
  });

  if (!customer) notFound();

  const [documents, orders, invoices, tickets, outstandingBalance, deals, activities, followUps, users, quotes, fields, scores, sequencesAllowed, enrollments, sequences] = await Promise.all([
    db.document.findMany({
      where: { companyId: session.companyId, entityType: "CUSTOMER", entityId: customer.id },
      select: { id: true, filename: true, size: true, mimeType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.invoice.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.ticket.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getCustomerOutstandingBalance(customer.id),
    db.deal.findMany({
      where: { customerId: customer.id },
      orderBy: [{ closedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      select: { id: true, title: true, value: true, stage: true, expectedClose: true },
    }),
    db.crmActivity.findMany({
      where: { customerId: customer.id },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { author: { select: { name: true } }, deal: { select: { id: true, title: true } } },
    }),
    db.followUp.findMany({
      where: { customerId: customer.id },
      orderBy: { dueAt: "asc" },
      include: { assignee: { select: { name: true } }, deal: { select: { id: true, title: true } } },
    }),
    db.user.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.quote.findMany({
      where: { customerId: customer.id, ...(await lockedWhere()) },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, quoteNumber: true, status: true, validUntil: true, totalAmount: true, createdAt: true },
    }),
    db.customField.findMany({
      where: { companyId: session.companyId },
      select: { id: true, label: true, type: true, options: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    // Scored fresh on every visit, so the page and the list never disagree.
    refreshLeadScores(session.companyId, [customer.id]),
    hasFeature(session.companyId, "automation"),
    db.sequenceEnrollment.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        sent: true,
        nextSendAt: true,
        endReason: true,
        sequence: { select: { id: true, name: true, active: true, _count: { select: { steps: true } } } },
      },
    }),
    db.emailSequence.findMany({
      where: { companyId: session.companyId, active: true, steps: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const score = scores.get(customer.id) ?? { score: customer.leadScore, reasons: [] };
  const wa = await getWhatsAppContext();
  const customValues = asCustomValues(customer.customFields);
  const back = `/dashboard/crm/${customer.id}`;

  const overLimit = customer.creditLimit != null && outstandingBalance > customer.creditLimit;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/crm" label="Back to customers" />
        <ErrorBanner code={error} />
        {merged && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
            Merged {Number(merged) || 1} duplicate {Number(merged) === 1 ? "record" : "records"} into this customer. Their deals, history, quotes and orders are all here now.
          </div>
        )}
        {enrolled && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
            Added to the sequence. The first email goes out when it&apos;s due.
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{customer.name}</h1>
              <StatusBadge status={customer.status} tone={statusTone[customer.status]} />
              <ScoreBadge score={score.score} />
              {customer.emailOptOut && <Badge tone="slate">Unsubscribed</Badge>}
            </div>
            {customer.company && <p className="mt-1 text-slate-400 light:text-slate-500">{customer.company}</p>}
            <TagChips tags={customer.tags} className="mt-2 flex" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WhatsAppButton
              number={wa.number(customer.phone)}
              customerId={customer.id}
              customerName={customer.name}
              senderName={wa.senderName}
              myCompany={wa.myCompany}
            />
            <LinkButton href={`/dashboard/crm/${customer.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </LinkButton>
            <DeleteButton action={deleteCustomer.bind(null, customer.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Email</p>
              <p className="text-slate-50 light:text-slate-900">{customer.email ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="text-slate-50 light:text-slate-900">{customer.phone ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-slate-500">Account owner</p>
              <p className="text-slate-50 light:text-slate-900">{customer.owner?.name ?? "No owner"}</p>
            </div>
            <div>
              <p className="text-slate-500">Lead source</p>
              <p className="text-slate-50 light:text-slate-900">{sourceLabel(customer.source) ?? "Not known"}</p>
            </div>
            <div>
              <p className="text-slate-500">Outstanding balance</p>
              <p className={overLimit ? "tabular-nums text-red-400" : "tabular-nums text-slate-50 light:text-slate-900"}>
                {formatCurrency(outstandingBalance)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Credit limit</p>
              <p className="tabular-nums text-slate-50 light:text-slate-900">
                {customer.creditLimit != null ? `${formatCurrency(customer.creditLimit)}` : "No limit"}
              </p>
              {overLimit && (
                <Badge tone="red" className="mt-1">
                  Over limit
                </Badge>
              )}
            </div>
            {fields.map((field) => (
              <div key={field.id}>
                <p className="text-slate-500">{field.label}</p>
                <p className="text-slate-50 light:text-slate-900">{formatCustomValue(field, customValues[field.id]) ?? "Not set"}</p>
              </div>
            ))}
            {customer.notes && (
              <div className="col-span-2">
                <p className="text-slate-500">Notes</p>
                <p className="whitespace-pre-wrap text-slate-50 light:text-slate-900">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <LeadScoreCard score={score.score} reasons={score.reasons} />
          <CustomerSequences
            customerId={customer.id}
            enrollments={enrollments}
            sequences={sequences}
            allowed={sequencesAllowed}
            blocked={customer.emailOptOut ? "unsubscribed" : customer.email ? null : "no-email"}
          />
        </div>

        {/* Sales work: deals and reminders side by side, then the history. */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Deals ({deals.length})</CardTitle>
              <LinkButton href={`/dashboard/crm/deals/new?customer=${customer.id}`} variant="secondary" size="sm">
                <Plus className="h-4 w-4" />
                New deal
              </LinkButton>
            </CardHeader>
            <CardContent>
              {deals.length === 0 ? (
                <p className="text-sm text-slate-500">No deals yet. Add one to track it on the pipeline.</p>
              ) : (
                <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                  {deals.map((deal) => (
                    <li key={deal.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <Link href={`/dashboard/crm/deals/${deal.id}`} className="min-w-0 truncate font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                        {deal.title}
                      </Link>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums text-slate-300 light:text-slate-600">{formatCurrency(deal.value, { cents: false })}</span>
                        <Badge tone={dealStageTone[deal.stage]}>{stageInfo(deal.stage).label}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <FollowUpList customerId={customer.id} back={back} followUps={followUps} users={users} currentUserId={session.userId} />
        </div>

        <div className="mt-6">
          <ActivityTimeline
            customerId={customer.id}
            back={back}
            activities={activities}
            currentUserId={session.userId}
            isAdmin={hasRole(session, ["OWNER", "ADMIN"])}
          />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.contacts.length > 0 && (
              <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                {customer.contacts.map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-50 light:text-slate-900">
                        {contact.name}{" "}
                        {contact.role && (
                          <span className="font-normal text-slate-500">· {contact.role}</span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No email or phone"}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1">
                      {wa.number(contact.phone) && (
                        <WhatsAppButton
                          number={wa.number(contact.phone)}
                          customerId={customer.id}
                          customerName={contact.name}
                          senderName={wa.senderName}
                          myCompany={wa.myCompany}
                        />
                      )}
                      <DeleteButton
                        action={deleteContact.bind(null, customer.id, contact.id)}
                        confirmMessage="Remove this contact?"
                        label=""
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ContactForm customerId={customer.id} />
          </CardContent>
        </Card>

        <QuoteListCard className="mt-6" quotes={quotes} newHref={`/dashboard/quotes/new?customer=${customer.id}`} />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Orders ({orders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-slate-500">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {orders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      href={`/dashboard/sales/${order.id}`}
                      className="text-slate-300 light:text-slate-600 hover:text-blue-400"
                    >
                      <span className="font-mono">{order.orderNumber}</span>
                      <span className="text-slate-500"> · {formatDate(order.createdAt)}</span>
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-slate-500">{formatCurrency(order.totalAmount)}</span>
                      <StatusBadge status={order.status} tone={orderStatusTone[order.status]} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invoices ({invoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      href={`/dashboard/invoicing/${invoice.id}`}
                      className="text-slate-300 light:text-slate-600 hover:text-blue-400"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-slate-500">{formatCurrency(invoice.totalAmount)}</span>
                      <StatusBadge status={invoice.status} tone={invoiceStatusTone[invoice.status]} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Tickets ({tickets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <p className="text-sm text-slate-500">No tickets yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {tickets.map((ticket) => (
                  <li key={ticket.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      href={`/dashboard/support/${ticket.id}`}
                      className="text-slate-300 light:text-slate-600 hover:text-blue-400"
                    >
                      {ticket.subject}
                    </Link>
                    <StatusBadge status={ticket.status} tone={ticketStatusTone[ticket.status]} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <DocumentsSection
          entityType="CUSTOMER"
          entityId={customer.id}
          redirectPath={`/dashboard/crm/${customer.id}`}
          documents={documents}
        />

      </div>
    </div>
  );
}
