import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { CampaignStatusForm } from "@/components/marketing/campaign-status-form";
import { deleteCampaign } from "@/lib/actions/marketing";

const statusTone = {
  DRAFT: "slate",
  ACTIVE: "green",
  PAUSED: "yellow",
  COMPLETED: "blue",
} as const;

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const campaign = await db.campaign.findUnique({
    where: { id, companyId: session.companyId },
    include: { leads: { orderBy: { createdAt: "desc" } } },
  });

  if (!campaign) notFound();

  const costPerLead = campaign.leads.length > 0 ? campaign.budget / campaign.leads.length : null;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">{campaign.name}</h1>
              <Badge tone={statusTone[campaign.status]}>{campaign.status}</Badge>
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              {campaign.channel.charAt(0) + campaign.channel.slice(1).toLowerCase()}
              {campaign.startDate && ` · Starts ${campaign.startDate.toLocaleDateString()}`}
              {campaign.endDate && ` · Ends ${campaign.endDate.toLocaleDateString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CampaignStatusForm campaignId={campaign.id} status={campaign.status} />
            <DeleteButton action={deleteCampaign.bind(null, campaign.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Budget</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-50 light:text-slate-900">
                ${campaign.budget.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Leads generated</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-50 light:text-slate-900">
                {campaign.leads.length}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Cost per lead</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-50 light:text-slate-900">
                {costPerLead !== null ? `$${costPerLead.toFixed(2)}` : "—"}
              </p>
            </div>
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
                No leads attributed yet. Set this campaign as the source when creating a customer in
                CRM.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
                {campaign.leads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between py-2 text-sm">
                    <Link
                      href={`/dashboard/crm/${lead.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {lead.name}
                    </Link>
                    <span className="text-slate-500">{lead.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/marketing" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to campaigns
          </Link>
        </p>
      </div>
    </div>
  );
}
