import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { StatusBadge } from "@/components/ui-dark/badge";
import { LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { CopyField } from "@/components/ui-dark/copy-field";
import { CampaignStatusForm } from "@/components/marketing/campaign-status-form";
import { DocumentsSection } from "@/components/documents/documents-section";
import { deleteCampaign } from "@/lib/actions/marketing";
import { BackButton } from "@/components/ui-dark/back-button";
import { getCampaignStats } from "@/lib/campaign-data";
import { formatRoi } from "@/lib/campaign-stats";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Campaign" };

const statusTone = {
  DRAFT: "slate",
  ACTIVE: "green",
  PAUSED: "yellow",
  COMPLETED: "blue",
} as const;

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-400 light:text-emerald-700" : tone === "bad" ? "text-red-400 light:text-red-700" : "text-slate-50 light:text-slate-900";
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const campaign = await db.campaign.findUnique({
    where: { id, companyId: session.companyId },
    include: {
      leads: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          deals: { where: { stage: "WON" }, select: { value: true } },
        },
      },
    },
  });

  if (!campaign) notFound();

  const [stats, documents, crmSettings] = await Promise.all([
    getCampaignStats(session.companyId, campaign.id),
    db.document.findMany({
      where: { companyId: session.companyId, entityType: "CAMPAIGN", entityId: campaign.id },
      select: { id: true, filename: true, size: true, mimeType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.crmSettings.findUnique({ where: { companyId: session.companyId }, select: { formToken: true, formEnabled: true } }),
  ]);
  if (!stats) notFound();

  const base = process.env.APP_BASE_URL ?? "";
  // The company's web lead form, tagged with this campaign: everyone who
  // sends it is attributed here (checked again on the server).
  const formUrl = crmSettings?.formToken ? `${base}/f/${crmSettings.formToken}?c=${campaign.id}` : null;
  const roiTone = stats.roiPct === null ? undefined : stats.roiPct >= 0 ? "good" : "bad";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/dashboard/marketing" label="Back to campaigns" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{campaign.name}</h1>
              <StatusBadge status={campaign.status} tone={statusTone[campaign.status]} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              {campaign.channel.charAt(0) + campaign.channel.slice(1).toLowerCase()}
              {campaign.startDate && ` · Starts ${formatDate(campaign.startDate)}`}
              {campaign.endDate && ` · Ends ${formatDate(campaign.endDate)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CampaignStatusForm campaignId={campaign.id} status={campaign.status} />
            <LinkButton href={`/dashboard/marketing/${campaign.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </LinkButton>
            <DeleteButton action={deleteCampaign.bind(null, campaign.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Spend</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Budget" value={formatCurrency(stats.budget)} />
            <Stat label="Spent" value={formatCurrency(stats.spent)} hint={stats.spent === 0 ? "Record it with Edit" : undefined} />
            <Stat
              label={stats.budgetLeft < 0 ? "Over budget" : "Budget left"}
              value={formatCurrency(Math.abs(stats.budgetLeft))}
              tone={stats.budgetLeft < 0 ? "bad" : undefined}
            />
            <Stat label="Cost per lead" value={stats.costPerLead === null ? "n/a" : formatCurrency(stats.costPerLead)} />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Leads" value={String(stats.leads)} />
              <Stat
                label="Became customers"
                value={String(stats.converted)}
                hint={stats.conversionPct === null ? undefined : `${Math.round(stats.conversionPct)}% of leads`}
              />
              <Stat label="Deals won" value={String(stats.wonDeals)} hint={stats.wonDeals > 0 ? `${formatCurrency(stats.wonValue)} won` : undefined} />
              <Stat label="Open pipeline" value={formatCurrency(stats.openPipeline)} />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4 light:border-slate-200 sm:grid-cols-4">
              <Stat label="Revenue" value={formatCurrency(stats.revenue)} hint="Paid invoices from these leads" />
              <Stat label="Return on spend" value={formatRoi(stats.roiPct)} tone={roiTone} hint={stats.roiPct === null ? "Shows once spend is recorded" : undefined} />
              <Stat label="Cost per customer" value={stats.costPerCustomer === null ? "n/a" : formatCurrency(stats.costPerCustomer)} />
            </div>
            <p className="text-xs text-slate-500">
              Revenue counts invoices marked paid{campaign.startDate ? " and issued on or after the start date" : ""}, so earlier business from the same
              customers isn&apos;t credited to this campaign.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Lead form for this campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {formUrl ? (
              <>
                <p className="text-slate-400 light:text-slate-500">
                  Use this link in the campaign&apos;s ads, posts or emails. Everyone who sends the form is added to this campaign.
                  {!crmSettings?.formEnabled && " The form is switched off in CRM settings, so it won't take messages until you turn it on."}
                </p>
                <CopyField value={formUrl} label="Campaign form link" />
              </>
            ) : (
              <p className="text-slate-400 light:text-slate-500">
                Set up your web lead form in{" "}
                <Link href="/dashboard/crm/settings" className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                  CRM settings
                </Link>{" "}
                first, then a link for this campaign appears here.
              </p>
            )}
          </CardContent>
        </Card>

        {campaign.notes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-slate-300 light:text-slate-600">{campaign.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Attributed leads</CardTitle>
          </CardHeader>
          <CardContent>
            {campaign.leads.length === 0 ? (
              <p className="text-sm text-slate-500">
                No leads attributed yet. Share the campaign form link above, pick this campaign when you import customers, or set it as the
                campaign on a customer in CRM.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {campaign.leads.map((lead) => {
                  const won = lead.deals.reduce((s, d) => s + d.value, 0);
                  return (
                    <li key={lead.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <Link
                        href={`/dashboard/crm/${lead.id}`}
                        className="truncate font-semibold text-slate-50 light:text-slate-900 hover:text-blue-400"
                      >
                        {lead.name}
                      </Link>
                      <span className="flex shrink-0 items-center gap-3 text-slate-500">
                        {won > 0 && <span className="tabular-nums text-emerald-400 light:text-emerald-700">{formatCurrency(won)} won</span>}
                        <span>{lead.status.charAt(0) + lead.status.slice(1).toLowerCase()}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <DocumentsSection
          entityType="CAMPAIGN"
          entityId={campaign.id}
          redirectPath={`/dashboard/marketing/${campaign.id}`}
          documents={documents}
        />

      </div>
    </div>
  );
}
