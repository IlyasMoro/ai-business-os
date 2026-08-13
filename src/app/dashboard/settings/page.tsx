import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { updateCompanyProfile, updateCompanyLogo, removeCompanyLogo } from "@/lib/actions/company";
import { Building2, ImageIcon } from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved } = await searchParams;

  const company = await db.company.findUnique({
    where: { id: session.companyId },
    select: { name: true, industry: true, logoMimeType: true },
  });
  const hasLogo = Boolean(company?.logoMimeType);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">Your company&apos;s profile.</p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {saved && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Saved.
          </div>
        )}
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-slate-50 light:text-slate-900">Company profile</p>
            <p className="text-sm text-slate-400 light:text-slate-500">
              Shown across invoices, reports, and emails sent on your behalf.
            </p>
          </div>
        </div>

        <form action={updateCompanyProfile} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="name">Company name</Label>
            <Input id="name" name="name" defaultValue={company?.name} required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Input
              id="industry"
              name="industry"
              defaultValue={company?.industry ?? ""}
              placeholder="e.g. Retail, Consulting, Manufacturing"
              maxLength={200}
            />
          </div>
          <SubmitButton pendingText="Saving...">Save</SubmitButton>
        </form>
      </div>

      <div className="mt-4 max-w-2xl rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] light:border-slate-200 bg-white/5 text-slate-300 light:text-slate-600">
            <ImageIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-slate-50 light:text-slate-900">Company logo</p>
            <p className="text-sm text-slate-400 light:text-slate-500">
              Replaces the AIBOS mark on invoices, payslips, business reports, and emails sent to your
              customers. PNG or JPEG, up to 2MB.
            </p>
          </div>
        </div>

        {hasLogo && (
          <div className="mt-4 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/company-logo/${session.companyId}`}
              alt="Current company logo"
              className="h-16 w-16 rounded-md border border-white/[0.06] light:border-slate-200 object-contain bg-white p-1"
            />
            <form action={removeCompanyLogo}>
              <SubmitButton variant="ghost" pendingText="Removing...">
                Remove
              </SubmitButton>
            </form>
          </div>
        )}

        <form action={updateCompanyLogo} className="mt-4 flex items-center gap-3">
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg"
            required
            className="block w-full text-sm text-slate-400 light:text-slate-500 file:mr-3 file:rounded-md file:border file:border-white/[0.06] light:border-slate-200 file:bg-[#1a1a1a] file:px-3 file:py-1.5 file:text-sm file:text-slate-300 light:text-slate-600 file:transition-colors hover:file:bg-white/5"
          />
          <SubmitButton variant="secondary" pendingText="Uploading...">
            {hasLogo ? "Replace" : "Upload"}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
