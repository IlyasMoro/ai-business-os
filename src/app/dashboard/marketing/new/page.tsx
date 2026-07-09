import { CampaignForm } from "@/components/marketing/campaign-form";
import { ErrorBanner } from "@/components/ui/error-banner";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New campaign</h1>
      <div className="mt-6 max-w-xl">
        <ErrorBanner code={error} />
        <CampaignForm />
      </div>
    </div>
  );
}
