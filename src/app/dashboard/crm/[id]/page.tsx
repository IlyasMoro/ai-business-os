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
import { DocumentsSection } from "@/components/documents/documents-section";
import { deleteCustomer, deleteContact } from "@/lib/actions/crm";
import { getCustomerOutstandingBalance } from "@/lib/customer-balance";
import { Pencil } from "lucide-react";
import { BackButton } from "@/components/ui-dark/back-button";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { FollowUpList } from "@/components/crm/follow-up-list";
import { sourceLabel, stageInfo } from "@/lib/crm-pipeline";
import { Plus } from "lucide-react";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const customer = await db.customer.findUnique({
    where: { id, companyId: session.companyId },
    include: { contacts: true, owner: { select: { name: true } } },
  });

  if (!customer) notFound();

  const [documents, orders, invoices, tickets, outstandingBalance, deals, activities, followUps, users] = await Promise.all([
    db.document.findMany({
      where: { companyId: session.companyId, entityType: "CUSTOMER", entityId: customer.id },
      select: { id: true, filename: true, size: true },
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
  ]);
  const back = `/dashboard/crm/${customer.id}`;

  const overLimit = customer.creditLimit != null && outstandingBalance > customer.creditLimit;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/crm" label="Back to customers" />
        <ErrorBanner code={error} />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{customer.name}</h1>
              <StatusBadge status={customer.status} tone={statusTone[customer.status]} />
            </div>
            {customer.company && <p className="mt-1 text-slate-400 light:text-slate-500">{customer.company}</p>}
          </div>
          <div className="flex items-center gap-2">
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
              <p className="text-slate-50 light:text-slate-900">{customer.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="text-slate-50 light:text-slate-900">{customer.phone ?? "—"}</p>
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
              <p className={overLimit ? "font-mono tabular-nums text-red-400" : "font-mono tabular-nums text-slate-50 light:text-slate-900"}>
                ${outstandingBalance.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Credit limit</p>
              <p className="font-mono tabular-nums text-slate-50 light:text-slate-900">
                {customer.creditLimit != null ? `$${customer.creditLimit.toFixed(2)}` : "No limit"}
              </p>
              {overLimit && (
                <Badge tone="red" className="mt-1">
                  Over limit
                </Badge>
              )}
            </div>
            {customer.notes && (
              <div className="col-span-2">
                <p className="text-slate-500">Notes</p>
                <p className="whitespace-pre-wrap text-slate-50 light:text-slate-900">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales work: deals and reminders side by side, then the history. */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
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
                        <span className="tabular-nums text-slate-300 light:text-slate-600">${Math.round(deal.value).toLocaleString("en-US")}</span>
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
                          <span className="font-normal text-slate-500">— {contact.role}</span>
                        )}
                      </p>
                      <p className="text-slate-500">
                        {[contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <DeleteButton
                      action={deleteContact.bind(null, customer.id, contact.id)}
                      confirmMessage="Remove this contact?"
                      label=""
                    />
                  </li>
                ))}
              </ul>
            )}
            <ContactForm customerId={customer.id} />
          </CardContent>
        </Card>

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
                      {order.createdAt.toLocaleDateString()}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="font-mono tabular-nums text-slate-500">${order.totalAmount.toFixed(2)}</span>
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
                      <span className="font-mono tabular-nums text-slate-500">${invoice.totalAmount.toFixed(2)}</span>
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
