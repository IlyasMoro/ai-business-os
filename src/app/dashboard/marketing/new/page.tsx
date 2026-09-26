import { CampaignForm } from "@/components/marketing/campaign-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/marketing" label="Back to campaigns" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New campaign</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ErrorBanner code={error} />
          <CampaignForm />
        </div>
      </div>
    </div>
  );
}
