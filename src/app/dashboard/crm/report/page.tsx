import Link from "next/link";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { CrmTabs } from "@/components/crm/crm-tabs";
import { TrendChart } from "@/components/dash-viz/trend-chart";
import { VIZ } from "@/components/dash-viz/colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { isOpenStage, pipelineSummary, stageInfo } from "@/lib/crm-pipeline";
import {
  REPORT_PERIODS,
  closedIn,
  forecastByMonth,
  openByStage,
  periodRange,
  statsByOwner,
  statsBySource,
  wonByMonth,
  type ReportPeriod,
} from "@/lib/sales-report";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sales report" };

const STAGE_TONE = { NEW: "slate", QUALIFIED: "blue", PROPOSAL: "purple", NEGOTIATION: "yellow", WON: "green", LOST: "red" } as const;

function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function pct(n: number | null) {
  return n === null ? "n/a" : `${n}%`;
}

/** A thin bar under a row, scaled to the largest value in its table. */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.06] light:bg-slate-900/[0.07]">
      <span className="block h-full rounded-full" style={{ width: `${max > 0 && value > 0 ? Math.max(2, (value / max) * 100) : 0}%`, backgroundColor: color }} />
    </span>
  );
}

const th = "px-4 py-2.5 font-medium";
const td = "px-4 py-2.5 tabular-nums";

/**
 * Pipeline value, forecast, win rate and results per salesperson and lead
 * source. Owners and admins see every salesperson; everyone else sees their
 * own row. Deals have no branch, so this is company wide.
 */
