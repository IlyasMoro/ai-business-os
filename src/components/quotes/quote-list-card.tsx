import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { LinkButton } from "@/components/ui-dark/button";
import { QuoteStatusBadge, money, shortDate } from "@/components/quotes/quote-parts";
import { displayStatus, type QuoteStatus } from "@/lib/quotes";

/** A customer's or deal's quotes, with a button for a new one prefilled. */
export function QuoteListCard({
  quotes,
  newHref,
  className,
}: {
  quotes: { id: string; quoteNumber: string; status: QuoteStatus; validUntil: Date | null; totalAmount: number; createdAt: Date }[];
  newHref: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quotes ({quotes.length})</CardTitle>
        <LinkButton href={newHref} variant="secondary" size="sm">
          <Plus className="h-4 w-4" />
          New quote
        </LinkButton>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <p className="text-sm text-slate-500">No quotes yet. Send one before the customer orders.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
            {quotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <Link href={`/dashboard/quotes/${q.id}`} className="whitespace-nowrap font-mono font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                    {q.quoteNumber}
                  </Link>
                  <span className="ml-2 text-xs text-slate-500">{shortDate(q.createdAt)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-slate-300 light:text-slate-600">{money(q.totalAmount, true)}</span>
                  <QuoteStatusBadge status={displayStatus(q)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
