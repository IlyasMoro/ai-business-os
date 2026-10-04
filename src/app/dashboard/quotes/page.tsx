import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { branchWhere } from "@/lib/branches";
import { LinkButton } from "@/components/ui-dark/button";
import { EmptyState } from "@/components/ui-dark/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { QuoteStatusBadge, money, shortDate } from "@/components/quotes/quote-parts";
import { QUOTE_STATUS_LABELS, displayStatus, type QuoteDisplayStatus } from "@/lib/quotes";
import { cn } from "@/lib/utils";
import { quoteScope } from "@/lib/crm-access";

export const metadata = { title: "Quotes" };

const FILTERS: (QuoteDisplayStatus | "ALL")[] = ["ALL", "DRAFT", "SENT", "EXPIRED", "ACCEPTED", "DECLINED"];

/** Every quote, newest first, with what is waiting on customers up top. */
export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const session = await verifySession();
  const { status, error } = await searchParams;
  const filter = FILTERS.find((f) => f === status) ?? "ALL";

  const quotes = await db.quote.findMany({
    where: { companyId: session.companyId, ...(await branchWhere()), ...(await quoteScope()) },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      validUntil: true,
      totalAmount: true,
      createdAt: true,
      customer: { select: { name: true } },
      owner: { select: { name: true } },
    },
  });

  const now = new Date();
  const rows = quotes.map((q) => ({ ...q, shown: displayStatus(q, now) }));
  const visible = filter === "ALL" ? rows : rows.filter((q) => q.shown === filter);

  const waiting = rows.filter((q) => q.shown === "SENT");
  const accepted = rows.filter((q) => q.shown === "ACCEPTED").length;
  const decided = accepted + rows.filter((q) => q.shown === "DECLINED" || q.shown === "EXPIRED").length;
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = waiting.filter((q) => q.validUntil && q.validUntil < weekAhead);

  const stats = [
    { label: "Waiting on customers", value: money(waiting.reduce((s, q) => s + q.totalAmount, 0)), note: `${waiting.length} sent ${waiting.length === 1 ? "quote" : "quotes"}` },
    { label: "Acceptance rate", value: decided === 0 ? "n/a" : `${Math.round((accepted / decided) * 100)}%`, note: "Of quotes accepted, declined or expired" },
    { label: "Expiring this week", value: String(expiringSoon.length), note: "Sent quotes that run out within 7 days" },
    { label: "Drafts", value: String(rows.filter((q) => q.shown === "DRAFT").length), note: "Not sent yet" },
  ];

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Quotes</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">Price an offer, send it, and turn it into an order once accepted.</p>
        </div>
        <LinkButton href="/dashboard/quotes/new">
          <Plus className="h-4 w-4" />
          New quote
        </LinkButton>
      </div>

      <div className="mt-4">
        <ErrorBanner code={error} />
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.09] p-4 glass light:border-white/80">
            <p className="text-xs text-slate-400 light:text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-50 light:text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.note}</p>
          </div>
        ))}
      </div>

      <nav aria-label="Filter quotes" className="mt-6 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "ALL" ? "/dashboard/quotes" : `/dashboard/quotes?status=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              f === filter
                ? "bg-blue-600 font-medium text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-100 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-900"
            )}
          >
            {f === "ALL" ? "All" : QUOTE_STATUS_LABELS[f]}
          </Link>
        ))}
      </nav>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/[0.09] glass light:border-white/80">
        {visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filter === "ALL" ? "No quotes yet" : `No ${QUOTE_STATUS_LABELS[filter].toLowerCase()} quotes`}
            description={filter === "ALL" ? "Create a quote to send a customer prices before they order." : "Choose another filter to see the rest."}
            action={filter === "ALL" ? { href: "/dashboard/quotes/new", label: "New quote" } : { href: "/dashboard/quotes", label: "Show all", variant: "secondary" }}
          />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                <th className="px-5 py-3 font-medium">Quote</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Valid until</th>
                <th className="px-5 py-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => (
                <tr key={q.id} className="border-b border-white/[0.04] last:border-0 light:border-slate-100">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/quotes/${q.id}`} className="whitespace-nowrap font-mono font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                      {q.quoteNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-300 light:text-slate-700">{q.customer.name}</td>
                  <td className="px-5 py-3">
                    <QuoteStatusBadge status={q.shown} />
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-300 light:text-slate-700">{money(q.totalAmount, true)}</td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{q.validUntil ? shortDate(q.validUntil) : "No limit"}</td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{q.owner?.name ?? "Nobody"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