export default async function SalesReportPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await verifySession();
  const { period: periodParam } = await searchParams;
  const period: ReportPeriod = REPORT_PERIODS.find((p) => p.id === periodParam)?.id ?? "quarter";
  const periodLabel = REPORT_PERIODS.find((p) => p.id === period)!.label.toLowerCase();
  const now = new Date();
  const range = periodRange(period, now);
  const seeEveryone = hasRole(session, ["OWNER", "ADMIN"]);

  const [dealRows, quotes, customers, users] = await Promise.all([
    db.deal.findMany({
      where: { companyId: session.companyId },
      select: {
        id: true,
        title: true,
        value: true,
        stage: true,
        probability: true,
        expectedClose: true,
        closedAt: true,
        createdAt: true,
        ownerId: true,
        customer: { select: { name: true, source: true } },
      },
    }),
    db.quote.findMany({
      where: { companyId: session.companyId },
      select: { status: true, ownerId: true, sentAt: true, decidedAt: true, totalAmount: true },
    }),
    db.customer.findMany({ where: { companyId: session.companyId }, select: { source: true, createdAt: true } }),
    db.user.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true } }),
  ]);

  const deals = dealRows.map((d) => ({ ...d, source: d.customer.source }));
  const summary = pipelineSummary(deals);
  const closed = closedIn(deals, range);
  const forecast = forecastByMonth(deals, now);
  const stages = openByStage(deals);
  const owners = statsByOwner(deals, quotes, range).filter((r) => seeEveryone || r.ownerId === session.userId);
  const sources = statsBySource(customers, deals, range);
  const trend = wonByMonth(deals, now, 6).map((m) => ({
    label: m.start.toLocaleDateString("en-US", { month: "short" }),
    longLabel: m.start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    value: m.value,
  }));
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const inRange = (d: Date | null) => Boolean(d && d >= range.start && d < range.end);
  const quotesSent = quotes.filter((q) => inRange(q.sentAt)).length;
  const accepted = quotes.filter((q) => q.status === "ACCEPTED" && inRange(q.decidedAt));
  const declined = quotes.filter((q) => q.status === "DECLINED" && inRange(q.decidedAt)).length;

  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const closingSoon = deals
    .filter((d) => isOpenStage(d.stage) && d.expectedClose && d.expectedClose < monthEnd)
    .sort((a, b) => (b.value * b.probability) / 100 - (a.value * a.probability) / 100)
    .slice(0, 10);

  const stats = [
    { label: "Open pipeline", value: money(summary.openValue), note: `${summary.openCount} open ${summary.openCount === 1 ? "deal" : "deals"}` },
    { label: "Weighted forecast", value: money(summary.weightedValue), note: "Each open deal times its chance" },
    { label: `Won ${periodLabel}`, value: money(closed.wonValue), note: `${closed.wonCount} ${closed.wonCount === 1 ? "deal" : "deals"}` },
    { label: "Win rate", value: pct(closed.winRate), note: `${closed.wonCount} won, ${closed.lostCount} lost ${periodLabel}` },
    { label: "Average won deal", value: closed.averageWon === null ? "n/a" : money(closed.averageWon), note: `Deals won ${periodLabel}` },
    {
      label: "Average time to win",
      value: closed.averageCycleDays === null ? "n/a" : `${closed.averageCycleDays} ${closed.averageCycleDays === 1 ? "day" : "days"}`,
      note: "From adding the deal to winning it",
    },
  ];

  const forecastMax = Math.max(...forecast.map((b) => b.value));
  const stageMax = Math.max(...stages.map((s) => s.value));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Sales report</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">Pipeline, forecast and results from your deals and quotes.</p>
        </div>
        <nav aria-label="Period" className="inline-flex flex-wrap rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm light:border-slate-200 light:bg-slate-100">
          {REPORT_PERIODS.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/crm/report?period=${p.id}`}
              aria-current={p.id === period ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                p.id === period ? "bg-blue-600 font-medium text-white" : "text-slate-300 hover:text-white light:text-slate-600 light:hover:text-slate-900"
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      <CrmTabs active="/dashboard/crm/report" />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.09] p-4 glass light:border-white/80">
            <p className="text-xs text-slate-400 light:text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-50 light:text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Forecast by expected close</CardTitle>
            <p className="text-xs text-slate-500">Open deals by the month they should close. Weighted is the likely amount.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                  <th className={th}>Close</th>
                  <th className={cn(th, "text-right")}>Deals</th>
                  <th className={cn(th, "text-right")}>Value</th>
                  <th className={cn(th, "text-right")}>Weighted</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((b) => (
                  <tr key={b.key} className="border-b border-white/[0.04] last:border-0 light:border-slate-100">
                    <td className="px-4 py-2.5">
                      <span className={cn("text-slate-100 light:text-slate-800", b.key === "overdue" && b.count > 0 && "text-amber-400 light:text-amber-700")}>{b.label}</span>
                      <Bar value={b.value} max={forecastMax} color={b.key === "overdue" ? VIZ.amber : VIZ.blue} />
                    </td>
                    <td className={cn(td, "text-right text-slate-400")}>{b.count}</td>
                    <td className={cn(td, "text-right text-slate-300 light:text-slate-700")}>{money(b.value)}</td>
                    <td className={cn(td, "text-right font-medium text-slate-50 light:text-slate-900")}>{money(b.weighted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open pipeline by stage</CardTitle>
            <p className="text-xs text-slate-500">Where open deals sit on the board right now.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {stages.map((s) => (
                <li key={s.stage}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-100 light:text-slate-800">
                      {s.label} <span className="text-xs text-slate-500">{s.count}</span>
                    </span>
                    <span className="tabular-nums text-slate-50 light:text-slate-900">{money(s.value)}</span>
                  </div>
                  <Bar value={s.value} max={stageMax} color={VIZ.blue} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Won by month</CardTitle>
            <p className="text-xs text-slate-500">Value of deals won, last 6 months.</p>
          </CardHeader>
          <CardContent>
            {trend.some((t) => t.value > 0) ? (
              <TrendChart data={trend} color={VIZ.emerald} currency title="Won deal value by month, last 6 months" />
            ) : (
              <p className="text-sm text-slate-500">No deals won in the last 6 months yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quotes {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "Sent", value: String(quotesSent) },
                { label: "Accepted", value: String(accepted.length) },
                { label: "Declined", value: String(declined) },
                {
                  label: "Acceptance rate",
                  value: accepted.length + declined === 0 ? "n/a" : `${Math.round((accepted.length / (accepted.length + declined)) * 100)}%`,
                },
                { label: "Accepted value", value: money(accepted.reduce((s, q) => s + q.totalAmount, 0)) },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-xs text-slate-500">{s.label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-50 light:text-slate-900">{s.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{seeEveryone ? "By salesperson" : "Your figures"}</CardTitle>
          <p className="text-xs text-slate-500">Open pipeline is as of today; won, lost and quotes are {periodLabel}.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {owners.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-slate-500">No deals or quotes to report yet.</p>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                  <th className={th}>Salesperson</th>
                  <th className={cn(th, "text-right")}>Open deals</th>
                  <th className={cn(th, "text-right")}>Open value</th>
                  <th className={cn(th, "text-right")}>Weighted</th>
                  <th className={cn(th, "text-right")}>Won</th>
                  <th className={cn(th, "text-right")}>Won value</th>
                  <th className={cn(th, "text-right")}>Win rate</th>
                  <th className={cn(th, "text-right")}>Quotes sent</th>
                  <th className={cn(th, "text-right")}>Accepted</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((r) => (
                  <tr key={r.ownerId ?? "none"} className="border-b border-white/[0.04] last:border-0 light:border-slate-100">
                    <td className="px-4 py-2.5 text-slate-100 light:text-slate-800">
                      {r.ownerId ? (userName.get(r.ownerId) ?? "Former team member") : "No owner"}
                      {r.ownerId === session.userId && <span className="ml-1.5 text-xs text-slate-500">(you)</span>}
                    </td>
                    <td className={cn(td, "text-right text-slate-400")}>{r.openCount}</td>
                    <td className={cn(td, "text-right text-slate-300 light:text-slate-700")}>{money(r.openValue)}</td>
                    <td className={cn(td, "text-right text-slate-300 light:text-slate-700")}>{money(r.weighted)}</td>
                    <td className={cn(td, "text-right text-slate-400")}>{r.wonCount}</td>
                    <td className={cn(td, "text-right font-medium text-emerald-400 light:text-emerald-700")}>{money(r.wonValue)}</td>
                    <td className={cn(td, "text-right text-slate-300 light:text-slate-700")}>{pct(r.winRate)}</td>
                    <td className={cn(td, "text-right text-slate-400")}>{r.quotesSent}</td>
                    <td className={cn(td, "text-right text-slate-400")}>{r.quotesAccepted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By lead source</CardTitle>
            <p className="text-xs text-slate-500">New customers and deals won {periodLabel}, by where the customer came from.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {sources.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-slate-500">Nothing {periodLabel} yet. Set a lead source on customers to see where business comes from.</p>
            ) : (
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                    <th className={th}>Source</th>
                    <th className={cn(th, "text-right")}>New customers</th>
                    <th className={cn(th, "text-right")}>Won</th>
                    <th className={cn(th, "text-right")}>Won value</th>
                    <th className={cn(th, "text-right")}>Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((r) => (
                    <tr key={r.label} className="border-b border-white/[0.04] last:border-0 light:border-slate-100">
                      <td className={cn("px-4 py-2.5", r.source ? "text-slate-100 light:text-slate-800" : "text-slate-500")}>{r.label}</td>
                      <td className={cn(td, "text-right text-slate-400")}>{r.newCustomers}</td>
                      <td className={cn(td, "text-right text-slate-400")}>{r.wonCount}</td>
                      <td className={cn(td, "text-right text-slate-300 light:text-slate-700")}>{money(r.wonValue)}</td>
                      <td className={cn(td, "text-right text-slate-300 light:text-slate-700")}>{pct(r.winRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Might close this month</CardTitle>
            <p className="text-xs text-slate-500">Open deals expected to close by month end, most likely value first.</p>
          </CardHeader>
          <CardContent>
            {closingSoon.length === 0 ? (
              <p className="text-sm text-slate-500">No open deals are expected to close this month.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {closingSoon.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <Link href={`/dashboard/crm/deals/${d.id}`} className="block truncate font-semibold text-slate-50 hover:text-blue-400 light:text-slate-900">
                        {d.title}
                      </Link>
                      <span className="text-xs text-slate-500">
                        {d.customer.name} · {d.expectedClose! < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? "overdue, " : ""}
                        {d.expectedClose!.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-right tabular-nums">
                        <span className="block text-slate-50 light:text-slate-900">{money(d.value)}</span>
                        <span className="block text-xs text-slate-500">{d.probability}% chance</span>
                      </span>
                      <Badge tone={STAGE_TONE[d.stage]}>{stageInfo(d.stage).label}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
