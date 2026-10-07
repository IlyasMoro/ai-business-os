import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { addDealItem, deleteDeal, removeDealItem, updateDeal } from "@/lib/actions/pipeline";
import { DealForm } from "@/components/crm/deal-form";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { FollowUpList } from "@/components/crm/follow-up-list";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { BackButton } from "@/components/ui-dark/back-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { stageInfo } from "@/lib/crm-pipeline";
import { lockedWhere } from "@/lib/branches";
import { QuoteListCard } from "@/components/quotes/quote-list-card";
import { dealScope } from "@/lib/crm-access";
import { WhatsAppButton } from "@/components/crm/whatsapp-button";
import { getWhatsAppContext } from "@/lib/whatsapp-context";
import { QuoteItemForm } from "@/components/quotes/quote-item-form";
import { formatQty } from "@/lib/quantity";

const STAGE_TONE = { NEW: "slate", QUALIFIED: "blue", PROPOSAL: "purple", NEGOTIATION: "yellow", WON: "green", LOST: "red" } as const;

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const session = await verifySession();

  const deal = await db.deal.findFirst({
    where: { id, companyId: session.companyId, ...(await dealScope()) },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  if (!deal) notFound();

  const [activities, followUps, users, quotes, items, products] = await Promise.all([
    db.crmActivity.findMany({
      where: { dealId: deal.id },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { author: { select: { name: true } } },
    }),
    db.followUp.findMany({
      where: { dealId: deal.id },
      orderBy: { dueAt: "asc" },
      include: { assignee: { select: { name: true } } },
    }),
    db.user.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.quote.findMany({
      where: { dealId: deal.id, ...(await lockedWhere()) },
      orderBy: { createdAt: "desc" },
      select: { id: true, quoteNumber: true, status: true, validUntil: true, totalAmount: true, createdAt: true },
    }),
    db.dealItem.findMany({ where: { dealId: deal.id }, orderBy: { id: "asc" }, include: { product: { select: { name: true, sku: true, unit: true } } } }),
    db.product.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true, sku: true, unitPrice: true }, orderBy: { name: "asc" } }),
  ]);

  const back = `/dashboard/crm/deals/${deal.id}`;
  const wa = await getWhatsAppContext();
  const isAdmin = hasRole(session, ["OWNER", "ADMIN"]);
  const canDelete = isAdmin || deal.ownerId === session.userId;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/crm/deals" label="Back to deals" />
        <ErrorBanner code={error} />
        {saved && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">Saved.</div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{deal.title}</h1>
              <Badge tone={STAGE_TONE[deal.stage]}>{stageInfo(deal.stage).label}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              <Link href={`/dashboard/crm/${deal.customer.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                {deal.customer.name}
              </Link>
              {" · "}
              <span className="tabular-nums">{formatCurrency(deal.value, { cents: false })}</span>
              {deal.closedAt && ` · closed ${formatDate(deal.closedAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <WhatsAppButton
              number={wa.number(deal.customer.phone)}
              customerId={deal.customer.id}
              customerName={deal.customer.name}
              senderName={wa.senderName}
              myCompany={wa.myCompany}
              dealId={deal.id}
            />
            {canDelete && <DeleteButton action={deleteDeal.bind(null, deal.id)} confirmMessage={`Delete the deal "${deal.title}"?`} label="Delete deal" />}
          </div>
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <DealForm
                  action={updateDeal.bind(null, deal.id)}
                  deal={deal}
                  users={users}
                  currentUserId={session.userId}
                  submitLabel="Save deal"
                  valueFromProducts={items.length > 0}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
                <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
                  What they&apos;re interested in. The deal is worth the total, and a new quote from this deal starts with these lines.
                </p>
              </CardHeader>
              <CardContent>
                {items.length > 0 && (
                  <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-50 light:text-slate-900">{item.product.name}</p>
                          <p className="text-xs tabular-nums text-slate-500">
                            {formatQty(item.quantity, item.product.unit)} × {formatCurrency(item.unitPrice)} = {formatCurrency(item.quantity * item.unitPrice)}
                          </p>
                        </div>
                        <DeleteButton action={removeDealItem.bind(null, deal.id, item.id)} confirmMessage="Remove this product from the deal?" label="" />
                      </li>
                    ))}
                  </ul>
                )}
                {products.length === 0 ? (
                  <p className="text-sm text-slate-500">Add products in Inventory first.</p>
                ) : (
                  <QuoteItemForm action={addDealItem.bind(null, deal.id)} products={products} />
                )}
                {items.length > 0 && (
                  <p className="mt-4 text-right text-sm font-semibold tabular-nums text-amber-400 light:text-amber-700">
                    Total: {formatCurrency(deal.value)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <QuoteListCard quotes={quotes} newHref={`/dashboard/quotes/new?deal=${deal.id}`} />
            <FollowUpList
              customerId={deal.customerId}
              dealId={deal.id}
              back={back}
              followUps={followUps}
              users={users}
              currentUserId={session.userId}
            />
            <ActivityTimeline
              customerId={deal.customerId}
              dealId={deal.id}
              back={back}
              activities={activities}
              currentUserId={session.userId}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
