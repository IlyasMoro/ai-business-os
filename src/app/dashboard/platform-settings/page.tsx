import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { db } from "@/lib/db";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Input, Label } from "@/components/ui-dark/input";
import { updateEmailSettings, clearEmailSettings, sendTestPlatformEmail } from "@/lib/actions/platform-settings";
import { Mail } from "lucide-react";

export default async function PlatformSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; testsent?: string }>;
}) {
  const user = await getCurrentUser();
  if (!isPlatformAdmin(user.email)) notFound();

  const { error, saved, testsent } = await searchParams;

  const settings = await db.platformSettings.findUnique({ where: { id: "platform" } });
  const configured = Boolean(settings?.resendApiKey && settings?.resendFromEmail);
  const sendTestAction = sendTestPlatformEmail.bind(null, user.email);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50">Platform settings</h1>
      <p className="mt-1 text-sm text-slate-400">
        App-wide configuration, visible only to the platform operator — not exposed to any
        company's regular users.
      </p>

      <div className="mt-4 max-w-2xl space-y-3">
        <ErrorBanner code={error} />
        {saved && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Saved.
          </div>
        )}
        {testsent && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            Test email sent to {user.email} — check your inbox.
          </div>
        )}
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/5 text-slate-300">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-slate-50">Transactional email (Resend)</p>
            <p className="text-sm text-slate-400">
              {configured
                ? "Configured. Used for password resets, invoice reminders, and notifications for every company on this platform."
                : "Not configured — those emails currently fail silently."}
            </p>
          </div>
        </div>

        <form action={updateEmailSettings} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="resendApiKey">Resend API key</Label>
            <Input
              id="resendApiKey"
              name="resendApiKey"
              type="password"
              placeholder={settings?.resendApiKey ? "•••••••••••••••• (configured — leave blank to keep)" : "re_..."}
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="resendFromEmail">From address</Label>
            <Input
              id="resendFromEmail"
              name="resendFromEmail"
              type="email"
              placeholder={settings?.resendFromEmail || "onboarding@resend.dev"}
            />
          </div>
          <SubmitButton pendingText="Saving...">Save</SubmitButton>
        </form>

        {configured && (
          <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-4">
            <form action={sendTestAction}>
              <SubmitButton variant="secondary" pendingText="Sending...">
                Send test email
              </SubmitButton>
            </form>
            <form action={clearEmailSettings}>
              <SubmitButton variant="ghost" pendingText="Clearing...">
                Clear
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
