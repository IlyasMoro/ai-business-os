import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { CampaignForm } from "@/components/marketing/campaign-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BackButton } from "@/components/ui-dark/back-button";
import { updateCampaign } from "@/lib/actions/marketing";

export const metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const campaign = await db.campaign.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true, name: true, channel: true, budget: true, spent: true, startDate: true, endDate: true, notes: true },
  });
  if (!campaign) notFound();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href={`/dashboard/marketing/${campaign.id}`} label="Back to campaign" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Edit campaign</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ErrorBanner code={error} />
          <CampaignForm action={updateCampaign.bind(null, campaign.id)} campaign={campaign} />
        </div>
      </div>
    </div>
  );
}
